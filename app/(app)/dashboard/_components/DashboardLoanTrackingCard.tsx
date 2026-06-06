"use client";

import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  DashboardTimeseriesPoint,
  OperationalDashboard,
} from "@/lib/api/dashboard";
import { DashboardLineChart, type LineSeries } from "./DashboardLineChart";

type Props = {
  data: OperationalDashboard | null;
  /** Timeseries points for the mini trend chart. */
  points?: DashboardTimeseriesPoint[] | null;
};

/**
 * "Suivi des Crédits" panel from PDF p6: three KPI rows (granted, delinquent,
 * repaid) on top, and the small time-series chart placeholder underneath.
 */
export function DashboardLoanTrackingCard({ data, points }: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const series: LineSeries[] = points
    ? [
        { label: "balance", color: "var(--color-info)", values: points.map((p) => p.balance_minor) },
        { label: "collection", color: "var(--color-success)", values: points.map((p) => p.collection_minor) },
      ]
    : [];

  // We surface monetary figures from the operational dashboard:
  //  - Granted today / on period   ≈ collections.expected_collection_minor
  //  - Delinquent (PAR total)      = par 30+60+90
  //  - Repaid                       = collections.actual_collection_minor
  // Once we wire `loans.scope.period` disbursement aggregation, swap "Granted"
  // for that more accurate figure.
  const granted = data?.collections.expected_collection_minor ?? null;
  const delinquent =
    data === null
      ? null
      : data.par.par30_outstanding_at_risk_minor +
        data.par.par60_outstanding_at_risk_minor +
        data.par.par90_outstanding_at_risk_minor;
  const repaid = data?.collections.actual_collection_minor ?? null;

  const rows: ReadonlyArray<{
    label: string;
    value: number | null;
    dotColor: string;
  }> = [
    {
      label: t("dashboard.loanTracking.granted"),
      value: granted,
      dotColor: "var(--color-info)",
    },
    {
      label: t("dashboard.loanTracking.delinquent"),
      value: delinquent,
      dotColor: "var(--color-danger)",
    },
    {
      label: t("dashboard.loanTracking.repaid"),
      value: repaid,
      dotColor: "var(--color-success)",
    },
  ];

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("dashboard.loanTracking.title")}
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("dashboard.loanTracking.filterAllAgencies")}
        </span>
      </header>

      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.dotColor }}
              />
              {row.label}
            </span>
            <span className="text-base font-bold tabular-nums text-foreground">
              {row.value === null ? "—" : format.currencyMinor(row.value)}
            </span>
          </li>
        ))}
      </ul>

      {points && points.length > 0 ? (
        <DashboardLineChart series={series} xLabels={[]} height={120} />
      ) : (
        <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
          {data === null ? t("common.loading") : t("dashboard.chartEmpty")}
        </div>
      )}
    </article>
  );
}
