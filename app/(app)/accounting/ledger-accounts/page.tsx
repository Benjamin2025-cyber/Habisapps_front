"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  createLedgerAccount,
  deleteLedgerAccount,
  fetchLedgerAccounts,
  updateLedgerAccount,
  type LedgerAccount,
  type LedgerAccountCreatePayload,
  type LedgerAccountUpdatePayload,
  type PaginatedLedgerAccounts,
} from "@/lib/api/ledger-accounts";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  LedgerAccountsFilters,
  EMPTY_LEDGER_ACCOUNTS_FILTERS,
  type LedgerAccountsFilterState,
} from "./_components/LedgerAccountsFilters";
import { LedgerAccountsTable } from "./_components/LedgerAccountsTable";
import {
  LedgerAccountDrawer,
  type LedgerAccountDrawerMode,
} from "./_components/LedgerAccountDrawer";
import { LedgerAccountDetailDrawer } from "./_components/LedgerAccountDetailDrawer";

/**
 * P16 — Comptabilité › Comptes généraux (plan comptable).
 *
 * CRUD du référentiel `ledger-accounts` + consultation du solde et des
 * mouvements (relevé) par compte. C'est le socle comptable qui rend possibles
 * les mouvements monétaires (déblocage, recouvrement) une fois les comptes et
 * leurs imputations configurés. Permissions `ledger.accounts.*`.
 */
export default function LedgerAccountsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canViewPerm = useCanAny(["ledger.accounts.view"]);
  const canManagePerm = useCanAny([
    "ledger.accounts.create",
    "ledger.accounts.update",
    "ledger.accounts.archive",
  ]);
  const canView = isPlatformAdmin || canViewPerm;
  const canManage = isPlatformAdmin || canManagePerm;

  const [filters, setFilters] = useState<LedgerAccountsFilterState>(
    EMPTY_LEDGER_ACCOUNTS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<LedgerAccountDrawerMode | null>(
    null,
  );
  const [editing, setEditing] = useState<LedgerAccount | null>(null);
  const [detail, setDetail] = useState<LedgerAccount | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<LedgerAccount | null>(null);
  const [archiving, setArchiving] = useState(false);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedLedgerAccounts> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchLedgerAccounts(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
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

  // Filtering is client-side: the index endpoint exposes no server filters,
  // and the chart of accounts is a bounded referential.
  const visibleAccounts = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    return data.data.filter((account) => {
      if (filters.accountClass && account.account_class !== filters.accountClass)
        return false;
      if (filters.status && account.status !== filters.status) return false;
      if (needle.length === 0) return true;
      return (
        account.code.toLowerCase().includes(needle) ||
        account.name.toLowerCase().includes(needle)
      );
    });
  }, [data, filters]);

  // Parent choices come from active accounts on the loaded page.
  const parentChoices = useMemo(
    () => (data?.data ?? []).filter((a) => a.status !== "archived"),
    [data],
  );

  if (session.status !== "authenticated" || !canView) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }

  function openEdit(account: LedgerAccount) {
    setEditing(account);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(
    payload: LedgerAccountCreatePayload | LedgerAccountUpdatePayload,
  ) {
    if (!token) return;
    if (drawerMode === "create") {
      const created = await createLedgerAccount(
        token,
        payload as LedgerAccountCreatePayload,
      );
      toast.success(
        t("ledgerAccounts.toast.createdTitle"),
        t("ledgerAccounts.toast.createdBody", { name: created.name }),
      );
      setFilters(EMPTY_LEDGER_ACCOUNTS_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateLedgerAccount(
        token,
        editing.public_id,
        payload as LedgerAccountUpdatePayload,
      );
      toast.success(
        t("ledgerAccounts.toast.updatedTitle"),
        t("ledgerAccounts.toast.updatedBody", { name: editing.name }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleSetStatus(
    account: LedgerAccount,
    next: "active" | "inactive",
  ) {
    if (!token) return;
    try {
      await updateLedgerAccount(token, account.public_id, { status: next });
      toast.success(
        t("ledgerAccounts.toast.statusChangedTitle"),
        t("ledgerAccounts.toast.statusChangedBody", {
          name: account.name,
          status: t(`ledgerAccounts.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("ledgerAccounts.toast.errorTitle"), generalMessage);
    }
  }

  async function confirmArchive() {
    if (!token || !archiveTarget) return;
    setArchiving(true);
    try {
      await deleteLedgerAccount(token, archiveTarget.public_id);
      toast.success(
        t("ledgerAccounts.toast.archivedTitle"),
        t("ledgerAccounts.toast.archivedBody", { name: archiveTarget.name }),
      );
      setArchiveTarget(null);
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("ledgerAccounts.toast.errorTitle"), generalMessage);
    } finally {
      setArchiving(false);
    }
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("ledgerAccounts.pageTitle")}
        description={t("ledgerAccounts.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("ledgerAccounts.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <LedgerAccountsFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("ledgerAccounts.errorTitle")}
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

      <LedgerAccountsTable
        rows={visibleAccounts}
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
        onView={setDetail}
        onEdit={openEdit}
        onSetStatus={handleSetStatus}
        onArchive={setArchiveTarget}
      />

      {canManage ? (
        <LedgerAccountDrawer
          open={drawerMode !== null}
          mode={drawerMode ?? "create"}
          initial={editing}
          agencies={agencies}
          parentChoices={parentChoices}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      ) : null}

      <LedgerAccountDetailDrawer
        open={detail !== null}
        account={detail}
        onClose={() => setDetail(null)}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title={t("ledgerAccounts.archive.title")}
        description={t("ledgerAccounts.archive.body", {
          name: archiveTarget?.name ?? "",
        })}
        confirmLabel={t("ledgerAccounts.archive.confirm")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={archiving}
        busyLabel={t("common.loading")}
        onConfirm={confirmArchive}
        onClose={() => (archiving ? undefined : setArchiveTarget(null))}
      />
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
