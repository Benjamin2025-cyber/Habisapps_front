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
  createOperationAccountMapping,
  deleteOperationAccountMapping,
  fetchOperationAccountMappings,
  updateOperationAccountMapping,
  MAPPING_CREATE_APPROVAL_STATUSES,
  type MappingApprovalStatus,
  type MappingStatus,
  type MappingWritePayload,
  type OperationAccountMapping,
  type PaginatedOperationAccountMappings,
} from "@/lib/api/operation-account-mappings";
import {
  fetchOperationCodes,
  type OperationCode,
} from "@/lib/api/operation-codes";
import {
  fetchLedgerAccounts,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { listAgencies, type Agency } from "@/lib/api/agencies";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

const STATUS_TONE: Record<MappingStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  archived: "danger",
};

const APPROVAL_TONE: Record<
  MappingApprovalStatus,
  "success" | "info" | "neutral" | "warning" | "danger"
> = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  suspended: "warning",
  revoked: "danger",
  expired: "warning",
  archived: "neutral",
};

const ALL_APPROVAL_STATUSES: MappingApprovalStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "suspended",
  "revoked",
  "expired",
  "archived",
];

function short(pid: string | null): string {
  if (!pid) return "—";
  return pid.length > 10 ? `${pid.slice(0, 8)}…` : pid;
}

