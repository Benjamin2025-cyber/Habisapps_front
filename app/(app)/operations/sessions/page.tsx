"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import {
  closeTellerSession,
  fetchTellerSessions,
  openTellerSession,
  type CloseTellerSessionPayload,
  type OpenTellerSessionPayload,
  type PaginatedTellerSessions,
  type TellerSession,
  type TellerSessionStatus,
} from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { SessionsTable } from "./_components/SessionsTable";
import { OpenSessionDrawer } from "./_components/OpenSessionDrawer";
import { CloseSessionDrawer } from "./_components/CloseSessionDrawer";

/**
 * P20 — Caisse › Sessions de caisse. Ouverture/clôture des sessions de caisse.
 * Câblé sur `teller-sessions` (+ `/close`). Permissions
 * `cash.sessions.view` / `cash.sessions.manage`.
 */
export default function SessionsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.sessions.view"]);
  const managePerm = useCanAny(["cash.sessions.manage"]);
  const canView = isPlatformAdmin || viewPerm;
  const canManage = isPlatformAdmin || managePerm;

  const [statusFilter, setStatusFilter] = useState<TellerSessionStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [closing, setClosing] = useState<TellerSession | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedTellerSessions> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchTellerSessions(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
  ]);

  const [tills, setTills] = useState<Till[]>([]);
  const [tellers, setTellers] = useState<StaffUser[]>([]);
  const reloadTills = useCallback(() => {
    if (!token) return;
    fetchTills(token, { perPage: 100 })
      .then((res) => setTills(res.data))
      .catch(() => setTills([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchTills(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchStaffUsers(token, { perPage: 100 }).catch(() => ({ data: [] })),
    ]).then(([tl, st]) => {
      if (cancelled) return;
      setTills(tl.data as Till[]);
      setTellers(st.data as StaffUser[]);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tillLabelOf = useCallback(
    (publicId: string | null) => {
      if (!publicId) return "—";
      const till = tills.find((x) => x.public_id === publicId);
      return till ? `${till.code} — ${till.name}` : publicId;
    },
    [tills],
  );

  const tellerNameOf = useCallback(
    (publicId: string | null) => {
      if (!publicId) return "—";
      return tellers.find((u) => u.public_id === publicId)?.name ?? publicId;
    },
    [tellers],
  );

  // A session can only be opened on an active, currently-closed till.
  const eligibleTills = useMemo(
    () => tills.filter((till) => till.status === "active" && till.daily_state === "closed"),
    [tills],
  );

  const visible = useMemo(() => {
    const rows = data?.data ?? [];
    if (!statusFilter) return rows;
    return rows.filter((s) => s.status === statusFilter);
  }, [data, statusFilter]);

  if (session.status !== "authenticated" || !canView) return null;

  async function handleOpen(payload: OpenTellerSessionPayload) {
    if (!token) return;
    const created = await openTellerSession(token, payload);
    toast.success(
      t("sessions.toast.openedTitle"),
      t("sessions.toast.openedBody", { till: tillLabelOf(created.till_public_id) }),
    );
    setOpenDrawer(false);
    refetch();
    reloadTills(); // till daily_state flips to open
  }

  async function handleClose(payload: CloseTellerSessionPayload) {
    if (!token || !closing) return;
    await closeTellerSession(token, closing.public_id, payload);
    toast.success(
      t("sessions.toast.closedTitle"),
      t("sessions.toast.closedBody", {
        till: tillLabelOf(closing.till_public_id),
      }),
    );
    setClosing(null);
    refetch();
    reloadTills(); // till daily_state flips back to closed
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("sessions.pageTitle")}
        description={t("sessions.pageDescription")}
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setOpenDrawer(true)}
              disabled={eligibleTills.length === 0}
            >
              {t("sessions.actions.open")}
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:max-w-xs">
        <label
          htmlFor="sessions-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("sessions.filters.statusLabel")}
        </label>
        <Select
          id="sessions-status"
          value={statusFilter}
          options={[
            { value: "open", label: t("sessions.status.open") },
            { value: "closed", label: t("sessions.status.closed") },
          ]}
          placeholder={t("sessions.filters.statusAll")}
          isClearable
          onChange={(next) => setStatusFilter(next as TellerSessionStatus | "")}
        />
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("sessions.errorTitle")}
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

      <SessionsTable
        rows={visible}
        loading={loading && !data}
        canManage={canManage}
        tillLabelOf={tillLabelOf}
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
        onClose={setClosing}
      />

      {canManage ? (
        <>
          <OpenSessionDrawer
            open={openDrawer}
            tills={eligibleTills}
            tellers={tellers}
            onClose={() => setOpenDrawer(false)}
            onSubmit={handleOpen}
          />
          <CloseSessionDrawer
            open={closing !== null}
            session={closing}
            onClose={() => setClosing(null)}
            onSubmit={handleClose}
          />
        </>
      ) : null}
    </>
  );
}
