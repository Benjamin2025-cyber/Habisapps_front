"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  fetchLedgerAccounts,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import {
  createTill,
  fetchTills,
  updateTill,
  type Till,
  type TillStatus,
  type TillWritePayload,
  type PaginatedTills,
} from "@/lib/api/tills";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { TillsTable } from "./_components/TillsTable";
import { TillDrawer, type TillDrawerMode } from "./_components/TillDrawer";

/**
 * P20 — Caisse › Caisses (référentiel des postes de caisse). CRUD (sans
 * suppression : désactivation via statut). Câblé sur `tills`. Scope agence
 * côté API. Permissions `cash.tills.view` / `cash.tills.manage`.
 */
export default function TillsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.tills.view"]);
  const managePerm = useCanAny(["cash.tills.manage"]);
  const canView = isPlatformAdmin || viewPerm;
  const canManage = isPlatformAdmin || managePerm;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TillStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<TillDrawerMode | null>(null);
  const [editing, setEditing] = useState<Till | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedTills> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchTills(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
  ]);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [tellers, setTellers] = useState<StaffUser[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchAgencies(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchStaffUsers(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchLedgerAccounts(token, { perPage: 100 }).catch(() => ({ data: [] })),
    ]).then(([ag, st, la]) => {
      if (cancelled) return;
      setAgencies(ag.data as Agency[]);
      setTellers(st.data as StaffUser[]);
      setLedgerAccounts(la.data as LedgerAccount[]);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tellerNameOf = useCallback(
    (publicId: string | null) => {
      if (!publicId) return "—";
      return tellers.find((u) => u.public_id === publicId)?.name ?? publicId;
    },
    [tellers],
  );

  const visible = useMemo(() => {
    const rows = data?.data ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((till) => {
      if (statusFilter && till.status !== statusFilter) return false;
      if (needle.length === 0) return true;
      return (
        till.code.toLowerCase().includes(needle) ||
        till.name.toLowerCase().includes(needle)
      );
    });
  }, [data, search, statusFilter]);

  if (session.status !== "authenticated" || !canView) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }
  function openEdit(till: Till) {
    setEditing(till);
    setDrawerMode("edit");
  }
  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(payload: TillWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      const created = await createTill(token, payload);
      toast.success(
        t("tills.toast.createdTitle"),
        t("tills.toast.createdBody", { name: created.name }),
      );
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateTill(token, editing.public_id, payload);
      toast.success(
        t("tills.toast.updatedTitle"),
        t("tills.toast.updatedBody", { name: editing.name }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleSetStatus(till: Till, next: TillStatus) {
    if (!token) return;
    try {
      await updateTill(token, till.public_id, { status: next });
      toast.success(
        t("tills.toast.statusChangedTitle"),
        t("tills.toast.statusChangedBody", {
          name: till.name,
          status: t(`tills.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("tills.toast.errorTitle"), generalMessage);
    }
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("tills.pageTitle")}
        description={t("tills.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              {t("tills.actions.create")}
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="tills-search"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("tills.filters.searchLabel")}
          </label>
          <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              id="tills-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("tills.filters.searchPlaceholder")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
            />
          </div>
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="tills-status"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("tills.filters.statusLabel")}
          </label>
          <Select
            id="tills-status"
            size="sm"
            value={statusFilter}
            options={[
              { value: "active", label: t("tills.status.active") },
              { value: "inactive", label: t("tills.status.inactive") },
            ]}
            placeholder={t("tills.filters.statusAll")}
            isClearable
            onChange={(next) => setStatusFilter(next as TillStatus | "")}
            className="mt-2"
          />
        </div>
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("tills.errorTitle")}
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

      <TillsTable
        rows={visible}
        loading={loading && !data}
        canManage={canManage}
        tellerNameOf={tellerNameOf}
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
      />

      {canManage ? (
        <TillDrawer
          open={drawerMode !== null}
          mode={drawerMode ?? "create"}
          initial={editing}
          agencies={agencies}
          tellers={tellers}
          ledgerAccounts={ledgerAccounts}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}
