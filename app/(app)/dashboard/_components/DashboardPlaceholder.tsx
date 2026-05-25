"use client";

import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";

/**
 * Placeholder dashboard. Will be replaced by the real KPIs / alerts /
 * activities in P3 once `/api/v1/dashboards/operational` is wired up.
 */
export function DashboardPlaceholder() {
  const t = useTranslations();
  const session = useSession();

  // The (app)/layout already guards anonymous sessions; this narrows the type.
  if (session.status !== "authenticated") return null;

  return (
    <>
      <PageHeader
        title={t("dashboard.pageTitle")}
        description={t("dashboard.placeholder.intro")}
      />

      <section className="rounded-[var(--radius-card)] border border-border bg-background p-8 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.15)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t("dashboard.placeholder.greeting", {
              name: session.user.name.split(" ")[0],
            })}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("dashboard.placeholder.intro")}
          </p>
        </div>
      </section>
    </>
  );
}
