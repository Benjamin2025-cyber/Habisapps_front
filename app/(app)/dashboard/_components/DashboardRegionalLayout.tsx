"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  BanknoteIcon,
  BuildingIcon,
  CheckCircleIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import { countClients, fetchLoans, type Loan } from "@/lib/api/loans";
import { countClientsByKyc, countLoansByStatus } from "@/lib/api/dashboard-stats";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardDistributionCard } from "./DashboardDistributionCard";
import { DashboardCard } from "./DashboardCard";
import { DashboardBarList } from "./DashboardBarList";
import { DashboardLoansTable } from "./DashboardLoansTable";
import { DashboardActionTiles, type ActionTile } from "./DashboardActionTiles";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { kycStatusTone, loanStatusTone, type StatusTone } from "./dashboard-status";

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
const KYC_STATUSES = [
  "draft",
  "pending_review",
  "verified",
  "rejected",
  "suspended",
  "archived",
] as const;
const KYC_BARS = ["draft", "pending_review", "verified", "rejected"] as const;

const AGENCY_STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  archived: "neutral",
};

type RegionalAggregate = {
  loansByStatus: Record<string, number>;
  clientsByKyc: Record<string, number>;
  clientsTotal: number | null;
  agencies: Agency[];
  agenciesTotal: number;
  recentLoans: Loan[];
};

/**
 * Regional-manager dashboard — institution-wide, read-only. `/loans` and
 * `/clients` (with `scope=all`) return cross-agency data thanks to the
 * `*.scope.institution.read` grants, so portfolio/KYC distributions are
 * institution totals. Per-agency performance is the agency directory until the
 * aggregation endpoint lands (dashboard-request.md #8).
 */
export function DashboardRegionalLayout() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<RegionalAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [loansByStatus, clientsByKyc, clientsTotal, agenciesPage, recentLoans] =
        await Promise.all([
          countLoansByStatus(token, LOAN_STATUSES),
          countClientsByKyc(token, KYC_STATUSES, "all"),
          safeNullable(() => countClients(token, { scope: "all" })),
          fetchAgencies(token, { perPage: 6 }).catch(() => ({
            data: [] as Agency[],
            meta: { pagination: { total: 0 } },
          })),
          safeArray(() => fetchLoans(token, { perPage: 6 }).then((r) => r.data)),
        ]);
      return {
        loansByStatus,
        clientsByKyc,
        clientsTotal,
        agencies: agenciesPage.data,
        agenciesTotal: agenciesPage.meta?.pagination?.total ?? agenciesPage.data.length,
        recentLoans,
      };
    },
    [token],
  );

  const { data, loading } = useApi(fetcher, [token]);

  if (session.status !== "authenticated") return null;

  const loansByStatus = data?.loansByStatus ?? {};
  const totalLoans = LOAN_STATUSES.reduce((sum, s) => sum + (loansByStatus[s] ?? 0), 0);
  const clientsByKyc = data?.clientsByKyc ?? {};

  const loanSegments = LOAN_DONUT.map((status) => ({
    key: status,
    label: t(`dashboard.common.loanStatus.${status}`),
    value: loansByStatus[status] ?? 0,
    tone: loanStatusTone(status),
  }));
  const kycBars = KYC_BARS.map((status) => ({
    key: status,
    label: t(`dashboard.common.kycStatus.${status}`),
    value: clientsByKyc[status] ?? 0,
    tone: kycStatusTone(status),
  }));

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
              tone="info"
              label={t("dashboard.regional.kpi.totalLoans")}
              value={totalLoans}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={CheckCircleIcon}
              tone="success"
              label={t("dashboard.regional.kpi.activeLoans")}
              value={loansByStatus.active ?? 0}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={UsersIcon}
              tone="accent"
              label={t("dashboard.regional.kpi.clients")}
              value={data?.clientsTotal ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={BuildingIcon}
              tone="primary"
              label={t("dashboard.regional.kpi.agencies")}
              value={data?.agenciesTotal ?? (loading ? "…" : "—")}
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
          >
            {loading && !data ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !data || data.agencies.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.common.empty.agencies")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.agencies.map((agency) => (
                  <li
                    key={agency.public_id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {agency.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {agency.code}
                        {agency.city ? ` · ${agency.city}` : ""}
                      </span>
                    </span>
                    <Badge tone={AGENCY_STATUS_TONE[agency.status] ?? "neutral"}>
                      {agency.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("dashboard.regional.agenciesSoon")}
            </p>
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
