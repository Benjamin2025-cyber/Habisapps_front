"use client";

import { cn } from "@/lib/cn";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { DashboardTimeseriesPoint } from "@/lib/api/dashboard";
import { DashboardLineChart, type LineSeries } from "./DashboardLineChart";

type Props = {
  title: string;
  subtitle?: string;
  rangeOptions?: ReadonlyArray<{ value: string; label: string }>;
  activeRange?: string;
  onRangeChange?: (next: string) => void;
  legend?: ReadonlyArray<{ label: string; color: string }>;
  points: DashboardTimeseriesPoint[] | null;
  granularity?: string;
  currency?: string;
  loading?: boolean;
  className?: string;
};

/** Format a bucket label for the x-axis based on the series granularity. */
function formatBucket(bucket: string, granularity?: string): string {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  if (granularity === "hour") {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (granularity === "month") {
    return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

/**
 * "Performances financières" trend card — real two-series line chart (balance +
 * collection) wired to `GET /dashboards/operational/timeseries`. Keeps the same
 * chrome (title, range pills, legend) as the former placeholder so the layout is
 * unchanged; shows a loading line and an honest empty state.
 */
export function DashboardTrendCard({
  title,
  subtitle,
  rangeOptions,
  activeRange,
  onRangeChange,
  legend,
  points,
  granularity,
  currency,
  loading,
  className,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const series: LineSeries[] = points
    ? [
        {
          label: "balance",
          color: "var(--color-primary)",
          values: points.map((p) => p.balance_minor),
        },
        {
          label: "collection",
          color: "var(--color-accent)",
          values: points.map((p) => p.collection_minor),
        },
      ]
    : [];
  const xLabels = points ? points.map((p) => formatBucket(p.bucket, granularity)) : [];

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-6",
        "shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>

        {rangeOptions && rangeOptions.length > 0 ? (
          <div className="inline-flex items-center gap-1 rounded-[var(--radius-field)] border border-border bg-muted/30 p-0.5">
            {rangeOptions.map((option) => {
              const active = activeRange === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onRangeChange?.(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-[var(--radius-field)] px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {loading && !points ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : !points || points.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          {t("dashboard.chartEmpty")}
        </div>
      ) : (
        <DashboardLineChart
          series={series}
          xLabels={xLabels}
          formatValue={(v) => format.currencyMinor(v, { currency: currency ?? "XAF" })}
        />
      )}

      {legend && legend.length > 0 ? (
        <footer className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          {legend.map((entry) => (
            <span key={entry.label} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.label}</span>
            </span>
          ))}
        </footer>
      ) : null}
    </article>
  );
}
