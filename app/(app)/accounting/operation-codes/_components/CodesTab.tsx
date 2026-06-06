"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { Drawer } from "@/components/ui/Drawer";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  archiveOperationCode,
  createOperationCode,
  fetchOperationCodes,
  updateOperationCode,
  OPERATION_DIRECTIONS,
  OPERATION_MODULES,
  type OperationCode,
  type OperationCodeStatus,
  type OperationCodeWritePayload,
  type PaginatedOperationCodes,
} from "@/lib/api/operation-codes";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

const STATUS_TONE: Record<OperationCodeStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  archived: "danger",
};

function moduleLabel(value: string, t: (k: string) => string): string {
  const key = `operationCodes.modules.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

function directionLabel(value: string | null, t: (k: string) => string): string {
  if (!value) return "—";
  const key = `operationCodes.directions.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

export function CodesTab() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const create = useCanAny(["operation.codes.create"]);
  const update = useCanAny(["operation.codes.update"]);
  const archive = useCanAny(["operation.codes.archive"]);
  const canCreate = isPlatformAdmin || create;
  const canUpdate = isPlatformAdmin || update;
  const canArchive = isPlatformAdmin || archive;
  const hasRowActions = canUpdate || canArchive;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<{
    mode: "create" | "edit";
    initial: OperationCode | null;
  } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<OperationCode | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedOperationCodes> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchOperationCodes(token, {
        page,
        perPage: pageSize,
        module: moduleFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
    },
    [token, page, pageSize, moduleFilter, statusFilter, search],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    moduleFilter,
    statusFilter,
    search,
  ]);

  const rows = data?.data ?? [];

  async function handleSetStatus(c: OperationCode, status: OperationCodeStatus) {
    if (!token) return;
    try {
      await updateOperationCode(token, c.public_id, { status });
      toast.success(
        t("operationCodes.codes.toast.statusTitle"),
        t("operationCodes.codes.toast.statusBody", {
          code: c.code,
          status: t(`operationCodes.codes.status.${status}`),
        }),
      );
      refetch();
    } catch (cause) {
      toast.error(
        t("operationCodes.codes.toast.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    }
  }

  async function handleArchive() {
    if (!token || !confirmArchive) return;
    setArchiving(true);
    try {
      await archiveOperationCode(token, confirmArchive.public_id);
      toast.success(
        t("operationCodes.codes.toast.archivedTitle"),
        t("operationCodes.codes.toast.archivedBody", { code: confirmArchive.code }),
      );
      setConfirmArchive(null);
      refetch();
    } catch (cause) {
      toast.error(
        t("operationCodes.codes.toast.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    } finally {
      setArchiving(false);
    }
  }

  async function handleSubmit(payload: OperationCodeWritePayload) {
    if (!token || !drawer) return;
    if (drawer.mode === "create") {
      const created = await createOperationCode(token, payload);
      toast.success(
        t("operationCodes.codes.toast.createdTitle"),
        t("operationCodes.codes.toast.createdBody", { code: created.code }),
      );
      setPage(1);
    } else if (drawer.initial) {
      await updateOperationCode(token, drawer.initial.public_id, payload);
      toast.success(
        t("operationCodes.codes.toast.updatedTitle"),
        t("operationCodes.codes.toast.updatedBody", { code: drawer.initial.code }),
      );
    }
    setDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<OperationCode, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("operationCodes.codes.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-foreground">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "label",
        header: t("operationCodes.codes.columns.label"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "module",
        header: t("operationCodes.codes.columns.module"),
        cell: ({ getValue }) => (
          <Badge tone="info">{moduleLabel(getValue() as string, t)}</Badge>
        ),
      },
      {
        accessorKey: "direction",
        header: t("operationCodes.codes.columns.direction"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {directionLabel(getValue() as string | null, t)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("operationCodes.codes.columns.status"),
        cell: ({ getValue }) => {
          const v = getValue() as OperationCodeStatus;
          return (
            <Badge tone={STATUS_TONE[v]}>
              {t(`operationCodes.codes.status.${v}`)}
            </Badge>
          );
        },
      },
      ...(hasRowActions
        ? [
            {
              id: "actions",
              header: t("operationCodes.codes.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const c = row.original;
                const items: DropdownMenuItem[] = [];
                if (canUpdate) {
                  items.push({
                    label: t("operationCodes.codes.actions.edit"),
                    onClick: () => setDrawer({ mode: "edit", initial: c }),
                  });
                  if (c.status !== "archived") {
                    items.push(
                      c.status === "active"
                        ? {
                            label: t("operationCodes.codes.actions.deactivate"),
                            onClick: () => handleSetStatus(c, "inactive"),
                          }
                        : {
                            label: t("operationCodes.codes.actions.activate"),
                            onClick: () => handleSetStatus(c, "active"),
                          },
                    );
                  }
                }
                if (canArchive && c.status !== "archived") {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    label: t("operationCodes.codes.actions.archive"),
                    onClick: () => setConfirmArchive(c),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("operationCodes.codes.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<OperationCode, unknown>,
          ]
        : []),
    ],
    [t, hasRowActions, canUpdate, canArchive],
  );

  const pageMeta = data?.meta.pagination;
  const pagination: DataTablePagination | undefined = pageMeta
    ? {
        page: pageMeta.current_page,
        pageSize: pageMeta.per_page,
        total: pageMeta.total,
        lastPage: pageMeta.last_page,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert
          variant="danger"
          title={t("operationCodes.codes.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <section className="grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label={t("operationCodes.codes.filters.search")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("operationCodes.codes.filters.searchPlaceholder")}
        />
        <Select
          label={t("operationCodes.codes.filters.module")}
          value={moduleFilter}
          options={OPERATION_MODULES.map((m) => ({
            value: m,
            label: moduleLabel(m, t),
          }))}
          placeholder={t("operationCodes.codes.filters.moduleAll")}
          isClearable
          onChange={(next) => {
            setModuleFilter(next);
            setPage(1);
          }}
        />
        <Select
          label={t("operationCodes.codes.filters.status")}
          value={statusFilter}
          options={(["active", "inactive", "archived"] as const).map((s) => ({
            value: s,
            label: t(`operationCodes.codes.status.${s}`),
          }))}
          placeholder={t("operationCodes.codes.filters.statusAll")}
          isClearable
          onChange={(next) => {
            setStatusFilter(next);
            setPage(1);
          }}
        />
      </section>

      {canCreate ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDrawer({ mode: "create", initial: null })}
          >
            + {t("operationCodes.codes.actions.create")}
          </Button>
        </div>
      ) : null}

      <DataTable<OperationCode>
        columns={columns}
        data={rows}
        loading={loading && !data}
        emptyMessage={t("operationCodes.codes.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("operationCodes.codes.listTitle")}
        titleAside={t("operationCodes.codes.count", {
          count: pageMeta?.total ?? rows.length,
        })}
      />

      {canCreate || canUpdate ? (
        <CodeDrawer
          open={drawer !== null}
          mode={drawer?.mode ?? "create"}
          initial={drawer?.initial ?? null}
          onClose={() => setDrawer(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={confirmArchive !== null}
        title={t("operationCodes.codes.confirm.archive.title")}
        description={t("operationCodes.codes.confirm.archive.message", {
          code: confirmArchive?.code ?? "",
        })}
        confirmLabel={t("operationCodes.codes.actions.archive")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={archiving}
        onConfirm={handleArchive}
        onClose={() => setConfirmArchive(null)}
      />
    </div>
  );
}

function CodeDrawer({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: OperationCode | null;
  onClose: () => void;
  onSubmit: (payload: OperationCodeWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    code: "",
    label: "",
    module: "",
    operation_type: "",
    direction: "",
    status: "active" as OperationCodeStatus,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    setForm({
      code: initial?.code ?? "",
      label: initial?.label ?? "",
      module: initial?.module ?? "",
      operation_type: initial?.operation_type ?? "",
      direction: initial?.direction ?? "",
      status: initial?.status ?? "active",
    });
  }, [open, initial]);

  // Archived is reachable via update; on create only active/inactive are valid.
  const statusOptions = (
    isEdit
      ? (["active", "inactive", "archived"] as const)
      : (["active", "inactive"] as const)
  ).map((s) => ({ value: s, label: t(`operationCodes.codes.status.${s}`) }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    const payload: OperationCodeWritePayload = {
      label: form.label.trim(),
      module: form.module,
      operation_type: form.operation_type.trim() || null,
      direction: form.direction || null,
      status: form.status,
      // `code` is immutable — only sent on create.
      ...(isEdit ? {} : { code: form.code.trim() }),
    };
    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        code: t("operationCodes.codes.fields.code"),
        label: t("operationCodes.codes.fields.label"),
        module: t("operationCodes.codes.fields.module"),
        operation_type: t("operationCodes.codes.fields.operationType"),
        direction: t("operationCodes.codes.fields.direction"),
        status: t("operationCodes.codes.fields.status"),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        isEdit
          ? t("operationCodes.codes.drawer.titleEdit")
          : t("operationCodes.codes.drawer.titleCreate")
      }
      description={t("operationCodes.codes.drawer.hint")}
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="operation-code-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("common.save")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {generalError}
        </p>
      ) : null}
      <form
        id="operation-code-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label={t("operationCodes.codes.fields.code")}
          value={form.code}
          onChange={(event) =>
            setForm((c) => ({ ...c, code: event.target.value }))
          }
          error={errors.code}
          required={!isEdit}
          disabled={isEdit}
          hint={
            isEdit
              ? t("operationCodes.codes.fields.codeImmutable")
              : t("operationCodes.codes.fields.codeHint")
          }
        />
        <TextField
          label={t("operationCodes.codes.fields.label")}
          value={form.label}
          onChange={(event) =>
            setForm((c) => ({ ...c, label: event.target.value }))
          }
          error={errors.label}
          required
        />
        <Select
          label={t("operationCodes.codes.fields.module")}
          value={form.module}
          options={OPERATION_MODULES.map((m) => ({
            value: m,
            label: moduleLabel(m, t),
          }))}
          placeholder={t("operationCodes.codes.fields.modulePlaceholder")}
          onChange={(next) => setForm((c) => ({ ...c, module: next }))}
          error={errors.module}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("operationCodes.codes.fields.operationType")}
            value={form.operation_type}
            onChange={(event) =>
              setForm((c) => ({ ...c, operation_type: event.target.value }))
            }
            error={errors.operation_type}
            hint={t("operationCodes.codes.fields.operationTypeHint")}
          />
          <Select
            label={t("operationCodes.codes.fields.direction")}
            value={form.direction}
            options={OPERATION_DIRECTIONS.map((d) => ({
              value: d,
              label: directionLabel(d, t),
            }))}
            placeholder={t("operationCodes.codes.fields.directionPlaceholder")}
            isClearable
            onChange={(next) => setForm((c) => ({ ...c, direction: next }))}
            error={errors.direction}
          />
        </div>
        <Select
          label={t("operationCodes.codes.fields.status")}
          value={form.status}
          options={statusOptions}
          onChange={(next) =>
            setForm((c) => ({ ...c, status: next as OperationCodeStatus }))
          }
          error={errors.status}
        />
      </form>
    </Drawer>
  );
}
