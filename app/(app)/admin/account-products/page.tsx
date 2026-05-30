"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  createAccountProduct,
  deleteAccountProduct,
  fetchAccountProducts,
  updateAccountProduct,
  type AccountProduct,
  type AccountProductWritePayload,
  type PaginatedAccountProducts,
} from "@/lib/api/account-products";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  AccountProductsFilters,
  EMPTY_ACCOUNT_PRODUCTS_FILTERS,
  type AccountProductsFilterState,
} from "./_components/AccountProductsFilters";
import { AccountProductsTable } from "./_components/AccountProductsTable";
import {
  AccountProductDrawer,
  type AccountProductDrawerMode,
} from "./_components/AccountProductDrawer";

/**
 * P7+ — Paramétrage des produits de compte (catalogue des types de compte).
 *
 * Cette page n'existe pas dans les maquettes PDF : elle complète le CRUD du
 * référentiel `account-products`, géré par le super-admin (`platform-admin`
 * ou les permissions `account.products.*`).
 */
export default function AccountProductsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canViewPerm = useCanAny(["account.products.view"]);
  const canManagePerm = useCanAny([
    "account.products.create",
    "account.products.update",
    "account.products.archive",
  ]);
  const canView = isPlatformAdmin || canViewPerm;
  const canManage = isPlatformAdmin || canManagePerm;

  const [filters, setFilters] = useState<AccountProductsFilterState>(
    EMPTY_ACCOUNT_PRODUCTS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [drawerMode, setDrawerMode] = useState<AccountProductDrawerMode | null>(
    null,
  );
  const [editing, setEditing] = useState<AccountProduct | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedAccountProducts> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchAccountProducts(token, {
        page,
        perPage: 100,
        accountFamily: filters.family || undefined,
        status: filters.status || undefined,
      });
    },
    [token, page, filters.family, filters.status],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    filters.family,
    filters.status,
  ]);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAgencies(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setAgencies(response.data);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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

  function openEdit(product: AccountProduct) {
    setEditing(product);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(payload: AccountProductWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      const created = await createAccountProduct(token, payload);
      toast.success(
        t("accountProducts.toast.createdTitle"),
        t("accountProducts.toast.createdBody", { name: created.name }),
      );
      setFilters(EMPTY_ACCOUNT_PRODUCTS_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateAccountProduct(token, editing.public_id, payload);
      toast.success(
        t("accountProducts.toast.updatedTitle"),
        t("accountProducts.toast.updatedBody", { name: editing.name }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleSetStatus(
    product: AccountProduct,
    next: "active" | "inactive",
  ) {
    if (!token) return;
    try {
      await updateAccountProduct(token, product.public_id, { status: next });
      toast.success(
        t("accountProducts.toast.statusChangedTitle"),
        t("accountProducts.toast.statusChangedBody", {
          name: product.name,
          status: t(`accountProducts.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("accountProducts.toast.errorTitle"), generalMessage);
    }
  }

  async function handleArchive(product: AccountProduct) {
    if (!token) return;
    try {
      await deleteAccountProduct(token, product.public_id);
      toast.success(
        t("accountProducts.toast.archivedTitle"),
        t("accountProducts.toast.archivedBody", { name: product.name }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("accountProducts.toast.errorTitle"), generalMessage);
    }
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("accountProducts.pageTitle")}
        description={t("accountProducts.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("accountProducts.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <AccountProductsFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("accountProducts.errorTitle")}
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

      <AccountProductsTable
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
              }
            : undefined
        }
        onEdit={openEdit}
        onSetStatus={handleSetStatus}
        onArchive={handleArchive}
      />

      {canManage ? (
        <AccountProductDrawer
          open={drawerMode !== null}
          mode={drawerMode ?? "create"}
          initial={editing}
          agencies={agencies}
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
