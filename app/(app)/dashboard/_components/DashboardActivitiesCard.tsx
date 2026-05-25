"use client";

import { Button } from "@/components/ui/Button";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { AuditEvent } from "@/lib/api/audit";

type Props = {
  events: AuditEvent[] | null;
  loading?: boolean;
};

/**
 * Audit-feed table mirroring PDF p6 "Activités récentes".
 * Each row is (actor name, description, relative time).
 */
export function DashboardActivitiesCard({ events, loading }: Props) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("dashboard.recentActivities.title")}
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("dashboard.recentActivities.today")}
        </span>
      </header>

      {loading && events === null ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <li
              key={index}
              className="flex h-8 animate-pulse items-center justify-between gap-3 rounded bg-muted/40"
            />
          ))}
        </ul>
      ) : !events || events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("dashboard.recentActivities.empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {events.map((event) => {
            const actor =
              event.causer?.name ?? t("shell.userMenu.noRole");
            return (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
              >
                <span className="font-semibold text-foreground">{actor}</span>
                <span className="flex-1 text-muted-foreground">
                  {humanize(event)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {format.relative(event.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="primary" size="sm" className="self-start">
        {t("dashboard.viewMore")}
      </Button>
    </article>
  );
}

function humanize(event: AuditEvent): string {
  // The activitylog package stores event names like `auth.login_succeeded`,
  // `staff.created`, etc. We render the description if present and fall back
  // to a cleaned-up event key.
  if (event.description && event.description.length > 0) {
    return event.description;
  }
  if (event.event && event.event.length > 0) {
    return event.event.replace(/[._]/g, " ");
  }
  return "—";
}
