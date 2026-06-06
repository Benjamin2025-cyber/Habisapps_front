"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  createBatchProcedure,
  fetchBatchProcedures,
  updateBatchProcedure,
  updateBatchProcedureStatus,
  type BatchProcedure,
  type BatchProcedureStatus,
  type BatchProcedureWritePayload,
  type PaginatedBatchProcedures,
} from "@/lib/api/batch-procedures";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import {
  KNOWN_BATCH_PROCEDURE_CODES,
  isExecutableBatchCode,
} from "@/lib/catalogs/batch-procedure-codes";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

/** Common schedule cadences (the column is a free string, but these cover the
 *  seeded procedures: manual / daily / monthly). */
const SCHEDULE_TYPES = ["manual", "daily", "weekly", "monthly"] as const;

export function ProceduresTab() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const manageProcedures = useCanAny(["batch.procedures.manage"]);
  const canManage = isPlatformAdmin || manageProcedures;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<{
    mode: "create" | "edit";
    initial: BatchProcedure | null;
  } | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedBatchProcedures> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchBatchProcedures(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
  ]);

  const rows = data?.data ?? [];

  async function handleSetStatus(
    p: BatchProcedure,
    status: BatchProcedureStatus,
  ) {
    if (!token) return;
    try {
      await updateBatchProcedureStatus(token, p.public_id, status);
      toast.success(
        t("batch.procedures.toast.statusTitle"),
        t("batch.procedures.toast.statusBody", {
          name: p.name,
          status: t(`batch.procedures.status.${status}`),
        }),
      );
      refetch();
    } catch (cause) {
      toast.error(
        t("batch.procedures.toast.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    }
  }

  async function handleSubmit(payload: BatchProcedureWritePayload) {
    if (!token || !drawer) return;
    if (drawer.mode === "create") {
      const created = await createBatchProcedure(token, payload);
      toast.success(
        t("batch.procedures.toast.createdTitle"),
        t("batch.procedures.toast.createdBody", { name: created.name }),
      );
      setPage(1);
    } else if (drawer.initial) {
      await updateBatchProcedure(token, drawer.initial.public_id, payload);
      toast.success(
        t("batch.procedures.toast.updatedTitle"),
        t("batch.procedures.toast.updatedBody", { name: drawer.initial.name }),
      );
    }
    setDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<BatchProcedure, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("batch.procedures.columns.name"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">
              {row.original.name}
            </span>
            {row.original.description ? (
              <span className="max-w-[28rem] truncate text-xs text-muted-foreground">
                {row.original.description}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "code",
        header: t("batch.procedures.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "schedule_type",
        header: t("batch.procedures.columns.schedule"),
        cell: ({ getValue }) => {
          const v = (getValue() as string | null) ?? "";
          if (!v) return <span className="text-muted-foreground">—</span>;
          const key = `batch.procedures.schedule.${v}`;
          const label = t(key);
          return (
            <span className="text-muted-foreground">
              {label === key ? v : label}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("batch.procedures.columns.status"),
        cell: ({ getValue }) => {
          const v = getValue() as BatchProcedureStatus;
          return (
            <Badge tone={v === "active" ? "success" : "neutral"}>
              {t(`batch.procedures.status.${v}`)}
            </Badge>
          );
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("batch.procedures.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const p = row.original;
                const items: DropdownMenuItem[] = [
                  {
                    label: t("batch.procedures.actions.edit"),
                    onClick: () => setDrawer({ mode: "edit", initial: p }),
                  },
                  { kind: "separator" },
                  p.status === "active"
                    ? {
                        label: t("batch.procedures.actions.deactivate"),
                        onClick: () => handleSetStatus(p, "inactive"),
                      }
                    : {
                        label: t("batch.procedures.actions.activate"),
                        onClick: () => handleSetStatus(p, "active"),
                      },
                ];
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("batch.procedures.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<BatchProcedure, unknown>,
          ]
        : []),
    ],
    [t, canManage],
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
          title={t("batch.procedures.errorTitle")}
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

      {canManage ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDrawer({ mode: "create", initial: null })}
          >
            + {t("batch.procedures.actions.create")}
          </Button>
        </div>
      ) : null}

      <DataTable<BatchProcedure>
        columns={columns}
        data={rows}
        loading={loading && !data}
        emptyMessage={t("batch.procedures.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("batch.procedures.listTitle")}
        titleAside={t("batch.procedures.count", {
          count: pageMeta?.total ?? rows.length,
        })}
      />

      {canManage ? (
        <ProcedureDrawer
          open={drawer !== null}
          mode={drawer?.mode ?? "create"}
          initial={drawer?.initial ?? null}
          onClose={() => setDrawer(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

function ProcedureDrawer({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: BatchProcedure | null;
  onClose: () => void;
  onSubmit: (payload: BatchProcedureWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    schedule_type: "",
    schedule_metadata: "",
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
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      schedule_type: initial?.schedule_type ?? "",
      schedule_metadata: initial?.schedule_metadata
        ? JSON.stringify(initial.schedule_metadata, null, 2)
        : "",
    });
  }, [open, initial]);

  // Only codes the backend has a handler for are offerable on create — a
  // free-typed code would save a row that can never execute. (Mirror of backend
  // source; see lib/catalogs/batch-procedure-codes.ts.)
  const codeOptions = useMemo(
    () =>
      KNOWN_BATCH_PROCEDURE_CODES.map((code) => ({
        value: code,
        label: `${t(`batch.procedures.codes.${code}`)} (${code})`,
      })),
    [t],
  );

  function changeCode(next: string) {
    setForm((c) => ({
      ...c,
      code: next,
      // Prefill the name from the code's label the first time, for convenience.
      name: c.name.trim() ? c.name : t(`batch.procedures.codes.${next}`),
    }));
  }

  const codeUnsupported = form.code.trim().length > 0 && !isExecutableBatchCode(form.code);

  const scheduleOptions = useMemo<Array<{ value: string; label: string }>>(() => {
    const options = SCHEDULE_TYPES.map((value) => ({
      value: value as string,
      label: t(`batch.procedures.schedule.${value}`),
    }));
    const current = initial?.schedule_type;
    if (current && !options.some((o) => o.value === current)) {
      options.push({ value: current, label: current });
    }
    return options;
  }, [initial, t]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    // Parse the optional advanced metadata bag before hitting the API.
    let metadata: Record<string, unknown> | null = null;
    const rawMeta = form.schedule_metadata.trim();
    if (rawMeta.length > 0) {
      try {
        const parsed = JSON.parse(rawMeta);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not-an-object");
        }
        metadata = parsed as Record<string, unknown>;
      } catch {
        setErrors({
          schedule_metadata: t("batch.procedures.fields.metadataInvalid"),
        });
        setSubmitting(false);
        return;
      }
    }

    const payload: BatchProcedureWritePayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      schedule_type: form.schedule_type.trim() || null,
      schedule_metadata: metadata,
      // `code` is immutable — only sent on create.
      ...(isEdit ? {} : { code: form.code.trim() }),
    };
    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        code: t("batch.procedures.fields.code"),
        name: t("batch.procedures.fields.name"),
        description: t("batch.procedures.fields.description"),
        schedule_type: t("batch.procedures.fields.schedule"),
        schedule_metadata: t("batch.procedures.fields.metadata"),
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
          ? t("batch.procedures.drawer.titleEdit")
          : t("batch.procedures.drawer.titleCreate")
      }
      description={t("batch.procedures.drawer.hint")}
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
            form="batch-procedure-form"
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
        id="batch-procedure-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
        noValidate
      >
        {isEdit ? (
          <TextField
            label={t("batch.procedures.fields.code")}
            value={form.code}
            onChange={() => undefined}
            disabled
            hint={t("batch.procedures.fields.codeImmutable")}
          />
        ) : (
          <Select
            label={t("batch.procedures.fields.code")}
            value={form.code}
            options={codeOptions}
            placeholder={t("batch.procedures.fields.codePlaceholder")}
            isSearchable
            onChange={changeCode}
            error={errors.code}
            hint={t("batch.procedures.fields.codeSelectHint")}
          />
        )}
        {codeUnsupported ? (
          <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("batch.procedures.fields.codeNotExecutableWarning")}
          </p>
        ) : null}
        <TextField
          label={t("batch.procedures.fields.name")}
          value={form.name}
          onChange={(event) =>
            setForm((c) => ({ ...c, name: event.target.value }))
          }
          error={errors.name}
          required
        />
        <TextField
          label={t("batch.procedures.fields.description")}
          value={form.description}
          onChange={(event) =>
            setForm((c) => ({ ...c, description: event.target.value }))
          }
          error={errors.description}
        />
        <Select
          label={t("batch.procedures.fields.schedule")}
          value={form.schedule_type}
          options={scheduleOptions}
          placeholder={t("batch.procedures.fields.schedulePlaceholder")}
          isClearable
          onChange={(next) =>
            setForm((c) => ({ ...c, schedule_type: next }))
          }
          error={errors.schedule_type}
          hint={t("batch.procedures.fields.scheduleHint")}
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="batch-procedure-metadata"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("batch.procedures.fields.metadata")}
          </label>
          <textarea
            id="batch-procedure-metadata"
            value={form.schedule_metadata}
            onChange={(event) =>
              setForm((c) => ({ ...c, schedule_metadata: event.target.value }))
            }
            rows={4}
            spellCheck={false}
            placeholder='{ "cron": "0 2 * * *" }'
            className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground transition-colors focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/10"
          />
          {errors.schedule_metadata ? (
            <span className="text-xs text-danger">
              {errors.schedule_metadata}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("batch.procedures.fields.metadataHint")}
            </span>
          )}
        </div>
      </form>
    </Drawer>
  );
}
