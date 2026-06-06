"use client";

import { useCallback } from "react";
import {
  CheckCircleIcon,
  FileTextIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { fetchClients, type Client } from "@/lib/api/clients";
import { countClients, countLoans, fetchLoans, type Loan } from "@/lib/api/loans";
import { countClientsByKyc } from "@/lib/api/dashboard-stats";
import { listAuditEvents, type AuditEvent } from "@/lib/api/audit";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardCard } from "./DashboardCard";
import { DashboardBarList } from "./DashboardBarList";
import { DashboardClientsTable } from "./DashboardClientsTable";
import { DashboardLoansTable } from "./DashboardLoansTable";
import { DashboardActivitiesCard } from "./DashboardActivitiesCard";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { kycStatusTone } from "./dashboard-status";

const KYC_STATUSES = [
  "draft",
  "pending_review",
  "verified",
  "rejected",
  "suspended",
  "archived",
] as const;
const KYC_BARS = ["draft", "pending_review", "verified", "rejected"] as const;

type ComplianceAggregate = {
  byKyc: Record<string, number>;
  clientsTotal: number | null;
  controlCount: number | null;
  kycQueue: Client[];
  controlQueue: Loan[];
  recentEvents: AuditEvent[];
};

/**
 * Compliance-officer dashboard — institution KYC control + loan control
 * sign-offs (`loans.approvals.controle`) + audit. KYC counts are institution-wide
 * (`scope=all`). The control queue approximates "loans awaiting control" with the
 * `in_review` status until a precise approval-step filter lands.
 */
export function DashboardComplianceLayout() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const canSeeAudit = useCan("audit.view");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ComplianceAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [byKyc, clientsTotal, controlCount, kycQueue, controlQueue, recentEvents] =
        await Promise.all([
          countClientsByKyc(token, KYC_STATUSES, "all"),
          safeNullable(() => countClients(token, { scope: "all" })),
          safeNullable(() => countLoans(token, { status: "in_review" })),
          safeArray(() =>
            fetchClients(token, {
              scope: "all",
              kycStatus: "pending_review",
              perPage: 6,
            }).then((r) => r.data),
          ),
          safeArray(() =>
            fetchLoans(token, { perPage: 6, status: "in_review" }).then((r) => r.data),
          ),
          canSeeAudit
            ? safeArray(() => listAuditEvents(token, { perPage: 10 }).then((r) => r.data))
            : [],
        ]);
      return { byKyc, clientsTotal, controlCount, kycQueue, controlQueue, recentEvents };
    },
    [token, canSeeAudit],
  );

  const { data, loading } = useApi(fetcher, [token, canSeeAudit]);

  if (session.status !== "authenticated") return null;

  const byKyc = data?.byKyc ?? {};
  const kycBars = KYC_BARS.map((status) => ({
    key: status,
    label: t(`dashboard.common.kycStatus.${status}`),
    value: byKyc[status] ?? 0,
    tone: kycStatusTone(status),
  }));

  const firstName = session.user.name.split(" ")[0];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.compliance.greeting", { name: firstName })}
        subtitle={t("dashboard.compliance.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatTile
          icon={ShieldIcon}
          tone="warning"
          label={t("dashboard.compliance.kpi.kycToControl")}
          value={byKyc.pending_review ?? 0}
          loading={loading && !data}
        />
        <DashboardStatTile
          icon={FileTextIcon}
          tone="info"
          label={t("dashboard.compliance.kpi.controlApprovals")}
          value={data?.controlCount ?? (loading ? "…" : "—")}
          loading={loading && !data}
        />
        <DashboardStatTile
          icon={UsersIcon}
          tone="accent"
          label={t("dashboard.compliance.kpi.clients")}
          value={data?.clientsTotal ?? (loading ? "…" : "—")}
          loading={loading && !data}
        />
        <DashboardStatTile
          icon={CheckCircleIcon}
          tone="success"
          label={t("dashboard.compliance.kpi.verified")}
          value={byKyc.verified ?? 0}
          loading={loading && !data}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <DashboardCard
            title={t("dashboard.compliance.kycQueueTitle")}
            icon={ShieldIcon}
            tone="warning"
            action={{ href: "/clients", label: t("dashboard.compliance.kycQueueViewAll") }}
            bodyClassName="px-5 py-2"
          >
            <DashboardClientsTable
              clients={data?.kycQueue ?? null}
              loading={loading && !data}
              emptyLabel={t("dashboard.compliance.kycQueueEmpty")}
            />
          </DashboardCard>

          <DashboardCard
            title={t("dashboard.compliance.controlQueueTitle")}
            icon={FileTextIcon}
            tone="info"
            action={{ href: "/credit/decision", label: t("dashboard.compliance.controlQueueViewAll") }}
            bodyClassName="px-5 py-2"
          >
            <DashboardLoansTable
              loans={data?.controlQueue ?? null}
              loading={loading && !data}
            />
          </DashboardCard>
        </div>

        <aside className="flex flex-col gap-4">
          <DashboardCard
            title={t("dashboard.compliance.funnelTitle")}
            icon={ShieldIcon}
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

          {canSeeAudit ? (
            <DashboardActivitiesCard
              events={data?.recentEvents ?? null}
              loading={loading && !data}
            />
          ) : null}

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
