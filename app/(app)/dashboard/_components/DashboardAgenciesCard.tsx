"use client";

import { Button } from "@/components/ui/Button";
import { useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * Placeholder for the bottom-right "Performance des agences" table.
 *
 * The data table requires a new API endpoint that returns per-agency
 * aggregations (collections, top officer, active loans count, delinquent
 * count). See BUILDABLE_PAGES.md for the exact ask. Until it ships, render
 * the column headers and a "coming soon" note so the layout is faithful.
 */
export function DashboardAgenciesCard() {
  const t = useTranslations();
  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("dashboard.agenciesPerformance.title")}
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("dashboard.agenciesPerformance.thisMonth")}
        </span>
      </header>

      <div className="overflow-hidden rounded-[var(--radius-field)] border border-dashed border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              {[
                t("dashboard.agenciesPerformance.columns.agency"),
                t("dashboard.agenciesPerformance.columns.collections"),
                t("dashboard.agenciesPerformance.columns.topAgent"),
                t("dashboard.agenciesPerformance.columns.loans"),
                t("dashboard.agenciesPerformance.columns.delinquent"),
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-3 py-2 text-left font-semibold text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={5}
                className="px-3 py-10 text-center text-xs text-muted-foreground"
              >
                <p className="font-medium text-foreground">
                  {t("dashboard.comingSoon")}
                </p>
                <p className="mt-1">
                  {t("dashboard.agenciesPerformance.comingSoon")}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Button variant="primary" size="sm" disabled className="self-start">
        {t("dashboard.viewMore")}
      </Button>
    </article>
  );
}
