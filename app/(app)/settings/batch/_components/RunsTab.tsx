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
  cancelBatchRun,
  createBatchRun,
  executeBatchRun,
  fetchBatchRuns,
  retryBatchRun,
  type BatchRun,
  type BatchRunStatus,
  type PaginatedBatchRuns,
} from "@/lib/api/batch-runs";
import {
  fetchBatchProcedures,
  type BatchProcedure,
} from "@/lib/api/batch-procedures";
import { listAgencies, type Agency } from "@/lib/api/agencies";
import { isExecutableBatchCode } from "@/lib/catalogs/batch-procedure-codes";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

const RUN_STATUSES: BatchRunStatus[] = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
];

const STATUS_TONE: Record<
  BatchRunStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  pending: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warning",
};

/**
 * Close-control procedures are driven by the accounting-day close (they need a
 * linked accounting day and can't be executed standalone). We warn if one is
 * picked in the manual runner. Mirrors the backend close-control code set.
 */
const CLOSE_CONTROL_CODES = new Set([
  "accounting_close_verification",
  "accounting_daily_close",
  "journal_close_verification",
  "cash_close_verification",
  "cash_daily_close",
  "agency_cash_close",
]);

function fmtTs(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "—";
}

export function RunsTab() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const manageRuns = useCanAny(["batch.runs.manage"]);
  const canManage = isPlatformAdmin || manageRuns;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [procedureFilter, setProcedureFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<BatchRunStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<BatchRun | null>(null);
  const [confirm, setConfirm] = useState<{
    run: BatchRun;
    action: "execute" | "retry" | "cancel";
  } | null>(null);
  const [acting, setActing] = useState(false);

  // Procedures power the create form + the procedure filter. Pull a generous
  // page; the catalog is small (seeded handful).
  const [procedures, setProcedures] = useState<BatchProcedure[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchBatchProcedures(token, { perPage: 100 })
      .then((res) => {
        if (!cancelled) setProcedures(res.data);
      })
      .catch(() => {
        if (!cancelled) setProcedures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedBatchRuns> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchBatchRuns(token, {
        page,
        perPage: pageSize,
        procedurePublicId: procedureFilter || undefined,
        status: statusFilter || undefined,
        businessDateFrom: dateFrom || undefined,
        businessDateTo: dateTo || undefined,
      });
    },
    [token, page, pageSize, procedureFilter, statusFilter, dateFrom, dateTo],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    procedureFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  const rows = data?.data ?? [];

  const procedureOptions = useMemo(
    () =>
      procedures.map((p) => ({
        value: p.public_id,
        label: `${p.name} (${p.code})`,
      })),
    [procedures],
  );

  async function runAction(
    run: BatchRun,
    action: "execute" | "retry" | "cancel",
  ) {
    if (!token) return;
    setActing(true);
    try {
      if (action === "execute") await executeBatchRun(token, run.public_id);
      else if (action === "retry") await retryBatchRun(token, run.public_id);
      else await cancelBatchRun(token, run.public_id);
      toast.success(
        t("batch.runs.toast.actionTitle"),
        t("batch.runs.toast.actionBody", {
          action: t(`batch.runs.actions.${action}`),
        }),
      );
      setConfirm(null);
      refetch();
    } catch (cause) {
      toast.error(
        t("batch.runs.toast.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    } finally {
      setActing(false);
    }
  }

  const columns = useMemo<ColumnDef<BatchRun, unknown>[]>(
    () => [
      {
        accessorKey: "batch_procedure_code",
        header: t("batch.runs.columns.procedure"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "business_date",
        header: t("batch.runs.columns.businessDate"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {((getValue() as string | null) ?? "—").slice(0, 10)}
          </span>
        ),
      },
      {
        accessorKey: "agency_code",
        header: t("batch.runs.columns.agency"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? t("batch.runs.institution")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("batch.runs.columns.status"),
        cell: ({ getValue }) => {
          const v = getValue() as BatchRunStatus;
          return <Badge tone={STATUS_TONE[v]}>{t(`batch.runs.status.${v}`)}</Badge>;
        },
      },
      {
        accessorKey: "finished_at",
        header: t("batch.runs.columns.finishedAt"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {fmtTs(getValue() as string | null)}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("batch.runs.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const run = row.original;
          const items: DropdownMenuItem[] = [
            {
              label: t("batch.runs.actions.details"),
              onClick: () => setDetail(run),
            },
          ];
          if (canManage) {
            if (run.status === "pending") {
              items.push({
                label: t("batch.runs.actions.execute"),
                onClick: () => setConfirm({ run, action: "execute" }),
              });
              if (!run.started_at) {
                items.push({
                  label: t("batch.runs.actions.cancel"),
                  onClick: () => setConfirm({ run, action: "cancel" }),
                  destructive: true,
                });
              }
            }
            if (run.status === "failed" || run.status === "cancelled") {
              items.push({
                label: t("batch.runs.actions.retry"),
                onClick: () => setConfirm({ run, action: "retry" }),
              });
            }
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu
                trigger={<MoreVerticalIcon className="h-4 w-4" />}
                triggerLabel={t("batch.runs.actions.menu")}
                items={items}
                align="right"
              />
            </div>
          );
        },
      },
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
          title={t("batch.runs.errorTitle")}
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

      <section className="grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label={t("batch.runs.filters.procedure")}
          value={procedureFilter}
          options={procedureOptions}
          placeholder={t("batch.runs.filters.procedureAll")}
          isClearable
          isSearchable
          onChange={(next) => {
            setProcedureFilter(next);
            setPage(1);
          }}
        />
        <Select
          label={t("batch.runs.filters.status")}
          value={statusFilter}
          options={RUN_STATUSES.map((s) => ({
            value: s,
            label: t(`batch.runs.status.${s}`),
          }))}
          placeholder={t("batch.runs.filters.statusAll")}
          isClearable
          onChange={(next) => {
            setStatusFilter(next as BatchRunStatus | "");
            setPage(1);
          }}
        />
        <TextField
          label={t("batch.runs.filters.dateFrom")}
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
        />
        <TextField
          label={t("batch.runs.filters.dateTo")}
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
        />
      </section>

      {canManage ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            + {t("batch.runs.actions.create")}
          </Button>
        </div>
      ) : null}

      <DataTable<BatchRun>
        columns={columns}
        data={rows}
        loading={loading && !data}
        emptyMessage={t("batch.runs.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("batch.runs.listTitle")}
        titleAside={t("batch.runs.count", {
          count: pageMeta?.total ?? rows.length,
        })}
        onRowClick={(row) => setDetail(row)}
      />

      {canManage ? (
        <RunCreateDrawer
          open={createOpen}
          procedures={procedures}
          allowAgency={isPlatformAdmin}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setPage(1);
            refetch();
          }}
        />
      ) : null}

      <RunDetailDrawer
        run={detail}
        onClose={() => setDetail(null)}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm ? t(`batch.runs.confirm.${confirm.action}.title`) : ""
        }
        description={
          confirm ? t(`batch.runs.confirm.${confirm.action}.message`) : ""
        }
        confirmLabel={
          confirm ? t(`batch.runs.actions.${confirm.action}`) : ""
        }
        cancelLabel={t("common.cancel")}
        tone={confirm?.action === "cancel" ? "danger" : "primary"}
        loading={acting}
        onConfirm={() => confirm && runAction(confirm.run, confirm.action)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function RunCreateDrawer({
  open,
  procedures,
  allowAgency,
  onClose,
  onCreated,
}: {
  open: boolean;
  procedures: BatchProcedure[];
  allowAgency: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const [procedureId, setProcedureId] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [agencyCode, setAgencyCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  useEffect(() => {
    if (!open || !token || !allowAgency) return;
    let cancelled = false;
    listAgencies(token, { status: "active" })
      .then((list) => {
        if (!cancelled) setAgencies(list);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, allowAgency]);

  useEffect(() => {
    if (!open) return;
    setProcedureId("");
    setBusinessDate("");
    setAgencyCode("");
    setErrors({});
    setGeneralError(null);
  }, [open]);

  // Only active procedures can be executed; surface them all but flag inactive.
  const procedureOptions = useMemo(
    () =>
      procedures.map((p) => ({
        value: p.public_id,
        label:
          p.status === "active"
            ? `${p.name} (${p.code})`
            : `${p.name} (${p.code}) — ${t("batch.procedures.status.inactive")}`,
      })),
    [procedures, t],
  );

  const selected = procedures.find((p) => p.public_id === procedureId);
  const isCloseControl = selected
    ? CLOSE_CONTROL_CODES.has(selected.code)
    : false;
  const isInactive = selected?.status === "inactive";
  // The procedure exists but its code has no backend handler → a run of it will
  // fail at execute. (Close-control codes ARE executable, just not standalone,
  // so they're covered by their own warning above — not this one.)
  const isNotExecutable = selected
    ? !isExecutableBatchCode(selected.code)
    : false;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      await createBatchRun(token, {
        batch_procedure_public_id: procedureId,
        business_date: businessDate,
        agency_code: agencyCode || null,
      });
      toast.success(
        t("batch.runs.toast.createdTitle"),
        t("batch.runs.toast.createdBody"),
      );
      onCreated();
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        batch_procedure_public_id: t("batch.runs.fields.procedure"),
        business_date: t("batch.runs.fields.businessDate"),
        agency_code: t("batch.runs.fields.agency"),
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
      title={t("batch.runs.drawer.titleCreate")}
      description={t("batch.runs.drawer.hint")}
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
            form="batch-run-form"
            disabled={submitting || !procedureId || !businessDate}
          >
            {submitting ? t("common.loading") : t("batch.runs.drawer.submit")}
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
        id="batch-run-form"
        onSubmit={submit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Select
          label={t("batch.runs.fields.procedure")}
          value={procedureId}
          options={procedureOptions}
          placeholder={t("batch.runs.fields.procedurePlaceholder")}
          isSearchable
          onChange={setProcedureId}
          error={errors.batch_procedure_public_id}
        />
        {isNotExecutable ? (
          <p className="rounded-[var(--radius-field)] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-foreground">
            {t("batch.runs.fields.notExecutableWarning")}
          </p>
        ) : null}
        {isCloseControl ? (
          <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("batch.runs.fields.closeControlWarning")}
          </p>
        ) : null}
        {isInactive ? (
          <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("batch.runs.fields.inactiveWarning")}
          </p>
        ) : null}
        <TextField
          label={t("batch.runs.fields.businessDate")}
          type="date"
          value={businessDate}
          onChange={(event) => setBusinessDate(event.target.value)}
          error={errors.business_date}
          required
          hint={t("batch.runs.fields.businessDateHint")}
        />
        {allowAgency ? (
          <Select
            label={t("batch.runs.fields.agency")}
            value={agencyCode}
            options={agencies.map((a) => ({
              value: a.code,
              label: `${a.name} (${a.code})`,
            }))}
            placeholder={t("batch.runs.fields.agencyPlaceholder")}
            isClearable
            isSearchable
            onChange={setAgencyCode}
            error={errors.agency_code}
            hint={t("batch.runs.fields.agencyHint")}
          />
        ) : null}
      </form>
    </Drawer>
  );
}

function RunDetailDrawer({
  run,
  onClose,
}: {
  run: BatchRun | null;
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <Drawer
      open={run !== null}
      onClose={onClose}
      title={t("batch.runs.detail.title")}
      description={run?.batch_procedure_code ?? undefined}
      footer={
        <Button variant="ghost" size="md" type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {run ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Detail label={t("batch.runs.detail.procedure")} value={run.batch_procedure_code} mono />
            <Detail label={t("batch.runs.detail.status")} value={t(`batch.runs.status.${run.status}`)} />
            <Detail label={t("batch.runs.detail.businessDate")} value={run.business_date?.slice(0, 10)} mono />
            <Detail
              label={t("batch.runs.detail.agency")}
              value={run.agency_code ?? t("batch.runs.institution")}
            />
            <Detail label={t("batch.runs.detail.startedAt")} value={fmtTs(run.started_at)} mono />
            <Detail label={t("batch.runs.detail.finishedAt")} value={fmtTs(run.finished_at)} mono />
            {run.accounting_day_public_id ? (
              <Detail
                label={t("batch.runs.detail.accountingDay")}
                value={run.accounting_day_status ?? "—"}
              />
            ) : null}
          </dl>

          {run.failure_reason ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("batch.runs.detail.failureReason")}
              </span>
              <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                {run.failure_reason}
              </p>
            </div>
          ) : null}

          {run.summary_payload && Object.keys(run.summary_payload).length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("batch.runs.detail.summary")}
              </span>
              <pre className="overflow-x-auto rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                {JSON.stringify(run.summary_payload, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("batch.runs.detail.noSummary")}
            </p>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-sm tabular-nums text-foreground"
            : "text-sm text-foreground"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
