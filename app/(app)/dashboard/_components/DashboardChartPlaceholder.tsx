"use client";

import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  title: string;
  subtitle?: string;
  /** Period filter pills (today / week / month / year). */
  rangeOptions?: ReadonlyArray<{ value: string; label: string }>;
  activeRange?: string;
  onRangeChange?: (next: string) => void;
  /** Legend at the bottom (series labels with their colour dot). */
  legend?: ReadonlyArray<{ label: string; color: string }>;
  className?: string;
};

/**
 * Reusable "chart slot" placeholder used by Performances Financières and the
 * Suivi des Crédits mini-chart, until the time-series API endpoint lands.
 * Renders the same chrome (header, filters, legend) so swapping in a real
 * chart later only changes the centre.
 */
export function DashboardChartPlaceholder({
  title,
  subtitle,
  rangeOptions,
  activeRange,
  onRangeChange,
  legend,
  className,
}: Props) {
  const t = useTranslations();
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
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
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

      <div className="flex h-56 items-center justify-center rounded-[var(--radius-field)] border border-dashed border-border bg-muted/20 px-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <ChartIcon />
          <p className="text-sm font-medium text-foreground">
            {t("dashboard.comingSoon")}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {t("dashboard.comingSoonChart")}
          </p>
        </div>
      </div>

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

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 text-muted-foreground/60"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 3-3 3 3 4-5" />
    </svg>
  );
}
