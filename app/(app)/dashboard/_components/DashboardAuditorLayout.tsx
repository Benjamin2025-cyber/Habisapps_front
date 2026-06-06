"use client";

import { useCallback } from "react";
import {
  BanknoteIcon,
  BuildingIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { fetchAgencies } from "@/lib/api/agencies";
import {
  countClients,
  countStaffUsers,
  fetchLoans,
  type Loan,
} from "@/lib/api/loans";
import { countLoansByStatus } from "@/lib/api/dashboard-stats";
import { listAuditEvents, type AuditEvent } from "@/lib/api/audit";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardDistributionCard } from "./DashboardDistributionCard";
import { DashboardCard } from "./DashboardCard";
import { DashboardLoansTable } from "./DashboardLoansTable";
import { DashboardActivitiesCard } from "./DashboardActivitiesCard";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { loanStatusTone } from "./dashboard-status";

const LOAN_STATUSES = [
  "application",
  "in_review",
  "approved",
  "disbursed",
  "active",
  "rescheduled",
  "closed",
  "rejected",
  "written_off",
] as const;
const LOAN_DONUT = ["active", "in_review", "approved", "closed", "rejected"] as const;

type AuditorAggregate = {
  loansByStatus: Record<string, number>;
  clientsTotal: number | null;
  agenciesTotal: number | null;
  usersTotal: number | null;
  recentEvents: AuditEvent[];
  recentLoans: Loan[];
};

/**
 * Auditor dashboard — read-only, institution-wide, activity-centric. A large
 * audit feed is the focus, flanked by institution KPIs, the loan-status
 * distribution and recent loans.
 */
export function DashboardAuditorLayout() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AuditorAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [loansByStatus, clientsTotal, agenciesTotal, usersTotal, recentEvents, recentLoans] =
        await Promise.all([
          countLoansByStatus(token, LOAN_STATUSES),
          safeNullable(() => countClients(token, { scope: "all" })),
          safeNullable(() =>
            fetchAgencies(token, { perPage: 1 }).then(
              (r) => r.meta?.pagination?.total ?? r.data.length,
            ),
          ),
          safeNullable(() => countStaffUsers(token)),
          safeArray(() => listAuditEvents(token, { perPage: 12 }).then((r) => r.data)),
          safeArray(() => fetchLoans(token, { perPage: 6 }).then((r) => r.data)),
        ]);
      return { loansByStatus, clientsTotal, agenciesTotal, usersTotal, recentEvents, recentLoans };
    },
    [token],
  );

  const { data, loading } = useApi(fetcher, [token]);

  if (session.status !== "authenticated") return null;

  const loansByStatus = data?.loansByStatus ?? {};
  const totalLoans = LOAN_STATUSES.reduce((sum, s) => sum + (loansByStatus[s] ?? 0), 0);
  const loanSegments = LOAN_DONUT.map((status) => ({
    key: status,
    label: t(`dashboard.common.loanStatus.${status}`),
    value: loansByStatus[status] ?? 0,
    tone: loanStatusTone(status),
  }));

  const firstName = session.user.name.split(" ")[0];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.auditor.greeting", { name: firstName })}
        subtitle={t("dashboard.auditor.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatTile
          icon={BanknoteIcon}
          tone="info"
          label={t("dashboard.auditor.kpi.loans")}
          value={totalLoans}
          loading={loading && !data}
        />
        <DashboardStatTile
          icon={UsersIcon}
          tone="accent"
          label={t("dashboard.auditor.kpi.clients")}
          value={data?.clientsTotal ?? (loading ? "…" : "—")}
          loading={loading && !data}
        />
        <DashboardStatTile
          icon={BuildingIcon}
          tone="primary"
          label={t("dashboard.auditor.kpi.agencies")}
          value={data?.agenciesTotal ?? (loading ? "…" : "—")}
          loading={loading && !data}
        />
        <DashboardStatTile
          icon={UsersIcon}
          tone="success"
          label={t("dashboard.auditor.kpi.users")}
          value={data?.usersTotal ?? (loading ? "…" : "—")}
          loading={loading && !data}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <DashboardActivitiesCard
            events={data?.recentEvents ?? null}
            loading={loading && !data}
          />
          <DashboardCard
            title={t("dashboard.regional.recentLoans")}
            icon={BanknoteIcon}
            tone="info"
            action={{ href: "/credit/loans", label: t("dashboard.common.viewAll") }}
            bodyClassName="px-5 py-2"
          >
            <DashboardLoansTable loans={data?.recentLoans ?? null} loading={loading && !data} />
          </DashboardCard>
        </div>

        <aside className="flex flex-col gap-4">
          <DashboardDistributionCard
            title={t("dashboard.auditor.loanDistTitle")}
            icon={BanknoteIcon}
            segments={loanSegments}
            loading={loading && !data}
          />
          <DashboardNotificationsCard />
        </aside>
      </div>
    </>
  );
}

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