export function MappingsTab() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const create = useCanAny(["operation.mappings.create"]);
  const update = useCanAny(["operation.mappings.update"]);
  const archive = useCanAny(["operation.mappings.archive"]);
  const canCreate = isPlatformAdmin || create;
  const canUpdate = isPlatformAdmin || update;
  const canArchive = isPlatformAdmin || archive;
  const hasRowActions = canUpdate || canArchive;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<{
    mode: "create" | "edit";
    initial: OperationAccountMapping | null;
  } | null>(null);
  const [confirmArchive, setConfirmArchive] =
    useState<OperationAccountMapping | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Reference data: drive the create pickers AND resolve the resource's bare
  // `*_public_id` references to readable codes/names (the API returns only ids).
  const [codes, setCodes] = useState<OperationCode[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchOperationCodes(token, { perPage: 100 }).then((r) => r.data),
      fetchLedgerAccounts(token, { perPage: 200 }).then((r) => r.data),
      listAgencies(token),
    ])
      .then(([c, a, ag]) => {
        if (cancelled) return;
        setCodes(c);
        setAccounts(a);
        setAgencies(ag);
      })
      .catch(() => {
        /* pickers degrade to ids; non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const codeByPid = useMemo(
    () => new Map(codes.map((c) => [c.public_id, c])),
    [codes],
  );
  const accountByPid = useMemo(
    () => new Map(accounts.map((a) => [a.public_id, a])),
    [accounts],
  );
  const agencyByPid = useMemo(
    () => new Map(agencies.map((a) => [a.public_id, a])),
    [agencies],
  );

  const codeLabel = useCallback(
    (pid: string | null) =>
      pid ? (codeByPid.get(pid)?.code ?? short(pid)) : "—",
    [codeByPid],
  );
  const accountLabel = useCallback(
    (pid: string | null) => {
      if (!pid) return "—";
      const a = accountByPid.get(pid);
      return a ? a.code : short(pid);
    },
    [accountByPid],
  );
  const accountName = useCallback(
    (pid: string | null) => {
      if (!pid) return undefined;
      return accountByPid.get(pid)?.name;
    },
    [accountByPid],
  );

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedOperationAccountMappings> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchOperationAccountMappings(token, {
        page,
        perPage: pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
    },
    [token, page, pageSize, statusFilter, search],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    statusFilter,
    search,
  ]);

  const rows = data?.data ?? [];

  async function handleArchive() {
    if (!token || !confirmArchive) return;
    setArchiving(true);
    try {
      await deleteOperationAccountMapping(token, confirmArchive.public_id);
      toast.success(
        t("operationCodes.mappings.toast.archivedTitle"),
        t("operationCodes.mappings.toast.archivedBody"),
      );
      setConfirmArchive(null);
      refetch();
    } catch (cause) {
      toast.error(
        t("operationCodes.mappings.toast.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    } finally {
      setArchiving(false);
    }
  }

  async function handleSubmit(
    payload: MappingWritePayload,
    mode: "create" | "edit",
    publicId?: string,
  ) {
    if (!token) return;
    if (mode === "create") {
      await createOperationAccountMapping(token, payload);
      toast.success(
        t("operationCodes.mappings.toast.createdTitle"),
        t("operationCodes.mappings.toast.createdBody"),
      );
      setPage(1);
    } else if (publicId) {
      await updateOperationAccountMapping(token, publicId, payload);
      toast.success(
        t("operationCodes.mappings.toast.updatedTitle"),
        t("operationCodes.mappings.toast.updatedBody"),
      );
    }
    setDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<OperationAccountMapping, unknown>[]>(
    () => [
      {
        accessorKey: "operation_code_public_id",
        header: t("operationCodes.mappings.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-foreground">
            {codeLabel(getValue() as string | null)}
          </span>
        ),
      },
      {
        accessorKey: "agency_public_id",
        header: t("operationCodes.mappings.columns.agency"),
        cell: ({ getValue }) => {
          const pid = getValue() as string | null;
          if (!pid)
            return (
              <Badge tone="info">{t("operationCodes.mappings.global")}</Badge>
            );
          return (
            <span className="text-muted-foreground">
              {agencyByPid.get(pid)?.name ?? short(pid)}
            </span>
          );
        },
      },
      {
        accessorKey: "debit_ledger_account_public_id",
        header: t("operationCodes.mappings.columns.debit"),
        cell: ({ getValue }) => {
          const pid = getValue() as string | null;
          return (
            <span
              className="font-mono text-xs tabular-nums text-muted-foreground"
              title={accountName(pid)}
            >
              {accountLabel(pid)}
            </span>
          );
        },
      },
      {
        accessorKey: "credit_ledger_account_public_id",
        header: t("operationCodes.mappings.columns.credit"),
        cell: ({ getValue }) => {
          const pid = getValue() as string | null;
          return (
            <span
              className="font-mono text-xs tabular-nums text-muted-foreground"
              title={accountName(pid)}
            >
              {accountLabel(pid)}
            </span>
          );
        },
      },
      {
        accessorKey: "currency",
        header: t("operationCodes.mappings.columns.currency"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("operationCodes.mappings.columns.status"),
        cell: ({ getValue }) => {
          const v = getValue() as MappingStatus;
          return (
            <Badge tone={STATUS_TONE[v]}>
              {t(`operationCodes.mappings.status.${v}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "approval_status",
        header: t("operationCodes.mappings.columns.approval"),
        cell: ({ getValue }) => {
          const v = getValue() as MappingApprovalStatus;
          return (
            <Badge tone={APPROVAL_TONE[v]}>
              {t(`operationCodes.mappings.approval.${v}`)}
            </Badge>
          );
        },
      },
      ...(hasRowActions
        ? [
            {
              id: "actions",
              header: t("operationCodes.mappings.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const m = row.original;
                const items: DropdownMenuItem[] = [];
                if (canUpdate) {
                  items.push({
                    label: t("operationCodes.mappings.actions.edit"),
                    onClick: () => setDrawer({ mode: "edit", initial: m }),
                  });
                }
                if (canArchive && m.status !== "archived") {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    label: t("operationCodes.mappings.actions.archive"),
                    onClick: () => setConfirmArchive(m),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("operationCodes.mappings.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<OperationAccountMapping, unknown>,
          ]
        : []),
    ],
    [t, hasRowActions, canUpdate, canArchive, codeLabel, accountLabel, accountName, agencyByPid],
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
          title={t("operationCodes.mappings.errorTitle")}
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

      <section className="grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:grid-cols-2">
        <TextField
          label={t("operationCodes.mappings.filters.search")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("operationCodes.mappings.filters.searchPlaceholder")}
        />
        <Select
          label={t("operationCodes.mappings.filters.status")}
          value={statusFilter}
          options={(["active", "inactive", "archived"] as const).map((s) => ({
            value: s,
            label: t(`operationCodes.mappings.status.${s}`),
          }))}
          placeholder={t("operationCodes.mappings.filters.statusAll")}
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
            + {t("operationCodes.mappings.actions.create")}
          </Button>
        </div>
      ) : null}

      <DataTable<OperationAccountMapping>
        columns={columns}
        data={rows}
        loading={loading && !data}
        emptyMessage={t("operationCodes.mappings.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("operationCodes.mappings.listTitle")}
        titleAside={t("operationCodes.mappings.count", {
          count: pageMeta?.total ?? rows.length,
        })}
      />

      {canCreate || canUpdate ? (
        <MappingDrawer
          open={drawer !== null}
          mode={drawer?.mode ?? "create"}
          initial={drawer?.initial ?? null}
          codes={codes}
          accounts={accounts}
          agencies={agencies}
          codeLabel={codeLabel}
          onClose={() => setDrawer(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={confirmArchive !== null}
        title={t("operationCodes.mappings.confirm.archive.title")}
        description={t("operationCodes.mappings.confirm.archive.message")}
        confirmLabel={t("operationCodes.mappings.actions.archive")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={archiving}
        onConfirm={handleArchive}
        onClose={() => setConfirmArchive(null)}
      />
    </div>
  );
}

function MappingDrawer({
  open,
  mode,
  initial,
  codes,
  accounts,
  agencies,
  codeLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: OperationAccountMapping | null;
  codes: OperationCode[];
  accounts: LedgerAccount[];
  agencies: Agency[];
  codeLabel: (pid: string | null) => string;
  onClose: () => void;
  onSubmit: (
    payload: MappingWritePayload,
    mode: "create" | "edit",
    publicId?: string,
  ) => Promise<void>;
}) {
  const t = useTranslations();
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    operation_code_public_id: "",
    agency_public_id: "",
    debit_ledger_account_public_id: "",
    credit_ledger_account_public_id: "",
    currency: "XAF",
    effective_from: "",
    effective_to: "",
    status: "active" as MappingStatus,
    approval_status: "draft" as MappingApprovalStatus,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    setForm({
      operation_code_public_id: initial?.operation_code_public_id ?? "",
      agency_public_id: initial?.agency_public_id ?? "",
      debit_ledger_account_public_id:
        initial?.debit_ledger_account_public_id ?? "",
      credit_ledger_account_public_id:
        initial?.credit_ledger_account_public_id ?? "",
      currency: initial?.currency ?? "XAF",
      effective_from: initial?.effective_from
        ? initial.effective_from.slice(0, 10)
        : "",
      effective_to: initial?.effective_to
        ? initial.effective_to.slice(0, 10)
        : "",
      status: initial?.status ?? "active",
      approval_status: initial?.approval_status ?? "draft",
    });
  }, [open, initial]);

  const codeOptions = useMemo(
    () =>
      codes
        .filter((c) => c.status === "active")
        .map((c) => ({ value: c.public_id, label: `${c.code} — ${c.label}` })),
    [codes],
  );
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.status === "active")
        .map((a) => ({ value: a.public_id, label: `${a.code} — ${a.name}` })),
    [accounts],
  );
  const agencyOptions = useMemo(
    () =>
      agencies
        .filter((a) => a.status === "active")
        .map((a) => ({ value: a.public_id, label: `${a.name} (${a.code})` })),
    [agencies],
  );

  const statusOptions = (
    isEdit
      ? (["active", "inactive", "archived"] as const)
      : (["active", "inactive"] as const)
  ).map((s) => ({ value: s, label: t(`operationCodes.mappings.status.${s}`) }));

  const approvalOptions = (
    isEdit ? ALL_APPROVAL_STATUSES : [...MAPPING_CREATE_APPROVAL_STATUSES]
  ).map((s) => ({ value: s, label: t(`operationCodes.mappings.approval.${s}`) }));

  const noLeg =
    !form.debit_ledger_account_public_id &&
    !form.credit_ledger_account_public_id;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    const base: MappingWritePayload = {
      agency_public_id: form.agency_public_id || null,
      debit_ledger_account_public_id:
        form.debit_ledger_account_public_id || null,
      credit_ledger_account_public_id:
        form.credit_ledger_account_public_id || null,
      currency: form.currency.trim().toUpperCase() || null,
      effective_from: form.effective_from || null,
      effective_to: form.effective_to || null,
      status: form.status,
      approval_status: form.approval_status,
    };
    // operation_code is immutable → only sent on create.
    const payload: MappingWritePayload = isEdit
      ? base
      : { ...base, operation_code_public_id: form.operation_code_public_id };
    try {
      await onSubmit(payload, mode, initial?.public_id);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        operation_code_public_id: t("operationCodes.mappings.fields.code"),
        agency_public_id: t("operationCodes.mappings.fields.agency"),
        debit_ledger_account_public_id: t("operationCodes.mappings.fields.debit"),
        credit_ledger_account_public_id: t(
          "operationCodes.mappings.fields.credit",
        ),
        currency: t("operationCodes.mappings.fields.currency"),
        effective_from: t("operationCodes.mappings.fields.effectiveFrom"),
        effective_to: t("operationCodes.mappings.fields.effectiveTo"),
        status: t("operationCodes.mappings.fields.status"),
        approval_status: t("operationCodes.mappings.fields.approval"),
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
          ? t("operationCodes.mappings.drawer.titleEdit")
          : t("operationCodes.mappings.drawer.titleCreate")
      }
      description={t("operationCodes.mappings.drawer.hint")}
      widthClassName="sm:w-[34rem]"
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
            form="operation-mapping-form"
            disabled={
              submitting ||
              noLeg ||
              (!isEdit && !form.operation_code_public_id)
            }
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
        id="operation-mapping-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
        noValidate
      >
        {isEdit ? (
          <TextField
            label={t("operationCodes.mappings.fields.code")}
            value={codeLabel(form.operation_code_public_id || null)}
            onChange={() => undefined}
            disabled
            hint={t("operationCodes.mappings.fields.codeImmutable")}
          />
        ) : (
          <Select
            label={t("operationCodes.mappings.fields.code")}
            value={form.operation_code_public_id}
            options={codeOptions}
            placeholder={t("operationCodes.mappings.fields.codePlaceholder")}
            isSearchable
            onChange={(next) =>
              setForm((c) => ({ ...c, operation_code_public_id: next }))
            }
            error={errors.operation_code_public_id}
          />
        )}

        <Select
          label={t("operationCodes.mappings.fields.agency")}
          value={form.agency_public_id}
          options={agencyOptions}
          placeholder={t("operationCodes.mappings.fields.agencyPlaceholder")}
          isClearable
          isSearchable
          onChange={(next) =>
            setForm((c) => ({ ...c, agency_public_id: next }))
          }
          error={errors.agency_public_id}
          hint={t("operationCodes.mappings.fields.agencyHint")}
        />

        <Select
          label={t("operationCodes.mappings.fields.debit")}
          value={form.debit_ledger_account_public_id}
          options={accountOptions}
          placeholder={t("operationCodes.mappings.fields.accountPlaceholder")}
          isClearable
          isSearchable
          onChange={(next) =>
            setForm((c) => ({ ...c, debit_ledger_account_public_id: next }))
          }
          error={errors.debit_ledger_account_public_id}
        />
        <Select
          label={t("operationCodes.mappings.fields.credit")}
          value={form.credit_ledger_account_public_id}
          options={accountOptions}
          placeholder={t("operationCodes.mappings.fields.accountPlaceholder")}
          isClearable
          isSearchable
          onChange={(next) =>
            setForm((c) => ({ ...c, credit_ledger_account_public_id: next }))
          }
          error={errors.credit_ledger_account_public_id}
        />
        {noLeg ? (
          <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("operationCodes.mappings.fields.legRequired")}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("operationCodes.mappings.fields.currency")}
            value={form.currency}
            onChange={(event) =>
              setForm((c) => ({
                ...c,
                currency: event.target.value.toUpperCase().slice(0, 3),
              }))
            }
            error={errors.currency}
            hint={t("operationCodes.mappings.fields.currencyHint")}
          />
          <Select
            label={t("operationCodes.mappings.fields.status")}
            value={form.status}
            options={statusOptions}
            onChange={(next) =>
              setForm((c) => ({ ...c, status: next as MappingStatus }))
            }
            error={errors.status}
          />
          <TextField
            label={t("operationCodes.mappings.fields.effectiveFrom")}
            type="date"
            value={form.effective_from}
            onChange={(event) =>
              setForm((c) => ({ ...c, effective_from: event.target.value }))
            }
            error={errors.effective_from}
          />
          <TextField
            label={t("operationCodes.mappings.fields.effectiveTo")}
            type="date"
            value={form.effective_to}
            onChange={(event) =>
              setForm((c) => ({ ...c, effective_to: event.target.value }))
            }
            error={errors.effective_to}
          />
        </div>

        <Select
          label={t("operationCodes.mappings.fields.approval")}
          value={form.approval_status}
          options={approvalOptions}
          onChange={(next) =>
            setForm((c) => ({
              ...c,
              approval_status: next as MappingApprovalStatus,
            }))
          }
          error={errors.approval_status}
          hint={t("operationCodes.mappings.fields.approvalHint")}
        />
      </form>
    </Drawer>
  );
}
