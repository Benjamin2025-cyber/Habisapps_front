"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  createLoan,
  fetchLoans,
  type LoanWritePayload,
  type PaginatedLoans,
} from "@/lib/api/loans";
import {
  fetchLoanProducts,
  type LoanProduct,
} from "@/lib/api/loan-products";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  LoansFilters,
  EMPTY_LOANS_FILTERS,
  type LoansFilterState,
} from "./_components/LoansFilters";
import { LoansTable } from "./_components/LoansTable";
import { LoanDrawer } from "./_components/LoanDrawer";

/**
 * P11 — Crédit › Mise en place. Liste des prêts + création d'un brouillon
 * (statut `application`). La création redirige vers la fiche prêt où l'on
 * affine les informations, génère le tableau d'amortissement et fait viser.
 */
export default function LoansPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const router = useRouter();
  const allowed = usePermissionGuard(["loans.view"]);

  const canCreate = useCan("loans.create");

  const [filters, setFilters] = useState<LoansFilterState>(EMPTY_LOANS_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedLoans> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchLoans(token, {
        page,
        perPage: pageSize,
        status: filters.status || undefined,
      });
    },
    [token, page, pageSize, filters.status],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    filters.status,
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
    for (const product of products) {
      byId.set(product.public_id, `${product.code} — ${product.name}`);
    }
    return (publicId: string | null) =>
      publicId ? byId.get(publicId) ?? publicId : "—";
  }, [products]);

  const visibleLoans = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    if (needle.length === 0) return data.data;
    return data.data.filter((loan) =>
      (loan.loan_number ?? "").toLowerCase().includes(needle),
    );
  }, [data, filters.query]);

  if (session.status !== "authenticated" || !allowed) return null;

  async function handleCreate(payload: LoanWritePayload) {
    if (!token) return;
    const created = await createLoan(token, payload);
    toast.success(
      t("loans.toast.createdTitle"),
      t("loans.toast.createdBody", { number: created.loan_number ?? "" }),
    );
    setDrawerOpen(false);
    router.push(`/credit/loans/${created.public_id}`);
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("loans.pageTitle")}
        description={t("loans.pageDescription")}
        actions={
          canCreate ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setDrawerOpen(true)}
            >
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("loans.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <LoansFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("loans.errorTitle")}
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

      <LoansTable
        rows={visibleLoans}
        loading={loading && !data}
        productNameOf={productNameOf}
        pagination={
          pageMeta
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
            : undefined
        }
      />

      {canCreate ? (
        <LoanDrawer
          open={drawerOpen}
          mode="create"
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
