"use client";

import {
  BanknoteIcon,
  BookIcon,
  CashIcon,
  UsersIcon,
  WorkflowIcon,
} from "@/components/ui/icons";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import { DashboardActionGrid, type DashboardAction } from "./DashboardActionGrid";
import { DashboardCashDrawerCard } from "./DashboardCashDrawerCard";
import {
  DashboardAccountsOverview,
  DashboardCustomerFocusCard,
  DashboardNotificationsCard,
  DashboardRecentTransactions,
} from "./DashboardTellerPlaceholders";

/**
 * Dedicated cash-desk dashboard for the `teller` role: a real cash-drawer /
 * session summary + cash quick-actions + tips. Recent-transactions and live
 * balance are deferred (no teller-transactions list endpoint — back-issue #24).
 */
export function DashboardTellerLayout() {
  const t = useTranslations();
  const session = useSession();
  if (session.status !== "authenticated") return null;

  const firstName = session.user.name.split(" ")[0];

  const actions: DashboardAction[] = [
    {
      key: "deposit",
      label: t("dashboard.teller.actions.deposit"),
      href: "/operations/transactions",
      icon: CashIcon,
      tone: "success",
    },
    {
      key: "withdrawal",
      label: t("dashboard.teller.actions.withdrawal"),
      href: "/operations/transactions",
      icon: BanknoteIcon,
      tone: "danger",
    },
    {
      key: "sessions",
      label: t("dashboard.teller.actions.sessions"),
      href: "/operations/sessions",
      icon: WorkflowIcon,
      tone: "accent",
    },
    {
      key: "clients",
      label: t("dashboard.teller.actions.clients"),
      href: "/clients",
      icon: UsersIcon,
      tone: "primary",
    },
    {
      key: "accounts",
      label: t("dashboard.teller.actions.accounts"),
      href: "/accounts",
      icon: BookIcon,
      tone: "info",
    },
  ];

  return (
    <>
      <PageHeader
        title={t("dashboard.teller.greeting", { name: firstName })}
        description={t("dashboard.teller.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Main column — customer context + activity (placeholder where no API yet) */}
        <div className="flex flex-col gap-4">
          <DashboardCustomerFocusCard />
          <DashboardAccountsOverview />
          <DashboardRecentTransactions />
        </div>

        {/* Right column — real session/actions + notifications + tips */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t("dashboard.teller.actionsTitle")}
            </h3>
            <DashboardActionGrid actions={actions} />
          </section>

          <DashboardCashDrawerCard />

          <DashboardNotificationsCard />

          <section className="rounded-[var(--radius-card)] border border-accent/30 bg-accent/5 p-5">
            <h3 className="mb-2 text-sm font-semibold text-accent">
              {t("dashboard.teller.tipsTitle")}
            </h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
              <li>{t("dashboard.teller.tips.t1")}</li>
              <li>{t("dashboard.teller.tips.t2")}</li>
              <li>{t("dashboard.teller.tips.t3")}</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
