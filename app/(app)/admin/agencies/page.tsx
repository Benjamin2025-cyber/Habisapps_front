"use client";

import { useCallback, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  archiveAgency,
  createAgency,
  fetchAgencies,
  updateAgency,
  updateAgencyManager,
  updateAgencyStatus,
  type Agency,
  type AgencyStatus,
  type AgencyWritePayload,
  type PaginatedAgencies,
} from "@/lib/api/agencies";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  AgenciesFilters,
  EMPTY_AGENCIES_FILTERS,
  type AgenciesFilterState,
} from "./_components/AgenciesFilters";
import { AgenciesTable } from "./_components/AgenciesTable";
import {
  AgencyDrawer,
  type AgencyDrawerMode,
} from "./_components/AgencyDrawer";
import { AgencyManagerDrawer } from "./_components/AgencyManagerDrawer";

/**
 * P4 — Référentiel Agences.
 *
 * Page = filters + paginated table. Mutations happen inside drawers
 * (DESIGN_PRINCIPLES §5.2). Status changes and manager transfers are
 * triggered from the row's action menu; both refresh the list from the API
 * on success.
 */
export default function AgenciesPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["agencies.view"]);
  const canManage = useCan("agencies.manage");
  const [filters, setFilters] = useState<AgenciesFilterState>(
    EMPTY_AGENCIES_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [drawerMode, setDrawerMode] = useState<AgencyDrawerMode | null>(null);
  const [editing, setEditing] = useState<Agency | null>(null);
  const [managerDrawerAgency, setManagerDrawerAgency] = useState<Agency | null>(
    null,
  );

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedAgencies> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      // The API doesn't expose query-builder filters on this endpoint, so we
      // fetch up to one page (max 100 rows) and filter/search client-side.
      // For typical EMF agency counts (< 100) that's a single round-trip; if
      // an institution outgrows it, we'll wire `?filter[...]` server-side
      // once the backend ships it.
      return fetchAgencies(token, { page, perPage: 100 });
    },
    [token, page],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [token, page]);

  // Filter client-side because the index endpoint doesn't expose query-builder
  // filters yet. Switch to server-side filters when the backend adds them.
  const visibleAgencies = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    return data.data.filter((agency) => {
      if (filters.status && agency.status !== filters.status) return false;
      if (needle.length === 0) return true;
      return (
        agency.code.toLowerCase().includes(needle) ||
        agency.name.toLowerCase().includes(needle) ||
        (agency.city ?? "").toLowerCase().includes(needle) ||
        (agency.region ?? "").toLowerCase().includes(needle) ||
        (agency.manager_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, filters]);

  if (session.status !== "authenticated" || !allowed) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }

  function openEdit(agency: Agency) {
    setEditing(agency);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(payload: AgencyWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      await createAgency(token, payload);
      toast.success(
        t("agencies.toast.createdTitle"),
        t("agencies.toast.createdBody", { name: payload.name ?? "" }),
      );
      // Clear filters/page so the freshly-created row is guaranteed visible.
      setFilters(EMPTY_AGENCIES_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateAgency(token, editing.public_id, payload);
      toast.success(
        t("agencies.toast.updatedTitle"),
        t("agencies.toast.updatedBody", { name: payload.name ?? editing.name }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleStatusChange(agency: Agency, next: AgencyStatus) {
    if (!token) return;
    try {
      if (next === "archived") {
        await archiveAgency(token, agency.public_id);
      } else {
        await updateAgencyStatus(token, agency.public_id, next);
      }
      toast.success(
        t("agencies.toast.statusChangedTitle"),
        t("agencies.toast.statusChangedBody", {
          name: agency.name,
          status: t(`agencies.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("agencies.toast.statusErrorTitle"), generalMessage);
    }
  }

  async function handleManagerSubmit(payload: {
    manager_public_id: string | null;
    role_at_agency: string | null;
  }) {
    if (!token || !managerDrawerAgency) return;
    await updateAgencyManager(token, managerDrawerAgency.public_id, payload);
    toast.success(
      t("agencies.toast.managerChangedTitle"),
      t("agencies.toast.managerChangedBody", {
        name: managerDrawerAgency.name,
      }),
    );
    setManagerDrawerAgency(null);
    refetch();
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("agencies.pageTitle")}
        description={t("agencies.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("agencies.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <AgenciesFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("agencies.errorTitle")}
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

      <AgenciesTable
        rows={visibleAgencies}
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
        onChangeStatus={handleStatusChange}
        onTransferManager={(agency) => setManagerDrawerAgency(agency)}
      />

      <AgencyDrawer
        open={drawerMode !== null}
        mode={drawerMode ?? "create"}
        initial={editing}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
      />

      <AgencyManagerDrawer
        open={managerDrawerAgency !== null}
        agency={managerDrawerAgency}
        onClose={() => setManagerDrawerAgency(null)}
        onSubmit={handleManagerSubmit}
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
