"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { AgencyPerformanceRow } from "@/lib/api/dashboard";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  rows: AgencyPerformanceRow[] | null;
  currency?: string;
  loading?: boolean;
};

/**
 * "Performance des agences" — one row per agency (collections, top collector,
 * loans count, delinquent count) from `GET /dashboards/agencies-performance`.
 */
export function DashboardAgenciesCard({ rows, currency, loading }: Props) {
  const t = useTranslations();
  const format = useFormatter();

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

      <div className="overflow-x-auto rounded-[var(--radius-field)] border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-muted-foreground">
                {t("dashboard.agenciesPerformance.columns.agency")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-muted-foreground">
                {t("dashboard.agenciesPerformance.columns.collections")}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-muted-foreground">
                {t("dashboard.agenciesPerformance.columns.topAgent")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-muted-foreground">
                {t("dashboard.agenciesPerformance.columns.loans")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-muted-foreground">
                {t("dashboard.agenciesPerformance.columns.delinquent")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !rows ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  {t("common.loading")}
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  {t("dashboard.common.empty.agencies")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.agency_public_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <span className="block font-medium text-foreground">{row.agency_name}</span>
                    <span className="block text-[0.7rem] text-muted-foreground">{row.agency_code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">
                    {format.currencyMinor(row.collections_minor, { currency: currency ?? "XAF" })}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.best_agent_name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {row.loans_count}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.delinquent_count > 0 ? (
                      <Badge tone="danger">{row.delinquent_count}</Badge>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Link
        href="/admin/agencies"
        className="inline-flex items-center gap-1 self-start text-xs font-semibold text-accent hover:underline"
      >
        {t("dashboard.viewMore")}
      </Link>
    </article>
  );
}
