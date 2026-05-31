"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import {
  disburseLoan,
  fetchLoans,
  type Loan,
  type LoanDisbursePayload,
  type PaginatedLoans,
} from "@/lib/api/loans";
import { fetchLoanProducts, type LoanProduct } from "@/lib/api/loan-products";
import { localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { LOAN_STATUS_TONE } from "../loans/_components/status";
import { DisburseDrawer } from "./_components/DisburseDrawer";

/**
 * P15 — Crédit › Déblocage. Worklist des prêts **approuvés** prêts à être
 * décaissés. Le décaissement crée une écriture comptable — il nécessite donc
 * les comptes comptables (P16) ; à défaut l'API renvoie un message clair.
 */
export default function DisbursementPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["loans.disburse"]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [target, setTarget] = useState<Loan | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedLoans> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchLoans(token, { page, perPage: pageSize, status: "approved" });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
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

  async function handleDisburse(payload: LoanDisbursePayload) {
    if (!token || !target) return;
    await disburseLoan(token, target.public_id, payload);
    toast.success(
      t("disbursement.toast.doneTitle"),
      t("disbursement.toast.doneBody", { number: target.loan_number ?? "" }),
    );
    setTarget(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<Loan, unknown>[]>(
    () => [
      {
        accessorKey: "loan_number",
        header: t("disbursement.columns.number"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: t("disbursement.columns.product"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {productNameOf(row.original.loan_product_public_id)}
          </span>
        ),
      },
      {
        id: "amount",
        header: t("disbursement.columns.amount"),
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
        header: t("disbursement.columns.status"),
        cell: ({ getValue }) => {
          const s = getValue() as Loan["status"];
          return <Badge tone={LOAN_STATUS_TONE[s]}>{t(`loans.status.${s}`)}</Badge>;
        },
      },
      {
        id: "actions",
        header: t("disbursement.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setTarget(row.original)}>
              {t("disbursement.actions.disburse")}
            </Button>
          </div>
        ),
      },
    ],
    [t, format, productNameOf],
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
        title={t("disbursement.pageTitle")}
        description={t("disbursement.pageDescription")}
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("disbursement.errorTitle")}
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
        emptyMessage={t("disbursement.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("disbursement.list.title")}
        titleAside={t("disbursement.list.count", {
          count: pageMeta?.total ?? data?.data.length ?? 0,
        })}
      />

      <DisburseDrawer
        open={target !== null}
        loan={target}
        onClose={() => setTarget(null)}
        onSubmit={handleDisburse}
      />
    </>
  );
}
