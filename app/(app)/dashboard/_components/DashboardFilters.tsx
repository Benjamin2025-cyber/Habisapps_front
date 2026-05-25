"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { listAgencies, type Agency } from "@/lib/api/agencies";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type DashboardPeriod = "today" | "week" | "month" | "year";

export type DashboardFilterState = {
  creditType: string;
  period: DashboardPeriod;
  agentPublicId: string;
  agencyPublicId: string;
};

export const EMPTY_DASHBOARD_FILTERS: DashboardFilterState = {
  creditType: "",
  period: "today",
  agentPublicId: "",
  agencyPublicId: "",
};

type Props = {
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  /** Visible only for users who can pick any agency (platform-admin). */
  canSelectAgency: boolean;
};

/**
 * 4 global filter dropdowns matching PDF p6 "Informations Financières" header:
 *   [Tous les crédits] [Aujourd'hui] [Tous les agents] [Toutes les agences]
 *
 * Per design decision #8 (BUILDABLE_PAGES.md), filters are global only —
 * per-card filters from the maquette are intentionally dropped.
 */
export function DashboardFilters({ value, onChange, canSelectAgency }: Props) {
  const t = useTranslations();
  const session = useSession();
  const [agencies, setAgencies] = useState<Agency[] | null>(null);
  const [loadingAgencies, setLoadingAgencies] = useState(false);

  useEffect(() => {
    if (!canSelectAgency) return;
    if (session.status !== "authenticated") return;
    let cancelled = false;
    setLoadingAgencies(true);
    listAgencies(session.token, { perPage: 100 })
      .then((rows) => {
        if (!cancelled) setAgencies(rows);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAgencies(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSelectAgency, session]);

  function update<K extends keyof DashboardFilterState>(
    key: K,
    next: DashboardFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <section
      aria-label={t("dashboard.filters.title")}
      className="rounded-[var(--radius-card)] border border-border bg-background px-5 py-4 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.08)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("dashboard.filters.title")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            ariaLabel={t("dashboard.filters.creditType")}
            value={value.creditType}
            onChange={(next) => update("creditType", next)}
            options={[
              { value: "", label: t("dashboard.filters.creditTypeAll") },
            ]}
          />
          <FilterSelect
            ariaLabel={t("dashboard.filters.period")}
            value={value.period}
            onChange={(next) => update("period", next as DashboardPeriod)}
            options={[
              { value: "today", label: t("dashboard.filters.periodToday") },
              { value: "week", label: t("dashboard.filters.periodWeek") },
              { value: "month", label: t("dashboard.filters.periodMonth") },
              { value: "year", label: t("dashboard.filters.periodYear") },
            ]}
          />
          <FilterSelect
            ariaLabel={t("dashboard.filters.agent")}
            value={value.agentPublicId}
            onChange={(next) => update("agentPublicId", next)}
            options={[
              { value: "", label: t("dashboard.filters.agentAll") },
            ]}
          />
          {canSelectAgency ? (
            <FilterSelect
              ariaLabel={t("dashboard.filters.agency")}
              value={value.agencyPublicId}
              onChange={(next) => update("agencyPublicId", next)}
              disabled={loadingAgencies}
              options={[
                {
                  value: "",
                  label: loadingAgencies
                    ? t("dashboard.filters.agencyLoading")
                    : t("dashboard.filters.agencyAll"),
                },
                ...(agencies ?? []).map((agency) => ({
                  value: agency.public_id,
                  label: `${agency.code} — ${agency.name}`,
                })),
              ]}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 rounded-[var(--radius-field)] border border-input bg-background pl-3 pr-8 text-xs font-medium text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {options.map((option) => (
        <option key={`${ariaLabel}-${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Resolve a `DashboardPeriod` to a date range usable as
 * `period_starts_on` / `period_ends_on` query params (YYYY-MM-DD strings).
 */
export function periodToDateRange(period: DashboardPeriod): {
  from: string;
  to: string;
} {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const todayIso = iso(today);

  if (period === "today") return { from: todayIso, to: todayIso };

  if (period === "week") {
    const start = new Date(today);
    // Monday-start week. JS getDay(): Sunday=0..Saturday=6.
    const weekday = (start.getDay() + 6) % 7; // 0 = Monday
    start.setDate(start.getDate() - weekday);
    return { from: iso(start), to: todayIso };
  }

  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(start), to: todayIso };
  }

  const start = new Date(today.getFullYear(), 0, 1);
  return { from: iso(start), to: todayIso };
}
