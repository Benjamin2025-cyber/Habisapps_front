"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { LockIcon } from "@/components/ui/icons";
import type { TellerSession } from "@/lib/api/teller-sessions";
import type { Till } from "@/lib/api/tills";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * "Ma caisse" — the teller's session card. Centered empty state when no session
 * is open (lock + CTA), or the open-session summary + close shortcut otherwise.
 * Data is fetched once by the layout and passed in (shared with the KPI strip
 * and "Résumé du jour", which read the same session summary).
 */
export function DashboardCashDrawerCard({
  session,
  till,
  loading,
}: {
  session: TellerSession | null;
  till: Till | null;
  loading: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const currency = session?.currency ?? "XAF";

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {t("dashboard.teller.drawer.title")}
        </h2>
        {!loading ? (
          <Badge tone={session ? "success" : "danger"}>
            {session
              ? t("dashboard.teller.drawer.open")
              : t("dashboard.teller.drawer.closed")}
          </Badge>
        ) : null}
      </header>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : session ? (
        <div className="flex flex-col gap-3">
          <Row
            label={t("dashboard.teller.drawer.till")}
            value={till ? `${till.code} — ${till.name}` : (session.till_public_id ?? "—")}
          />
          <Row
            label={t("dashboard.teller.drawer.date")}
            value={session.business_date ?? "—"}
          />
          <Row
            label={t("dashboard.teller.drawer.opening")}
            value={
              session.opening_declaration_minor != null
                ? format.currencyMinor(session.opening_declaration_minor, {
                    currency,
                  })
                : "—"
            }
            strong
          />
          <Link
            href="/operations/sessions"
            className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-field)] bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {t("dashboard.teller.drawer.closeCta")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <LockIcon className="h-7 w-7" />
          </span>
          <p className="text-base font-bold text-foreground">
            {t("dashboard.teller.drawer.noneTitle")}
          </p>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            {t("dashboard.teller.drawer.noneBody")}
          </p>
          <Link
            href="/operations/sessions"
            className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-field)] bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <LockIcon className="h-4 w-4" />
            {t("dashboard.teller.drawer.openCta")}
          </Link>
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-semibold tabular-nums text-foreground"
            : "tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
