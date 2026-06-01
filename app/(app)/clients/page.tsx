"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  createClient,
  fetchClients,
  updateClient,
  updateClientKycStatus,
  updateClientStatus,
  type Client,
  type ClientStatus,
  type ClientWritePayload,
  type KycAction,
  type PaginatedClients,
} from "@/lib/api/clients";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../_components/PageHeader";
import {
  ClientsFilters,
  EMPTY_CLIENTS_FILTERS,
  type ClientsFilterState,
} from "./_components/ClientsFilters";
import { ClientsTable } from "./_components/ClientsTable";
import {
  ClientDrawer,
  type ClientDrawerMode,
} from "./_components/ClientDrawer";
import { ClientKycReasonDrawer } from "./_components/ClientKycReasonDrawer";

/**
 * P6.1 — Référentiel Clients (liste + CRUD + statut + actions KYC).
 *
 * La fiche client multi-onglets (Identity docs / Garants / Mandataires /
 * Comptes / Prêts) arrive avec P6.2.
 */
export default function ClientsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["crm.clients.view"]);
  const canCreate = useCan("crm.clients.create");
  const canEdit = useCan("crm.clients.update");
  const canChangeStatus = useCan("crm.clients.update");
  const canSubmitKyc = useCan("crm.kyc.submit");
  const canReviewKyc = useCan("crm.kyc.review");
  const canScopeInstitution = useCan("crm.scope.institution.read");

  const [filters, setFilters] = useState<ClientsFilterState>(
    EMPTY_CLIENTS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<ClientDrawerMode | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [kycDrawer, setKycDrawer] = useState<{
    client: Client;
    action: KycAction;
  } | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedClients> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchClients(token, {
        page,
        perPage: pageSize,
        scope: canScopeInstitution ? "all" : undefined,
      });
    },
    [token, page, pageSize, canScopeInstitution],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    canScopeInstitution,
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

  // Client-side filtering: the backend supports `filter[status]` /
  // `filter[kyc_status]` but not free-text search yet.
  const visibleClients = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    return data.data.filter((client) => {
      if (filters.status && client.status !== filters.status) return false;
      if (filters.kycStatus && client.kyc_status !== filters.kycStatus)
        return false;
      if (needle.length === 0) return true;
      return (
        (client.client_reference ?? "").toLowerCase().includes(needle) ||
        (client.first_name ?? "").toLowerCase().includes(needle) ||
        (client.last_name ?? "").toLowerCase().includes(needle) ||
        (client.phone_number ?? "").toLowerCase().includes(needle) ||
        (client.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, filters]);

  if (session.status !== "authenticated" || !allowed) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }

  function openEdit(client: Client) {
    setEditing(client);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(payload: ClientWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      await createClient(token, payload);
      toast.success(
        t("clients.toast.createdTitle"),
        t("clients.toast.createdBody", {
          name:
            `${payload.last_name ?? ""} ${payload.first_name ?? ""}`.trim(),
        }),
      );
      setFilters(EMPTY_CLIENTS_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateClient(token, editing.public_id, payload);
      toast.success(
        t("clients.toast.updatedTitle"),
        t("clients.toast.updatedBody", {
          name:
            `${payload.last_name ?? editing.last_name ?? ""} ${
              payload.first_name ?? editing.first_name ?? ""
            }`.trim(),
        }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleStatusChange(client: Client, next: ClientStatus) {
    if (!token) return;
    try {
      await updateClientStatus(token, client.public_id, next);
      toast.success(
        t("clients.toast.statusChangedTitle"),
        t("clients.toast.statusChangedBody", {
          name:
            `${client.last_name ?? ""} ${client.first_name ?? ""}`.trim() ||
            (client.client_reference ?? ""),
          status: t(`clients.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("clients.toast.statusErrorTitle"), generalMessage);
    }
  }

  function handleKycAction(client: Client, action: KycAction) {
    // Actions that need free text (rejection reason, optional comment) open
    // the dedicated drawer; the rest fire-and-toast.
    setKycDrawer({ client, action });
  }

  async function handleKycSubmit(payload: {
    action: KycAction;
    reason: string | null;
    comment: string | null;
    allow_self_verify: boolean;
  }) {
    if (!token || !kycDrawer) return;
    await updateClientKycStatus(token, kycDrawer.client.public_id, payload);
    toast.success(
      t("clients.toast.kycChangedTitle"),
      t("clients.toast.kycChangedBody", {
        name:
          `${kycDrawer.client.last_name ?? ""} ${
            kycDrawer.client.first_name ?? ""
          }`.trim() ||
          (kycDrawer.client.client_reference ?? ""),
        action: t(`clients.kycReason.title.${payload.action}`),
      }),
    );
    setKycDrawer(null);
    refetch();
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("clients.pageTitle")}
        description={t("clients.pageDescription")}
        actions={
          canCreate ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("clients.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <ClientsFilters value={filters} onChange={setFilters} />

      {error ? (
        <Alert
          variant="danger"
          title={t("clients.errorTitle")}
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

      <ClientsTable
        rows={visibleClients}
        loading={loading && !data}
        canEdit={canEdit}
        canChangeStatus={canChangeStatus}
        canSubmitKyc={canSubmitKyc}
        canReviewKyc={canReviewKyc}
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
        onKycAction={handleKycAction}
      />

      <ClientDrawer
        open={drawerMode !== null}
        mode={drawerMode ?? "create"}
        initial={editing}
        agencies={agencies}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
      />

      <ClientKycReasonDrawer
        open={kycDrawer !== null}
        client={kycDrawer?.client ?? null}
        action={kycDrawer?.action ?? null}
        onClose={() => setKycDrawer(null)}
        onSubmit={handleKycSubmit}
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
