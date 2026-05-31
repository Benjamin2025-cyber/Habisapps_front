"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  ALLOWED_TRANSITIONS,
  fetchLoans,
  transitionLoanStatus,
  type Loan,
  type LoanStatus,
  type PaginatedLoans,
} from "@/lib/api/loans";
import { fetchLoanProducts, type LoanProduct } from "@/lib/api/loan-products";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { LOAN_STATUS_TONE } from "../loans/_components/status";

/** Decision-relevant statuses surfaced in the worklist filter. */
const DECISION_STATUSES: LoanStatus[] = ["in_review", "approved", "application"];

/**
 * P15 — Crédit › Décision / Annulation. Worklist des prêts en cours de décision
 * (à l'étude / approuvés / brouillon) avec transitions de statut (soumettre,
 * renvoyer, rejeter…). Les visas détaillés se font sur la fiche prêt.
 */
export default function DecisionPage() {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard([
    "loans.status.transition",
    "loans.approvals.montage",
    "loans.approvals.comptabilite",
    "loans.approvals.controle",
    "loans.approvals.direction",
  ]);

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canTransitionPerm = useCan("loans.status.transition");
  const canTransition = isPlatformAdmin || canTransitionPerm;

  const [statusFilter, setStatusFilter] = useState<LoanStatus>("in_review");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pending, setPending] = useState<{ loan: Loan; to: LoanStatus } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedLoans> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchLoans(token, { page, perPage: pageSize, status: statusFilter });
    },
    [token, page, pageSize, statusFilter],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    statusFilter,
  ]);

  const [products, setProducts] = useState<LoanProduct[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLoanProducts(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setProducts(response.data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const productNameOf = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of products) byId.set(p.public_id, `${p.code} — ${p.name}`);
    return (id: string | null) => (id ? (byId.get(id) ?? id) : "—");
  }, [products]);

  async function confirmTransition() {
    if (!token || !pending) return;
    setSubmitting(true);
    try {
      await transitionLoanStatus(token, pending.loan.public_id, {
        to_status: pending.to,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(
        t("loanDetail.transition.toast.doneTitle"),
        t("loanDetail.transition.toast.doneBody", {
          status: t(`loans.status.${pending.to}`),
        }),
      );
      setPending(null);
      setReason("");
      setNotes("");
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("loanDetail.transition.toast.errorTitle"), generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo<ColumnDef<Loan, unknown>[]>(
    () => [
      {
        accessorKey: "loan_number",
        header: t("decision.columns.number"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: t("decision.columns.product"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {productNameOf(row.original.loan_product_public_id)}
          </span>
        ),
      },
      {
        id: "amount",
        header: t("decision.columns.amount"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const v =
            row.original.approved_principal_minor ??
            row.original.requested_amount_minor;
          return (
            <span className="tabular-nums text-foreground">
              {v !== null && v !== undefined
                ? format.currencyMinor(v, {
                    currency: row.original.currency ?? "XAF",
                  })
                : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("decision.columns.status"),
        cell: ({ getValue }) => {
          const s = getValue() as LoanStatus;
          return <Badge tone={LOAN_STATUS_TONE[s]}>{t(`loans.status.${s}`)}</Badge>;
        },
      },
      {
        id: "actions",
        header: t("decision.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const loan = row.original;
          const items: DropdownMenuItem[] = [
            {
              label: t("decision.actions.openFile"),
              onClick: () => router.push(`/credit/loans/${loan.public_id}`),
            },
          ];
          const targets = canTransition
            ? (ALLOWED_TRANSITIONS[loan.status] ?? [])
            : [];
          if (targets.length > 0) {
            items.push({ kind: "separator" });
            for (const to of targets) {
              items.push({
                label: t(`loanDetail.transition.to.${to}`),
                onClick: () => {
                  setPending({ loan, to });
                  setReason("");
                  setNotes("");
                },
                destructive: to === "rejected",
              });
            }
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu
                trigger={<MoreVerticalIcon className="h-4 w-4" />}
                triggerLabel={t("decision.actions.menu")}
                items={items}
                align="right"
              />
            </div>
          );
        },
      },
    ],
    [t, format, productNameOf, canTransition, router],
  );

  if (session.status !== "authenticated" || !allowed) return null;

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
    <>
      <PageHeader
        title={t("decision.pageTitle")}
        description={t("decision.pageDescription")}
      />

      <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:max-w-xs">
        <label
          htmlFor="decision-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("decision.filterLabel")}
        </label>
        <Select
          id="decision-status"
          value={statusFilter}
          options={DECISION_STATUSES.map((s) => ({
            value: s,
            label: t(`loans.status.${s}`),
          }))}
          onChange={(next) => {
            setStatusFilter(next as LoanStatus);
            setPage(1);
          }}
        />
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("decision.errorTitle")}
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

      <DataTable<Loan>
        columns={columns}
        data={data?.data ?? []}
        loading={loading && !data}
        emptyMessage={t("decision.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("decision.list.title")}
        titleAside={t("decision.list.count", {
          count: pageMeta?.total ?? data?.data.length ?? 0,
        })}
      />

      <Drawer
        open={pending !== null}
        onClose={submitting ? () => undefined : () => setPending(null)}
        title={
          pending
            ? t("loanDetail.transition.drawer.title", {
                status: t(`loans.status.${pending.to}`),
              })
            : ""
        }
        description={t("loanDetail.transition.drawer.hint")}
        widthClassName="sm:w-[28rem]"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={pending?.to === "rejected" ? "danger" : "primary"}
              size="md"
              type="button"
              onClick={confirmTransition}
              disabled={submitting}
            >
              {submitting
                ? t("common.loading")
                : t("loanDetail.transition.drawer.confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label={t("loanDetail.transition.drawer.reasonLabel")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint={t("loanDetail.transition.drawer.reasonHint")}
          />
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("loanDetail.transition.drawer.notesLabel")}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>
      </Drawer>
    </>
  );
}
