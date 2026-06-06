"use client";

import { useCallback } from "react";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { fetchClients, type Client } from "@/lib/api/clients";
import { countClientsByKyc } from "@/lib/api/dashboard-stats";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardCard } from "./DashboardCard";
import { DashboardBarList } from "./DashboardBarList";
import { DashboardClientsTable } from "./DashboardClientsTable";
import { DashboardActionTiles, type ActionTile } from "./DashboardActionTiles";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { kycStatusTone } from "./dashboard-status";

const FUNNEL_STATUSES = ["draft", "pending_review", "verified", "rejected"] as const;
const ALL_KYC_STATUSES = [
  "draft",
  "pending_review",
  "verified",
  "rejected",
  "suspended",
  "archived",
] as const;

type KycAggregate = {
  byKyc: Record<string, number>;
  queue: Client[];
};

/**
 * KYC-officer dashboard. Verification funnel + queue. Counts come from per-status
 * `countClients` probes (agency-scoped); the review queue is `fetchClients`
 * filtered to `pending_review`.
 */
export function DashboardKycLayout() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const canCreateClient = useCan("crm.clients.create");
  const canSeeClients = useCan("crm.clients.view");
  const canSeeGuarantors = useCan("crm.guarantors.view");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<KycAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [byKyc, queue] = await Promise.all([
        countClientsByKyc(token, ALL_KYC_STATUSES),
        safeArray(() =>
          fetchClients(token, { kycStatus: "pending_review", perPage: 6 }).then(
            (r) => r.data,
          ),
        ),
      ]);
      return { byKyc, queue };
    },
    [token],
  );

  const { data, loading } = useApi(fetcher, [token]);

  if (session.status !== "authenticated") return null;

  const byKyc = data?.byKyc ?? {};
  const total = ALL_KYC_STATUSES.reduce((sum, s) => sum + (byKyc[s] ?? 0), 0);

  const funnel = FUNNEL_STATUSES.map((status) => ({
    key: status,
    label: t(`dashboard.common.kycStatus.${status}`),
    value: byKyc[status] ?? 0,
    tone: kycStatusTone(status),
  }));

  const firstName = session.user.name.split(" ")[0];

  const actions: ActionTile[] = [
    canCreateClient && {
      key: "newClient",
      label: t("dashboard.kyc.actions.newClient"),
      href: "/clients",
      icon: UsersIcon,
      tone: "accent" as const,
    },
    canSeeClients && {
      key: "queue",
      label: t("dashboard.kyc.actions.queue"),
      href: "/clients",
      icon: ShieldIcon,
      tone: "warning" as const,
    },
    canSeeGuarantors && {
      key: "guarantors",
      label: t("dashboard.kyc.actions.guarantors"),
      href: "/guarantors",
      icon: UsersIcon,
      tone: "info" as const,
    },
  ].filter(Boolean) as ActionTile[];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.kyc.greeting", { name: firstName })}
        subtitle={t("dashboard.kyc.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStatTile
              icon={ShieldIcon}
              tone="warning"
              label={t("dashboard.kyc.kpi.toVerify")}
              value={byKyc.pending_review ?? 0}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={CheckCircleIcon}
              tone="success"
              label={t("dashboard.kyc.kpi.verified")}
              value={byKyc.verified ?? 0}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={AlertCircleIcon}
              tone="danger"
              label={t("dashboard.kyc.kpi.rejected")}
              value={byKyc.rejected ?? 0}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={UsersIcon}
              tone="accent"
              label={t("dashboard.kyc.kpi.total")}
              value={total}
              loading={loading && !data}
            />
          </div>

          <DashboardCard
            title={t("dashboard.kyc.funnelTitle")}
            icon={ShieldIcon}
            tone="accent"
          >
            {loading && !data ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : (
              <DashboardBarList items={funnel} />
            )}
          </DashboardCard>

          <DashboardCard
            title={t("dashboard.kyc.queueTitle")}
            icon={ShieldIcon}
            tone="warning"
            action={{ href: "/clients", label: t("dashboard.kyc.queueViewAll") }}
            bodyClassName="px-5 py-2"
          >
            <DashboardClientsTable
              clients={data?.queue ?? null}
              loading={loading && !data}
              emptyLabel={t("dashboard.kyc.queueEmpty")}
            />
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
