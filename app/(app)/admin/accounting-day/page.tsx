"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  closeAccountingDay,
  fetchAccountingDays,
  fetchCurrentAccountingDay,
  openAccountingDay,
  reopenAccountingDay,
  startCloseAccountingDay,
  type AccountingDay,
  type OpenAccountingDayPayload,
  type PaginatedAccountingDays,
  type ReopenAccountingDayPayload,
} from "@/lib/api/accounting-days";
import { fetchTellerSessions } from "@/lib/api/teller-sessions";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { AccountingDayHistoryTable } from "./_components/AccountingDayHistoryTable";
import { CurrentDayCard, type DayAction } from "./_components/CurrentDayCard";
import { OpenDayDrawer } from "./_components/OpenDayDrawer";
import { ReopenDayDrawer } from "./_components/ReopenDayDrawer";

/**
 * Administration › Journée comptable.
 *
 * Drives the EMF accounting-day lifecycle (open → start-close → close →
 * reopen). While a day is open the institution can register operations; once
 * closed the whole system drops to consultation-only mode (the backend's
 * registration lock). Permissions `accounting.days.*`.
 */
export default function AccountingDayPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  // Compute each permission unconditionally (rules of hooks), then OR with the
  // platform-admin override.
  const canViewPerm = useCanAny(["accounting.days.view"]);
  const canOpenPerm = useCanAny(["accounting.days.open"]);
  const canClosePerm = useCanAny(["accounting.days.close"]);
  const canReopenPerm = useCanAny(["accounting.days.reopen"]);
  const canView = isPlatformAdmin || canViewPerm;
  const canOpen = isPlatformAdmin || canOpenPerm;
  const canClose = isPlatformAdmin || canClosePerm;
  const canReopen = isPlatformAdmin || canReopenPerm;

  const token = session.status === "authenticated" ? session.token : null;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [reopenDrawer, setReopenDrawer] = useState(false);
  const [startCloseConfirm, setStartCloseConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [busyAction, setBusyAction] = useState<DayAction | "open" | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  // Platform admins aren't tied to one agency, so they pick the scope to view:
  // "institution" or a specific agency public_id. Agency staff use their own
  // agency implicitly (no selector). The value is ignored for non-admins.
  const [scopeValue, setScopeValue] = useState("institution");
  // Open teller sessions blocking a clean close of an agency-scoped day. The
  // backend currently deadlocks if you start-close with sessions still open
  // (see back-issues-round3 D1), so the FE refuses start-close until they're 0.
  const [openSessionsCount, setOpenSessionsCount] = useState<number | null>(null);

  const currentFetcher = useCallback(
    async (signal: AbortSignal): Promise<AccountingDay | null> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      if (isPlatformAdmin) {
        return scopeValue === "institution"
          ? fetchCurrentAccountingDay(token, { scope: "institution" })
          : fetchCurrentAccountingDay(token, {
              scope: "agency",
              agencyPublicId: scopeValue,
            });
      }
      return fetchCurrentAccountingDay(token);
    },
    [token, isPlatformAdmin, scopeValue],
  );

  const historyFetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedAccountingDays> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchAccountingDays(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const {
    data: currentDay,
    loading: currentLoading,
    error: currentError,
    refetch: refetchCurrent,
  } = useApi(currentFetcher, [token, isPlatformAdmin, scopeValue]);

  const scopeOptions = useMemo(
    () => [
      { value: "institution", label: t("accountingDay.scope.institution") },
      ...agencies.map((agency) => ({
        value: agency.public_id,
        label: agency.code ? `${agency.code} — ${agency.name}` : agency.name,
      })),
    ],
    [agencies, t],
  );

  const {
    data: history,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useApi(historyFetcher, [token, page, pageSize]);

  // Count open teller sessions that would block a clean close. Only meaningful
  // for an agency-scoped day in the registrable state (open/reopened); an
  // institution day governs no agency teller sessions.
  useEffect(() => {
    if (
      !token ||
      !currentDay ||
      (currentDay.status !== "open" && currentDay.status !== "reopened") ||
      currentDay.scope !== "agency"
    ) {
      setOpenSessionsCount(null);
      return;
    }
    let cancelled = false;
    fetchTellerSessions(token, {
      status: "open",
      perPage: 1,
      // The index auto-scopes non-admins to their agency; admins must pass it.
      ...(isPlatformAdmin && currentDay.agency_public_id
        ? { agencyPublicId: currentDay.agency_public_id }
        : {}),
    })
      .then((res) => {
        if (!cancelled) setOpenSessionsCount(res.meta.pagination.total);
      })
      .catch(() => {
        if (!cancelled) setOpenSessionsCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, currentDay, isPlatformAdmin]);

  // Agencies only matter for the platform-admin open form (scope = agency).
  useEffect(() => {
    if (!token || !isPlatformAdmin) return;
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
  }, [token, isPlatformAdmin]);

  if (session.status !== "authenticated" || !canView) return null;

  function refetchAll() {
    refetchCurrent();
    refetchHistory();
  }

  async function handleOpen(payload: OpenAccountingDayPayload) {
    if (!token) return;
    const day = await openAccountingDay(token, payload);
    // Point the admin's scope view at whatever they just opened, so the card
    // reflects the new day instead of the previously-selected scope.
    if (isPlatformAdmin) {
      setScopeValue(
        day.scope === "institution" ? "institution" : day.agency_public_id ?? "institution",
      );
    }
    toast.success(
      t("accountingDay.toast.openedTitle"),
      t("accountingDay.toast.openedBody", {
        date: day.business_date ?? "",
      }),
    );
    setOpenDrawer(false);
    setPage(1);
    refetchAll();
  }

  async function handleReopen(payload: ReopenAccountingDayPayload) {
    if (!token || !currentDay) return;
    await reopenAccountingDay(token, currentDay.public_id, payload);
    toast.success(
      t("accountingDay.toast.reopenedTitle"),
      t("accountingDay.toast.reopenedBody", {
        date: currentDay.business_date ?? "",
      }),
    );
    setReopenDrawer(false);
    refetchAll();
  }

  async function handleStartClose() {
    if (!token || !currentDay) return;
    setBusyAction("start-close");
    try {
      await startCloseAccountingDay(token, currentDay.public_id);
      toast.success(
        t("accountingDay.toast.startClosedTitle"),
        t("accountingDay.toast.startClosedBody"),
      );
      refetchAll();
    } catch (cause) {
      toast.error(
        t("accountingDay.toast.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    } finally {
      setBusyAction(null);
      setStartCloseConfirm(false);
    }
  }

  async function handleClose() {
    if (!token || !currentDay) return;
    setBusyAction("close");
    try {
      await closeAccountingDay(token, currentDay.public_id);
      toast.success(
        t("accountingDay.toast.closedTitle"),
        t("accountingDay.toast.closedBody"),
      );
      refetchAll();
    } catch (cause) {
      // A 422 close-blocked carries the failing controls; surface the reason and
      // refetch so the card shows the up-to-date blockers.
      toast.error(
        t("accountingDay.toast.closeBlockedTitle"),
        localizeApiError(cause).generalMessage,
      );
      refetchAll();
    } finally {
      setBusyAction(null);
      setCloseConfirm(false);
    }
  }

  const pageMeta = history?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("accountingDay.pageTitle")}
        description={t("accountingDay.pageDescription")}
        actions={
          canOpen && currentError ? (
            <Button variant="primary" size="md" onClick={() => setOpenDrawer(true)}>
              {t("accountingDay.actions.open")}
            </Button>
          ) : null
        }
      />

      {isPlatformAdmin ? (
        <div className="max-w-sm">
          <Select
            id="accounting-day-scope-view"
            label={t("accountingDay.scopePicker.label")}
            value={scopeValue}
            onChange={setScopeValue}
            options={scopeOptions}
            size="sm"
            hint={t("accountingDay.scopePicker.hint")}
          />
        </div>
      ) : null}

      {currentError ? (
        <Alert
          variant="danger"
          title={t("accountingDay.current.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetchCurrent}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(currentError.message)}
        </Alert>
      ) : (
        <CurrentDayCard
          day={currentDay}
          loading={currentLoading}
          canOpen={canOpen}
          canClose={canClose}
          canReopen={canReopen}
          busyAction={busyAction}
          openSessionsCount={openSessionsCount}
          onOpen={() => setOpenDrawer(true)}
          onStartClose={() => setStartCloseConfirm(true)}
          onClose={() => setCloseConfirm(true)}
          onReopen={() => setReopenDrawer(true)}
        />
      )}

      {historyError ? (
        <Alert
          variant="danger"
          title={t("accountingDay.table.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetchHistory}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(historyError.message)}
        </Alert>
      ) : (
        <AccountingDayHistoryTable
          rows={history?.data ?? []}
          loading={historyLoading && !history}
          total={pageMeta?.total ?? 0}
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
      )}

      {canOpen ? (
        <OpenDayDrawer
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          onSubmit={handleOpen}
          isPlatformAdmin={isPlatformAdmin}
          agencies={agencies}
        />
      ) : null}

      {canReopen ? (
        <ReopenDayDrawer
          open={reopenDrawer}
          onClose={() => setReopenDrawer(false)}
          onSubmit={handleReopen}
          businessDate={currentDay?.business_date ?? null}
        />
      ) : null}

      <ConfirmDialog
        open={startCloseConfirm}
        title={t("accountingDay.startClose.title")}
        description={t("accountingDay.startClose.body")}
        confirmLabel={t("accountingDay.actions.startClose")}
        cancelLabel={t("common.cancel")}
        tone="primary"
        loading={busyAction === "start-close"}
        busyLabel={t("accountingDay.actions.startClosing")}
        onConfirm={handleStartClose}
        onClose={() => (busyAction ? undefined : setStartCloseConfirm(false))}
      />

      <ConfirmDialog
        open={closeConfirm}
        title={t("accountingDay.close.title")}
        description={t("accountingDay.close.body")}
        confirmLabel={t("accountingDay.actions.close")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={busyAction === "close"}
        busyLabel={t("accountingDay.actions.closing")}
        onConfirm={handleClose}
        onClose={() => (busyAction ? undefined : setCloseConfirm(false))}
      />
    </>
  );
}
