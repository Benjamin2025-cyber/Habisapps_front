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
import { fetchLoans, type Loan } from "@/lib/api/loans";
import {
  getLoanOfficerDashboard,
  type LoanOfficerDashboard,
} from "@/lib/api/dashboard";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
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
  summary: LoanOfficerDashboard;
  recentLoans: Loan[];
};

/**
 * Loan-officer dashboard. Driven by `GET /dashboards/loan-officer` — a single
 * self-scoped call (loans where `credit_agent = me`) returning portfolio KPIs +
 * a full per-status breakdown. Recent loans are likewise self-scoped via
 * `filter[credit_agent_public_id]`.
 */
export function DashboardOfficerLayout() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const myPublicId =
    session.status === "authenticated" ? session.user.public_id : null;

  const canCreateLoan = useCan("loans.create");
  const canCreateClient = useCan("crm.clients.create");
  const canDecide = useCan("loans.approvals.montage");
  const canSeeClients = useCan("crm.clients.view");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<OfficerAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [summary, recent] = await Promise.all([
        getLoanOfficerDashboard(token),
        safeArray(() =>
          fetchLoans(token, {
            perPage: 6,
            creditAgentPublicId: myPublicId ?? undefined,
          }).then((r) => r.data),
        ),
      ]);
      return { summary, recentLoans: recent };
    },
    [token, myPublicId],
  );

  const { data, loading } = useApi(fetcher, [token, myPublicId]);

  if (session.status !== "authenticated") return null;

  const summary = data?.summary ?? null;
  const byStatus = summary?.by_status ?? {};
  const currency = summary?.currency ?? "XAF";

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
              value={summary?.active_loan_count ?? 0}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={LayersIcon}
              tone="info"
              label={t("dashboard.officer.kpi.pending")}
              value={summary?.application_count ?? 0}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={BookIcon}
              tone="accent"
              label={t("dashboard.officer.kpi.portfolio")}
              value={summary ? format.currencyMinor(summary.portfolio_outstanding_minor, { currency }) : "—"}
              footer={
                summary ? (
                  <span className="text-xs text-muted-foreground">
                    {t("dashboard.officer.collectionsMtd", {
                      amount: format.currencyMinor(summary.collections_mtd_minor, { currency }),
                    })}
                  </span>
                ) : undefined
              }
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={AlertTriangleIcon}
              tone="warning"
              label={t("dashboard.officer.kpi.delinquent")}
              value={summary?.delinquent_loan_count ?? 0}
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

async function safeArray<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}
