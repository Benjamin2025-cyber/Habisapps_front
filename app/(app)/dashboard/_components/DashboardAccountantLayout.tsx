"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  BanknoteIcon,
  BookIcon,
  CalendarIcon,
  FileTextIcon,
  LayersIcon,
} from "@/components/ui/icons";
import {
  fetchCurrentAccountingDay,
  type AccountingDay,
} from "@/lib/api/accounting-days";
import {
  fetchJournalEntries,
  type JournalEntry,
} from "@/lib/api/journal-entries";
import { countLoans, fetchLoans, type Loan } from "@/lib/api/loans";
import { listAuditEvents, type AuditEvent } from "@/lib/api/audit";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardDistributionCard } from "./DashboardDistributionCard";
import { DashboardCard } from "./DashboardCard";
import { DashboardJournalTable } from "./DashboardJournalTable";
import { DashboardLoansTable } from "./DashboardLoansTable";
import { DashboardActionTiles, type ActionTile } from "./DashboardActionTiles";
import { DashboardActivitiesCard } from "./DashboardActivitiesCard";
import { DashboardNotificationsCard } from "./DashboardTellerSections";
import { journalStatusTone } from "./dashboard-status";

const JOURNAL_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "posted",
  "rejected",
] as const;

const DAY_OPEN_STATUSES = ["open", "reopened"];

type AccountantAggregate = {
  entries: JournalEntry[];
  approvedLoans: number | null;
  disburseQueue: Loan[];
  currentDay: AccountingDay | null;
  recentEvents: AuditEvent[];
};

/**
 * Accountant dashboard. Journal-entry workload (status donut + "to approve"
 * queue), the disbursement queue (loans ready to disburse), the current
 * accounting-day state, plus the audit feed and notifications. Journal counts
 * are derived client-side from a page of entries until a status filter / stats
 * endpoint lands (dashboard-request.md #4).
 */
export function DashboardAccountantLayout() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const canCreateEntry = useCan("journal.entries.create");
  const canDisburse = useCan("loans.disburse");
  const canManageDay = useCan("accounting.days.view");
  const canSeeAudit = useCan("audit.view");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AccountantAggregate> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [entries, approvedLoans, disburseQueue, currentDay, recentEvents] =
        await Promise.all([
          safeArray(() =>
            fetchJournalEntries(token, { perPage: 100 }).then((r) => r.data),
          ),
          safeNullable(() => countLoans(token, { status: "approved" })),
          safeArray(() =>
            fetchLoans(token, { perPage: 6, status: "approved" }).then((r) => r.data),
          ),
          safeNullable(() => fetchCurrentAccountingDay(token)),
          canSeeAudit
            ? safeArray(() =>
                listAuditEvents(token, { perPage: 10 }).then((r) => r.data),
              )
            : [],
        ]);
      return { entries, approvedLoans, disburseQueue, currentDay, recentEvents };
    },
    [token, canSeeAudit],
  );

  const { data, loading } = useApi(fetcher, [token, canSeeAudit]);

  if (session.status !== "authenticated") return null;

  const entries = data?.entries ?? [];
  const byStatus = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});
  const submitted = entries.filter((e) => e.status === "submitted");
  const postedCount = byStatus.posted ?? 0;

  const segments = JOURNAL_STATUSES.map((status) => ({
    key: status,
    label: t(`dashboard.common.journalStatus.${status}`),
    value: byStatus[status] ?? 0,
    tone: journalStatusTone(status),
  }));

  const day = data?.currentDay ?? null;
  const dayOpen = day ? DAY_OPEN_STATUSES.includes(day.status) : false;

  const firstName = session.user.name.split(" ")[0];

  const actions: ActionTile[] = [
    canCreateEntry && {
      key: "newEntry",
      label: t("dashboard.accountant.actions.newEntry"),
      href: "/accounting/journal-entries",
      icon: FileTextIcon,
      tone: "accent" as const,
    },
    canDisburse && {
      key: "disburse",
      label: t("dashboard.accountant.actions.disburse"),
      href: "/credit/disbursement",
      icon: BanknoteIcon,
      tone: "success" as const,
    },
    canManageDay && {
      key: "day",
      label: t("dashboard.accountant.actions.day"),
      href: "/admin/accounting-day",
      icon: CalendarIcon,
      tone: "info" as const,
    },
    {
      key: "reports",
      label: t("dashboard.accountant.actions.reports"),
      href: "/reports/journal",
      icon: BookIcon,
      tone: "primary" as const,
    },
  ].filter(Boolean) as ActionTile[];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.accountant.greeting", { name: firstName })}
        subtitle={t("dashboard.accountant.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStatTile
              icon={FileTextIcon}
              tone="warning"
              label={t("dashboard.accountant.kpi.pendingEntries")}
              value={submitted.length}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={BanknoteIcon}
              tone="success"
              label={t("dashboard.accountant.kpi.toDisburse")}
              value={data?.approvedLoans ?? (loading ? "…" : "—")}
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={CalendarIcon}
              tone={dayOpen ? "success" : "danger"}
              label={t("dashboard.accountant.kpi.accountingDay")}
              value={
                day
                  ? t(`dashboard.accountant.day.${dayOpen ? "open" : "closed"}`)
                  : t("dashboard.accountant.day.none")
              }
              loading={loading && !data}
            />
            <DashboardStatTile
              icon={LayersIcon}
              tone="info"
              label={t("dashboard.accountant.kpi.postedToday")}
              value={postedCount}
              loading={loading && !data}
            />
          </div>

          <DashboardDistributionCard
            title={t("dashboard.accountant.journalTitle")}
            icon={FileTextIcon}
            segments={segments}
            loading={loading && !data}
          />

          <DashboardCard
            title={t("dashboard.accountant.queueTitle")}
            icon={FileTextIcon}
            tone="warning"
            action={{
              href: "/accounting/journal-entries",
              label: t("dashboard.accountant.queueViewAll"),
            }}
            bodyClassName="px-5 py-2"
          >
            <DashboardJournalTable
              entries={loading && !data ? null : submitted.slice(0, 6)}
              loading={loading && !data}
              emptyLabel={t("dashboard.accountant.queueEmpty")}
            />
          </DashboardCard>

          <DashboardCard
            title={t("dashboard.accountant.disburseTitle")}
            icon={BanknoteIcon}
            tone="success"
            action={{
              href: "/credit/disbursement",
              label: t("dashboard.accountant.disburseViewAll"),
            }}
            bodyClassName="px-5 py-2"
          >
            <DashboardLoansTable
              loans={data?.disburseQueue ?? null}
              loading={loading && !data}
            />
          </DashboardCard>
        </div>

        <aside className="flex flex-col gap-4">
          <DashboardCard
            title={t("dashboard.accountant.day.title")}
            icon={CalendarIcon}
            tone={dayOpen ? "success" : "danger"}
            action={
              canManageDay
                ? { href: "/admin/accounting-day", label: t("dashboard.accountant.day.manage") }
                : undefined
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {t("dashboard.accountant.day.businessDate")}
              </span>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {day?.business_date ? format.date(day.business_date) : "—"}
              </span>
            </div>
            <div className="mt-3">
              <Badge tone={dayOpen ? "success" : day ? "danger" : "neutral"}>
                {day
                  ? t(`dashboard.accountant.day.${dayOpen ? "open" : "closed"}`)
                  : t("dashboard.accountant.day.none")}
              </Badge>
            </div>
          </DashboardCard>

          <DashboardActionTiles
            title={t("dashboard.common.quickActions")}
            actions={actions}
          />

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
