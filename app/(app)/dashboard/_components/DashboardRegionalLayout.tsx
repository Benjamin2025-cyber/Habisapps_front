"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  BookIcon,
  BuildingIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { getClientStats, type ClientStats } from "@/lib/api/clients";
import { fetchLoans, getLoanStats, type Loan, type LoanStats } from "@/lib/api/loans";
import {
  getRegionalDashboard,
  type RegionalDashboard,
} from "@/lib/api/dashboard";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardDistributionCard } from "./DashboardDistributionCard";
import { DashboardCard } from "./DashboardCard";
import { DashboardBarList } from "./DashboardBarList";
import { DashboardLoansTable } from "./DashboardLoansTable";
import { DashboardActionTiles, type ActionTile } from "./DashboardActionTiles";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { loanStatusTone } from "./dashboard-status";

const LOAN_DONUT = ["active", "in_review", "approved", "closed", "rejected"] as const;

type RegionalAggregate = {
  summary: RegionalDashboard | null;
  loanStats: LoanStats | null;
  clientStats: ClientStats | null;
  recentLoans: Loan[];
};

/**
 * Regional-manager dashboard — institution-wide, read-only. Driven by
 * `GET /dashboards/regional` (per-agency active/delinquent/portfolio + totals),
 * with institution-wide loan/KYC distributions from `/loans/stats` and
 * `/clients/stats?scope=all`.
 */
export function DashboardRegionalLayout() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<RegionalAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [summary, loanStats, clientStats, recentLoans] = await Promise.all([
        safeNullable(() => getRegionalDashboard(token)),
        safeNullable(() => getLoanStats(token)),
        safeNullable(() => getClientStats(token, { scope: "all" })),
        safeArray(() => fetchLoans(token, { perPage: 6 }).then((r) => r.data)),
      ]);
      return { summary, loanStats, clientStats, recentLoans };
    },
    [token],
  );

  const { data, loading } = useApi(fetcher, [token]);

  if (session.status !== "authenticated") return null;

  const summary = data?.summary ?? null;
  const loanByStatus = data?.loanStats?.by_status ?? {};
  const kyc = data?.clientStats?.by_kyc_status ?? null;

  const loanSegments = LOAN_DONUT.map((status) => ({
    key: status,
    label: t(`dashboard.common.loanStatus.${status}`),
    value: loanByStatus[status] ?? 0,
    tone: loanStatusTone(status),
  }));
  const kycBars = [
    { key: "pending", label: t("dashboard.common.kycStatus.pending_review"), value: kyc?.pending ?? 0, tone: "warning" as const },
    { key: "verified", label: t("dashboard.common.kycStatus.verified"), value: kyc?.verified ?? 0, tone: "success" as const },
    { key: "rejected", label: t("dashboard.common.kycStatus.rejected"), value: kyc?.rejected ?? 0, tone: "danger" as const },
  ];

  const firstName = session.user.name.split(" ")[0];

  const actions: ActionTile[] = [
    { key: "loans", label: t("dashboard.loanTracking.title"), href: "/credit/loans", icon: BanknoteIcon, tone: "info" },
    { key: "clients", label: t("dashboard.kpi.clientsCount.title"), href: "/clients", icon: UsersIcon, tone: "accent" },
    { key: "agencies", label: t("dashboard.regional.kpi.agencies"), href: "/admin/agencies", icon: BuildingIcon, tone: "primary" },
  ];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.regional.greeting", { name: firstName })}
        subtitle={t("dashboard.regional.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStatTile
              icon={BanknoteIcon}
              tone="success"
              label={t("dashboard.regional.kpi.activeLoans")}
              value={summary?.active_loan_count ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={AlertTriangleIcon}
              tone="warning"
              label={t("dashboard.officer.kpi.delinquent")}
              value={summary?.delinquent_loan_count ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={BookIcon}
              tone="info"
              label={t("dashboard.officer.kpi.portfolio")}
              value={summary ? format.currencyMinor(summary.portfolio_outstanding_minor, { currency: "XAF" }) : "—"}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={BuildingIcon}
              tone="primary"
              label={t("dashboard.regional.kpi.agencies")}
              value={summary?.agencies.length ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DashboardDistributionCard
              title={t("dashboard.regional.loanDistTitle")}
              icon={BanknoteIcon}
              segments={loanSegments}
              loading={loading && !data}
            />
            <DashboardCard
              title={t("dashboard.regional.kycDistTitle")}
              icon={UsersIcon}
              tone="accent"
            >
              {loading && !data ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : (
                <DashboardBarList items={kycBars} />
              )}
            </DashboardCard>
          </div>

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
          <DashboardCard
            title={t("dashboard.regional.agenciesTitle")}
            icon={BuildingIcon}
            tone="primary"
            bodyClassName="px-5 py-2"
          >
            {loading && !data ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !summary || summary.agencies.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.common.empty.agencies")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {summary.agencies.map((agency) => (
                  <li key={agency.agency_public_id} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {agency.agency_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {agency.agency_code} ·{" "}
                        {format.currencyMinor(agency.portfolio_outstanding_minor, { currency: "XAF" })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {agency.active_loan_count}
                      </span>
                      {agency.delinquent_loan_count > 0 ? (
                        <Badge tone="danger">{agency.delinquent_loan_count}</Badge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

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
