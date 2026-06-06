"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  createLoanProduct,
  deleteLoanProduct,
  fetchLoanProducts,
  updateLoanProduct,
  type LoanProduct,
  type LoanProductWritePayload,
  type PaginatedLoanProducts,
} from "@/lib/api/loan-products";
import {
  fetchLedgerAccounts,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  LoanProductsFilters,
  EMPTY_LOAN_PRODUCTS_FILTERS,
  type LoanProductsFilterState,
} from "./_components/LoanProductsFilters";
import { LoanProductsTable } from "./_components/LoanProductsTable";
import {
  LoanProductDrawer,
  type LoanProductDrawerMode,
} from "./_components/LoanProductDrawer";

/**
 * P10 — Crédit › Produits (catalogue des types de prêt).
 *
 * Référentiel géré par le super-admin (`platform-admin` ou les permissions
 * `loan.products.*`). Câblé sur le CRUD `loan-products` (archive via DELETE).
 */
export default function LoanProductsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canViewPerm = useCanAny(["loan.products.view"]);
  const canManagePerm = useCanAny([
    "loan.products.create",
    "loan.products.update",
    "loan.products.archive",
  ]);
  const canView = isPlatformAdmin || canViewPerm;
  const canManage = isPlatformAdmin || canManagePerm;

  const [filters, setFilters] = useState<LoanProductsFilterState>(
    EMPTY_LOAN_PRODUCTS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<LoanProductDrawerMode | null>(
    null,
  );
  const [editing, setEditing] = useState<LoanProduct | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  // Active ledger accounts power the product's default-account picker.
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLedgerAccounts(token, { perPage: 200 })
      .then((res) => {
        if (!cancelled) setLedgerAccounts(res.data);
      })
      .catch(() => {
        if (!cancelled) setLedgerAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedLoanProducts> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchLoanProducts(token, {
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

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    if (needle.length === 0) return data.data;
    return data.data.filter(
      (product) =>
        product.code.toLowerCase().includes(needle) ||
        product.name.toLowerCase().includes(needle),
    );
  }, [data, filters.query]);

  if (session.status !== "authenticated" || !canView) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }

  function openEdit(product: LoanProduct) {
    setEditing(product);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(payload: LoanProductWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      const created = await createLoanProduct(token, payload);
      toast.success(
        t("loanProducts.toast.createdTitle"),
        t("loanProducts.toast.createdBody", { name: created.name }),
      );
      setFilters(EMPTY_LOAN_PRODUCTS_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateLoanProduct(token, editing.public_id, payload);
      toast.success(
        t("loanProducts.toast.updatedTitle"),
        t("loanProducts.toast.updatedBody", { name: editing.name }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleSetStatus(
    product: LoanProduct,
    next: "active" | "inactive",
  ) {
    if (!token) return;
    try {
      await updateLoanProduct(token, product.public_id, { status: next });
      toast.success(
        t("loanProducts.toast.statusChangedTitle"),
        t("loanProducts.toast.statusChangedBody", {
          name: product.name,
          status: t(`loanProducts.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("loanProducts.toast.errorTitle"), generalMessage);
    }
  }

  async function handleArchive(product: LoanProduct) {
    if (!token) return;
    try {
      await deleteLoanProduct(token, product.public_id);
      toast.success(
        t("loanProducts.toast.archivedTitle"),
        t("loanProducts.toast.archivedBody", { name: product.name }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("loanProducts.toast.errorTitle"), generalMessage);
    }
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("loanProducts.pageTitle")}
        description={t("loanProducts.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("loanProducts.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <LoanProductsFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("loanProducts.errorTitle")}
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

      <LoanProductsTable
        rows={visibleProducts}
        loading={loading && !data}
        canManage={canManage}
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
        onEdit={openEdit}
        onSetStatus={handleSetStatus}
        onArchive={handleArchive}
      />

      {canManage ? (
        <LoanProductDrawer
          open={drawerMode !== null}
          mode={drawerMode ?? "create"}
          initial={editing}
          ledgerAccounts={ledgerAccounts}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
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
