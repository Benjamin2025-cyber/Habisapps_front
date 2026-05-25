"use client";

import { useCallback, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { ApiError } from "@/lib/api/client";
import {
  getOperationalDashboard,
  type OperationalDashboard,
} from "@/lib/api/dashboard";
import { listAuditEvents, type AuditEvent } from "@/lib/api/audit";
import { countClients, countLoans, countStaffUsers } from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  periodToDateRange,
  type DashboardFilterState,
} from "./DashboardFilters";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardKpiStrip } from "./DashboardKpiStrip";
import { DashboardChartPlaceholder } from "./DashboardChartPlaceholder";
import { DashboardAlertsCard } from "./DashboardAlertsCard";
import { DashboardUserManagementCard } from "./DashboardUserManagementCard";
import { DashboardLoanTrackingCard } from "./DashboardLoanTrackingCard";
import { DashboardActivitiesCard } from "./DashboardActivitiesCard";
import { DashboardAgenciesCard } from "./DashboardAgenciesCard";
import { DashboardFreshness } from "./DashboardFreshness";

type ManagementAggregate = {
  dashboard: OperationalDashboard;
  activeLoansCount: number | null;
  delinquentLoansCount: number | null;
  clientsCount: number | null;
  totalUsersCount: number | null;
  recentEvents: AuditEvent[];
};

/**
 * Orchestrator for the `management` preset (platform-admin, agency-manager,
 * compliance-officer, auditor). Composes the full PDF p6 layout.
 *
 * One round-trip per dependency: it fans out a handful of `GET` requests in
 * parallel (operational dashboard + counts + audit feed) and surfaces them
 * through `useApi`. A 403 surfaces as a soft alert and the panels become
 * placeholders rather than a hard error.
 */
export function DashboardManagementLayout() {
  const t = useTranslations();
  const session = useSession();
  const [filters, setFilters] = useState<DashboardFilterState>(
    EMPTY_DASHBOARD_FILTERS,
  );

  const token = session.status === "authenticated" ? session.token : null;
  const isPlatformAdmin =
    session.status === "authenticated" &&
    session.user.roles.includes("platform-admin");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ManagementAggregate> => {
      if (!token) throw new Error("Missing session token");
      const { from, to } = periodToDateRange(filters.period);

      // The operational dashboard is foundational — its failure surfaces in the
      // error block. Every other call (counts, audit feed) is best-effort: a
      // 403 / network blip on one endpoint must not blank out the page.
      const [dashboard, activeLoansCount, clientsCount, totalUsersCount, recentEvents] =
        await Promise.all([
          getOperationalDashboard(token, {
            agency_public_id: filters.agencyPublicId || undefined,
            period_starts_on: from,
            period_ends_on: to,
          }),
          safeNullable(() => countLoans(token, { status: "active" })),
          // Pass scope=all so management roles get institution-wide totals;
          // the API rejects this for users without `crm.scope.institution.read`,
          // which is fine — `safeNullable` keeps the rest of the page alive.
          safeNullable(() => countClients(token, { status: "active", scope: "all" })),
          safeNullable(() => countStaffUsers(token)),
          safeArray(() =>
            listAuditEvents(token, { perPage: 10 }).then((response) => response.data),
          ),
        ]);
      void signal;
      return {
        dashboard,
        activeLoansCount,
        delinquentLoansCount: null,
        clientsCount,
        totalUsersCount,
        recentEvents,
      };
    },
    [token, filters.agencyPublicId, filters.period],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    filters.agencyPublicId,
    filters.period,
  ]);

  const lowCollectionFlag = useMemo<number | null>(() => {
    if (!data) return null;
    const ratio = data.dashboard.collections.performance_ratio;
    return ratio !== null && ratio < 0.6 ? 1 : 0;
  }, [data]);

  const inactiveUsersFlag = useMemo<number | null>(() => {
    // No status filter on /staff-users yet; show "—" via null.
    return null;
  }, []);

  if (session.status !== "authenticated") return null;

  return (
    <>
      <PageHeader
        title={t("dashboard.pageTitle")}
        actions={
          data ? (
            <DashboardFreshness
              iso={data.dashboard.data_freshness_at}
              refreshing={loading}
              onRefresh={refetch}
            />
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <DashboardQuickActions />
      </div>

      <DashboardFilters
        value={filters}
        onChange={setFilters}
        canSelectAgency={isPlatformAdmin}
      />

      {error ? <ErrorBlock error={error} onRetry={refetch} /> : null}

      <DashboardKpiStrip
        data={data?.dashboard ?? null}
        activeLoansCount={data?.activeLoansCount ?? null}
        delinquentLoansCount={data?.delinquentLoansCount ?? null}
        clientsCount={data?.clientsCount ?? null}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardChartPlaceholder
            title={t("dashboard.financialPerformance.title")}
            subtitle={t("dashboard.financialPerformance.subtitle")}
            rangeOptions={[
              { value: "today", label: t("dashboard.financialPerformance.today") },
              { value: "week", label: t("dashboard.financialPerformance.week") },
              { value: "month", label: t("dashboard.financialPerformance.month") },
              { value: "year", label: t("dashboard.financialPerformance.year") },
            ]}
            activeRange={filters.period}
            onRangeChange={(next) =>
              setFilters({
                ...filters,
                period: next as DashboardFilterState["period"],
              })
            }
            legend={[
              {
                label: t("dashboard.financialPerformance.legendBalance"),
                color: "var(--color-primary)",
              },
              {
                label: t("dashboard.financialPerformance.legendCollection"),
                color: "var(--color-accent)",
              },
            ]}
          />
        </div>
        <div className="flex flex-col gap-4">
          <DashboardAlertsCard
            delinquentLoans={data?.delinquentLoansCount ?? null}
            inactiveUsers={inactiveUsersFlag}
            lowCollectionFlag={lowCollectionFlag}
            loading={loading && !data}
          />
          <DashboardUserManagementCard
            totalUsers={data?.totalUsersCount ?? null}
            loading={loading && !data}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardLoanTrackingCard data={data?.dashboard ?? null} />
        <DashboardActivitiesCard
          events={data?.recentEvents ?? null}
          loading={loading && !data}
        />
        <DashboardAgenciesCard />
      </div>
    </>
  );
}

function ErrorBlock({
  error,
  onRetry,
}: {
  error: ApiError | Error;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const isForbidden = error instanceof ApiError && error.status === 403;

  return (
    <Alert
      variant={isForbidden ? "info" : "danger"}
      title={
        isForbidden ? t("dashboard.forbiddenTitle") : t("dashboard.errorTitle")
      }
      action={
        isForbidden ? null : (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {t("common.tryAgain")}
          </button>
        )
      }
    >
      {isForbidden ? t("dashboard.forbiddenBody") : error.message}
    </Alert>
  );
}

/**
 * Wraps a fetch that returns `T` so a 403 (or other non-fatal failure) yields
 * `null` instead of rejecting the whole Promise.all. Used for endpoints whose
 * failure should NOT block the dashboard (counts, audit feed).
 */
async function safeNullable<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function safeArray<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}
