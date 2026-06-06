"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  BanknoteIcon,
  CashIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { OperationalDashboard } from "@/lib/api/dashboard";

type Tone = "primary" | "accent" | "info" | "danger" | "neutral";

type Props = {
  data: OperationalDashboard | null;
  clientsCount: number | null;
};

/**
 * The 5-card KPI strip from PDF p6.
 *
 * Backgrounds match the maquette palette:
 *   1. Solde Principal      — dark indigo (primary) → white text
 *   2. Collecte du jour     — magenta (accent)      → white text
 *   3. Crédits en cours     — blue (info)           → white text
 *   4. Crédits en retard    — red (danger)          → white text
 *   5. Clients              — light gray (neutral)  → dark text
 *
 * Colours are applied via inline CSS variables instead of Tailwind
 * `bg-*` utilities so the build doesn't depend on whether each utility
 * was generated for a given theme token.
 */
export function DashboardKpiStrip({ data, clientsCount }: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const balance = data?.portfolio_outstanding_minor ?? 0;
  const todayCollection = data?.collections.actual_collection_minor ?? 0;
  const parTotal =
    (data?.par.par30_outstanding_at_risk_minor ?? 0) +
    (data?.par.par60_outstanding_at_risk_minor ?? 0) +
    (data?.par.par90_outstanding_at_risk_minor ?? 0);
  const activeLoansCount = data?.active_loan_count ?? null;
  const delinquentLoansCount = data?.delinquent_loan_count ?? null;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        tone="primary"
        icon={<BanknoteIcon className="h-5 w-5" />}
        label={t("dashboard.kpi.balance.title")}
        value={format.currencyMinor(balance)}
        loading={data === null}
      />
      <KpiCard
        tone="accent"
        icon={<CashIcon className="h-5 w-5" />}
        label={t("dashboard.kpi.todayCollection.title")}
        value={format.currencyMinor(todayCollection)}
        loading={data === null}
      />
      <KpiCard
        tone="info"
        icon={<BanknoteIcon className="h-5 w-5" />}
        label={
          activeLoansCount === null
            ? t("dashboard.kpi.activeLoans.title")
            : t("dashboard.kpi.activeLoans.count", { count: activeLoansCount })
        }
        value={data ? format.currencyMinor(balance) : "—"}
        loading={data === null}
      />
      <KpiCard
        tone="danger"
        icon={<ShieldIcon className="h-5 w-5" />}
        label={
          delinquentLoansCount === null
            ? t("dashboard.kpi.delinquentLoans.title")
            : t("dashboard.kpi.delinquentLoans.count", {
                count: delinquentLoansCount,
              })
        }
        value={data ? format.currencyMinor(parTotal) : "—"}
        loading={data === null}
      />
      <KpiCard
        tone="neutral"
        icon={<UsersIcon className="h-5 w-5" />}
        label={t("dashboard.kpi.clientsCount.title")}
        value={clientsCount === null ? "—" : String(clientsCount)}
        loading={clientsCount === null}
      />
    </section>
  );
}

type ToneSpec = {
  background: string;
  text: string;
  iconBg: string;
  iconText: string;
  labelText: string;
};

const toneSpecs: Record<Tone, ToneSpec> = {
  primary: {
    background: "var(--color-primary)",
    text: "var(--color-primary-foreground)",
    iconBg: "rgba(255, 255, 255, 0.18)",
    iconText: "var(--color-primary-foreground)",
    labelText: "rgba(255, 255, 255, 0.85)",
  },
  accent: {
    background: "var(--color-accent)",
    text: "var(--color-accent-foreground)",
    iconBg: "rgba(255, 255, 255, 0.2)",
    iconText: "var(--color-accent-foreground)",
    labelText: "rgba(255, 255, 255, 0.9)",
  },
  info: {
    background: "var(--color-info)",
    text: "var(--color-info-foreground)",
    iconBg: "rgba(255, 255, 255, 0.22)",
    iconText: "var(--color-info-foreground)",
    labelText: "rgba(255, 255, 255, 0.9)",
  },
  danger: {
    background: "var(--color-danger)",
    text: "var(--color-danger-foreground)",
    iconBg: "rgba(255, 255, 255, 0.22)",
    iconText: "var(--color-danger-foreground)",
    labelText: "rgba(255, 255, 255, 0.9)",
  },
  neutral: {
    background: "#f3f4f6",
    text: "var(--color-foreground)",
    iconBg: "rgba(20, 6, 47, 0.06)",
    iconText: "var(--color-foreground)",
    labelText: "var(--color-muted-foreground)",
  },
};

function KpiCard({
  tone,
  icon,
  label,
  value,
  loading,
}: {
  tone: Tone;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  loading?: boolean;
}) {
  const spec = toneSpecs[tone];
  const cardStyle: CSSProperties = {
    backgroundColor: spec.background,
    color: spec.text,
  };
  const iconStyle: CSSProperties = {
    backgroundColor: spec.iconBg,
    color: spec.iconText,
  };
  const labelStyle: CSSProperties = { color: spec.labelText };

  return (
    <article
      style={cardStyle}
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-card)] p-5",
        "shadow-[0_10px_30px_-22px_rgba(20,6,47,0.45)]",
      )}
    >
      <header className="flex items-center gap-3">
        <span
          style={iconStyle}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-field)]"
        >
          {icon}
        </span>
        <span
          style={labelStyle}
          className="text-sm font-semibold leading-tight"
        >
          {label}
        </span>
      </header>

      <p className="text-2xl font-bold tabular-nums">
        {loading ? <span style={{ opacity: 0.6 }}>…</span> : value}
      </p>
    </article>
  );
}
