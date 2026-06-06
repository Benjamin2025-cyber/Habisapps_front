"use client";

import { useCallback } from "react";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  BookIcon,
  FileTextIcon,
  LayersIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { countClients, countLoans, fetchLoans, type Loan } from "@/lib/api/loans";
import { countLoansByStatus } from "@/lib/api/dashboard-stats";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardDistributionCard } from "./DashboardDistributionCard";
import { DashboardCard } from "./DashboardCard";
import { DashboardLoansTable } from "./DashboardLoansTable";
import { DashboardActionTiles, type ActionTile } from "./DashboardActionTiles";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { loanStatusTone } from "./dashboard-status";

/** Loan statuses surfaced in the portfolio donut, in display order. */
const PORTFOLIO_STATUSES = [
  "active",
  "in_review",
  "approved",
  "disbursed",
  "closed",
  "rejected",
] as const;

type OfficerAggregate = {
  byStatus: Record<string, number>;
  clientsCount: number | null;
  delinquentCount: number | null;
  recentLoans: Loan[];
};

/**
 * Loan-officer dashboard. Portfolio KPIs + a loan-status donut + recent loans on
 * the left, quick actions + notifications on the right. The portfolio numbers
 * are derived from per-status `countLoans` probes (agency-scoped today; an
 * officer-scoped filter is requested in dashboard-request.md #1). The "overdue"
 * tile is a placeholder until the delinquency endpoint lands (#2).
 */
export function DashboardOfficerLayout() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const canCreateLoan = useCan("loans.create");
  const canCreateClient = useCan("crm.clients.create");
  const canDecide = useCan("loans.approvals.montage");
  const canSeeClients = useCan("crm.clients.view");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<OfficerAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [byStatus, clientsCount, delinquentCount, recent] = await Promise.all([
        countLoansByStatus(token, [
          "application",
          "in_review",
          "approved",
          "disbursed",
          "active",
          "rescheduled",
          "closed",
          "rejected",
          "written_off",
        ]),
        safeNullable(() => countClients(token, { status: "active" })),
        safeNullable(() => countLoans(token, { in_arrears: true })),
        safeArray(() => fetchLoans(token, { perPage: 6 }).then((r) => r.data)),
      ]);
      return { byStatus, clientsCount, delinquentCount, recentLoans: recent };
    },
    [token],
  );

  const { data, loading } = useApi(fetcher, [token]);

  if (session.status !== "authenticated") return null;

  const byStatus = data?.byStatus ?? {};
  const activeCount = byStatus.active ?? 0;
  const pendingCount = (byStatus.application ?? 0) + (byStatus.in_review ?? 0);

  const segments = PORTFOLIO_STATUSES.map((status) => ({
    key: status,
    label: t(`dashboard.common.loanStatus.${status}`),
    value: byStatus[status] ?? 0,
    tone: loanStatusTone(status),
  }));

  const firstName = session.user.name.split(" ")[0];

  const actions: ActionTile[] = [
    canCreateLoan && {
      key: "newLoan",
      label: t("dashboard.officer.actions.newLoan"),
      href: "/credit/loans",
      icon: BanknoteIcon,
      tone: "success" as const,
    },
    canCreateClient && {
      key: "newClient",
      label: t("dashboard.officer.actions.newClient"),
      href: "/clients",
      icon: UsersIcon,
      tone: "accent" as const,
    },
    canDecide && {
      key: "decisions",
      label: t("dashboard.officer.actions.decisions"),
      href: "/credit/decision",
      icon: FileTextIcon,
      tone: "info" as const,
    },
    canSeeClients && {
      key: "myClients",
      label: t("dashboard.officer.actions.myClients"),
      href: "/clients",
      icon: BookIcon,
      tone: "primary" as const,
    },
  ].filter(Boolean) as ActionTile[];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.officer.greeting", { name: firstName })}
        subtitle={t("dashboard.officer.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStatTile
              icon={BanknoteIcon}
              tone="success"
              label={t("dashboard.officer.kpi.activeLoans")}
              value={activeCount}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={LayersIcon}
              tone="info"
              label={t("dashboard.officer.kpi.pending")}
              value={pendingCount}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={UsersIcon}
              tone="accent"
              label={t("dashboard.officer.kpi.clients")}
              value={data?.clientsCount ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={AlertTriangleIcon}
              tone="warning"
              label={t("dashboard.officer.kpi.delinquent")}
              value={data?.delinquentCount ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
          </div>

          <DashboardDistributionCard
            title={t("dashboard.officer.portfolioTitle")}
            icon={BanknoteIcon}
            segments={segments}
            loading={loading && !data}
          />

          <DashboardCard
            title={t("dashboard.officer.recentLoans")}
            icon={FileTextIcon}
            tone="info"
            action={{ href: "/credit/loans", label: t("dashboard.officer.recentLoansViewAll") }}
            bodyClassName="px-5 py-2"
          >
            <DashboardLoansTable loans={data?.recentLoans ?? null} loading={loading && !data} />
          </DashboardCard>
        </div>

        <aside className="flex flex-col gap-4">
          <DashboardActionTiles
            title={t("dashboard.common.quickActions")}
            actions={actions}
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
