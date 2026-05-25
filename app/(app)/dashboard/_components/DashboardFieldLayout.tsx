"use client";

import { useCallback } from "react";
import {
  BanknoteIcon,
  CashIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { countClients, countLoans } from "@/lib/api/loans";
import { listAuditEvents, type AuditEvent } from "@/lib/api/audit";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import { DashboardKpiCard } from "./DashboardKpiCard";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardActivitiesCard } from "./DashboardActivitiesCard";

type FieldAggregate = {
  loansCount: number | null;
  clientsCount: number | null;
  kycPendingCount: number | null;
  recentEvents: AuditEvent[];
};

/**
 * Layout for the `field` preset (loan-officer, kyc-officer, accountant,
 * teller, regional-manager, user-admin). Renders only the panels each role's
 * permission set unlocks — counts they can read + their recent activity feed.
 *
 * Roles that 403 on `/dashboards/operational` (everyone here except in some
 * cases) never call it. This keeps the layout snappy and avoids noisy errors.
 */
export function DashboardFieldLayout() {
  const t = useTranslations();
  const session = useSession();
  const canSeeLoans = useCan("loans.view");
  const canSeeClients = useCan("crm.clients.view");
  const canSeeAudit = useCan("audit.view");
  const canReviewKyc = useCan("crm.kyc.review");
  const canSeeTill = useCan("cash.sessions.view");

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<FieldAggregate> => {
      if (!token) throw new Error("Missing session token");
      const [loansCount, clientsCount, kycPendingCount, recentEvents] =
        await Promise.all([
          canSeeLoans ? safeNumber(() => countLoans(token, { status: "active" })) : null,
          // Field roles default to agency scope on /clients — no scope=all here.
          canSeeClients ? safeNumber(() => countClients(token, { status: "active" })) : null,
          canReviewKyc
            ? safeNumber(() =>
                countClients(token, { kyc_status: "pending_verification" }),
              )
            : null,
          canSeeAudit
            ? safeArray(() =>
                listAuditEvents(token, { perPage: 8 }).then((response) => response.data),
              )
            : [],
        ]);
      void signal;
      return { loansCount, clientsCount, kycPendingCount, recentEvents };
    },
    [token, canSeeLoans, canSeeClients, canSeeAudit, canReviewKyc],
  );

  const { data, loading } = useApi(fetcher, [
    token,
    canSeeLoans,
    canSeeClients,
    canSeeAudit,
    canReviewKyc,
  ]);

  if (session.status !== "authenticated") return null;

  const cards: Array<{
    key: string;
    visible: boolean;
    node: React.ReactNode;
  }> = [
    {
      key: "loans",
      visible: canSeeLoans,
      node: (
        <DashboardKpiCard
          icon={BanknoteIcon}
          tone="info"
          label={t("dashboard.field.loansCount")}
          value={data?.loansCount ?? (loading ? "…" : "—")}
        />
      ),
    },
    {
      key: "clients",
      visible: canSeeClients,
      node: (
        <DashboardKpiCard
          icon={UsersIcon}
          tone="primary"
          label={t("dashboard.field.clientsCount")}
          value={data?.clientsCount ?? (loading ? "…" : "—")}
        />
      ),
    },
    {
      key: "kyc",
      visible: canReviewKyc,
      node: (
        <DashboardKpiCard
          icon={ShieldIcon}
          tone="warning"
          label={t("dashboard.field.kycPendingCount")}
          value={data?.kycPendingCount ?? (loading ? "…" : "—")}
        />
      ),
    },
    {
      key: "till",
      visible: canSeeTill,
      node: (
        <DashboardKpiCard
          icon={CashIcon}
          tone="accent"
          label={t("dashboard.field.todaySession")}
          value={t("dashboard.field.todaySessionClosed")}
          hint={t("dashboard.comingSoon")}
        />
      ),
    },
  ];

  const visibleCards = cards.filter((card) => card.visible);

  return (
    <>
      <PageHeader title={t("dashboard.field.title")} description={t("dashboard.field.intro")} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <DashboardQuickActions />
      </div>

      {visibleCards.length > 0 ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleCards.map((card) => (
            <div key={card.key}>{card.node}</div>
          ))}
        </section>
      ) : null}

      {canSeeAudit ? (
        <DashboardActivitiesCard
          events={data?.recentEvents ?? null}
          loading={loading && !data}
        />
      ) : null}
    </>
  );
}

async function safeNumber(fn: () => Promise<number>): Promise<number | null> {
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
