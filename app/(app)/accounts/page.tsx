"use client";

import { clientDisplayName } from "@/lib/format/clientName";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
} from "@/lib/api/ledger-accounts";
import { fetchClients, type Client } from "@/lib/api/clients";
import {
  fetchAccountProducts,
  type AccountProduct,
} from "@/lib/api/account-products";
import {
  createCustomerAccount,
  deleteCustomerAccount,
  fetchCustomerAccounts,
  updateCustomerAccount,
  type CustomerAccount,
  type CustomerAccountStatus,
  type CustomerAccountWritePayload,
  type PaginatedCustomerAccounts,
} from "@/lib/api/customer-accounts";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCan, useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../_components/PageHeader";
import {
  AccountsFilters,
  EMPTY_ACCOUNTS_FILTERS,
  type AccountsFilterState,
} from "./_components/AccountsFilters";
import { AccountsTable } from "./_components/AccountsTable";
import {
  AccountDrawer,
  type AccountDrawerMode,
} from "./_components/AccountDrawer";

/**
 * P7 — Référentiel Comptes clients (liste + CRUD + statut).
 *
 * Les actions de gestion (création / édition / statut / archivage) sont
 * réservées à `platform-admin` côté API ; la liste reste accessible à
 * `customer.accounts.view`. La fiche compte multi-onglets vit dans
 * `accounts/[publicId]`.
 */
export default function AccountsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["customer.accounts.view"]);
  const isPlatformAdmin = useHasRole(["platform-admin"]);
  /*
   * Gated on the permission, not on being the platform administrator. Opening a
   * client account is counter work: the teller who holds
   * `customer.accounts.create` could not see this button, because the check
   * asked which role you had rather than what you were allowed to do. Everywhere
   * else in the app pairs the admin bypass with a permission the way the API
   * does; this screen was the one that did not.
   */
  const managePerm = useCanAny([
    "customer.accounts.create",
    "customer.accounts.update",
  ]);
  // Hook first, combine after: `isPlatformAdmin || useCanAny(...)` short-circuits
  // the hook call and breaks the rules of hooks.
  const canManage = isPlatformAdmin || managePerm;
  const canScopeInstitution = useCan("crm.scope.institution.read");

  const [filters, setFilters] = useState<AccountsFilterState>(
    EMPTY_ACCOUNTS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<AccountDrawerMode | null>(null);
  const [editing, setEditing] = useState<CustomerAccount | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedCustomerAccounts> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchCustomerAccounts(token, {
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

  // Clients power the holder-name column + the create picker; agencies power
  // the create agency picker. Best-effort (first 100) — enough for the form.
  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [products, setProducts] = useState<AccountProduct[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchClients(token, {
        perPage: 100,
        scope: canScopeInstitution ? "all" : undefined,
      }).catch(() => null),
      fetchAgencies(token, { perPage: 100 }).catch(() => null),
      fetchAccountProducts(token, { perPage: 100 }).catch(
        (cause: unknown) => cause,
      ),
    ]).then(([clientsResponse, agenciesResponse, productsResponse]) => {
      if (cancelled) return;
      setClients(clientsResponse?.data ?? []);
      setAgencies(agenciesResponse?.data ?? []);
      // A refused catalogue used to arrive as an empty list, which reads as "this
      // institution has no products" — so the opening form looked broken rather
      // than forbidden, and there was nothing on screen to say which.
      if (
        productsResponse &&
        typeof productsResponse === "object" &&
        "data" in productsResponse
      ) {
        setProducts(productsResponse.data as AccountProduct[]);
        setProductsError(null);
      } else {
        setProducts([]);
        setProductsError(localizeApiError(productsResponse).generalMessage);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, canScopeInstitution]);

  const clientNameOf = useMemo(() => {
    const byId = new Map<string, string>();
    for (const client of clients) {
      const name =
        clientDisplayName(client) || client.client_reference || client.public_id;
      byId.set(client.public_id, name);
    }
    return (publicId: string | null) =>
      publicId ? byId.get(publicId) ?? publicId : "—";
  }, [clients]);

  const productNameOf = useMemo(() => {
    const byId = new Map<string, string>();
    for (const product of products) {
      byId.set(
        product.public_id,
        `${product.name} — ${t(`accountProducts.family.${product.account_family}`)}`,
      );
    }
    return (publicId: string | null) =>
      publicId ? byId.get(publicId) ?? publicId : "—";
  }, [products, t]);

  // Client-side text filter: the index supports `status` server-side but no
  // free-text search yet.
  const visibleAccounts = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    if (needle.length === 0) return data.data;
    return data.data.filter(
      (account) =>
        account.account_number.toLowerCase().includes(needle) ||
        (account.ledger_account_code ?? "").toLowerCase().includes(needle) ||
        (account.account_title ?? "").toLowerCase().includes(needle) ||
        clientNameOf(account.client_public_id).toLowerCase().includes(needle),
    );
  }, [data, filters.query, clientNameOf]);

  if (session.status !== "authenticated" || !allowed) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }

  function openEdit(account: CustomerAccount) {
    setEditing(account);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(payload: CustomerAccountWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      const created = await createCustomerAccount(token, payload);
      toast.success(
        t("accounts.toast.createdTitle"),
        t("accounts.toast.createdBody", { number: created.account_number }),
      );
      setFilters(EMPTY_ACCOUNTS_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateCustomerAccount(token, editing.public_id, payload);
      toast.success(
        t("accounts.toast.updatedTitle"),
        t("accounts.toast.updatedBody", { number: editing.account_number }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleStatusChange(
    account: CustomerAccount,
    next: CustomerAccountStatus,
  ) {
    if (!token) return;
    try {
      await updateCustomerAccount(token, account.public_id, { status: next });
      toast.success(
        t("accounts.toast.statusChangedTitle"),
        t("accounts.toast.statusChangedBody", {
          number: account.account_number,
          status: t(`accounts.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("accounts.toast.statusErrorTitle"), generalMessage);
    }
  }

  async function handleArchive(account: CustomerAccount) {
    if (!token) return;
    try {
      await deleteCustomerAccount(token, account.public_id);
      toast.success(
        t("accounts.toast.archivedTitle"),
        t("accounts.toast.archivedBody", { number: account.account_number }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("accounts.toast.statusErrorTitle"), generalMessage);
    }
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("accounts.pageTitle")}
        description={t("accounts.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("accounts.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <AccountsFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("accounts.errorTitle")}
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

      <AccountsTable
        rows={visibleAccounts}
        loading={loading && !data}
        clientNameOf={clientNameOf}
        productNameOf={productNameOf}
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
        onChangeStatus={handleStatusChange}
        onArchive={handleArchive}
      />

      {canManage ? (
        <AccountDrawer
          open={drawerMode !== null}
          mode={drawerMode ?? "create"}
          initial={editing}
          clients={clients}
          agencies={agencies}
          accountProducts={products}
          accountProductsError={productsError}
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
