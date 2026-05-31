"use client";

/**
 * Teller-dashboard sections from the reference design that have NO backend
 * endpoint yet. Each renders realistic PLACEHOLDER data behind a clear "Démo"
 * badge so it's never mistaken for live data. When the backend lands, replace
 * the constant with a fetch — the markup stays.
 *
 * Wiring map:
 *  - Recent transactions  → needs a teller-transactions list endpoint (back-issue #24)
 *  - Notifications        → needs a notifications/alerts feed endpoint (back-issue #26)
 *  - Customer focus + Accounts overview → endpoints EXIST (clients + customer-accounts
 *    + available-balance); they just need a "customer in focus" selection UX (FE
 *    follow-up — not a backend gap).
 */

import { Badge } from "@/components/ui/Badge";
import { CheckCircleIcon, InfoIcon, ShieldIcon } from "@/components/ui/icons";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

const CURRENCY = "XAF";

function DemoBadge() {
  const t = useTranslations();
  return (
    <span
      title={t("dashboard.teller.demoNote")}
      className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-warning"
    >
      {t("dashboard.teller.demo")}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <DemoBadge />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Customer in focus (placeholder)                                            */
/* -------------------------------------------------------------------------- */
const DEMO_CUSTOMER = {
  name: "Aïssatou Bello",
  initials: "AB",
  customerId: "CUS-984756",
  phone: "+237 6 99 00 11 22",
  email: "aissatou.bello@example.cm",
  since: "14/03/2022",
};

export function DashboardCustomerFocusCard() {
  const t = useTranslations();
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <SectionHeader title={t("dashboard.teller.customer.title")} />
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
          {DEMO_CUSTOMER.initials}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {DEMO_CUSTOMER.name}
            </span>
            <Badge tone="success">{t("dashboard.teller.customer.verified")}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {t("dashboard.teller.customer.id")}: {DEMO_CUSTOMER.customerId} ·{" "}
            {DEMO_CUSTOMER.phone}
          </span>
          <span className="text-xs text-muted-foreground">{DEMO_CUSTOMER.email}</span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1 text-xs">
          <span className="text-muted-foreground">
            {t("dashboard.teller.customer.since")}: {DEMO_CUSTOMER.since}
          </span>
          <span className="flex items-center gap-1 text-success">
            <ShieldIcon className="h-3.5 w-3.5" />
            {t("dashboard.teller.customer.kycCompleted")}
          </span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Accounts overview (placeholder)                                            */
/* -------------------------------------------------------------------------- */
const DEMO_ACCOUNTS = [
  { key: "savings", labelKey: "savings", masked: "•••• 1234", balanceMinor: 852640000 },
  { key: "current", labelKey: "current", masked: "•••• 5678", balanceMinor: 231575000 },
  { key: "term", labelKey: "term", masked: "•••• 9012", balanceMinor: 1500000000 },
] as const;

export function DashboardAccountsOverview() {
  const t = useTranslations();
  const format = useFormatter();
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <SectionHeader title={t("dashboard.teller.accounts.title")} />
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        {DEMO_ACCOUNTS.map((a) => (
          <div
            key={a.key}
            className="flex flex-col gap-2 rounded-[var(--radius-field)] border border-border bg-muted/20 p-4"
          >
            <span className="text-xs font-medium text-foreground">
              {t(`dashboard.teller.accounts.${a.labelKey}`)}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {a.masked}
            </span>
            <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {t("dashboard.teller.accounts.available")}
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {format.currencyMinor(a.balanceMinor, { currency: CURRENCY })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent transactions (placeholder — back-issue #24)                         */
/* -------------------------------------------------------------------------- */
const DEMO_TX = [
  { id: "1", date: "24/05 09:45", type: "deposit", account: "•••• 1234", desc: "Versement espèces", amountMinor: 120000000, sign: 1, channel: "teller" },
  { id: "2", date: "24/05 09:30", type: "withdrawal", account: "•••• 5678", desc: "Retrait client", amountMinor: 50000000, sign: -1, channel: "teller" },
  { id: "3", date: "24/05 09:10", type: "transfer", account: "•••• 1234", desc: "Virement vers J. Davis", amountMinor: 75000000, sign: -1, channel: "mobile" },
  { id: "4", date: "24/05 08:30", type: "deposit", account: "•••• 1234", desc: "Versement client", amountMinor: 85000000, sign: 1, channel: "teller" },
] as const;

export function DashboardRecentTransactions() {
  const t = useTranslations();
  const format = useFormatter();
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <SectionHeader title={t("dashboard.teller.recent.title")} />
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs">
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-2 font-semibold">{t("dashboard.teller.recent.date")}</th>
            <th className="px-4 py-2 font-semibold">{t("dashboard.teller.recent.type")}</th>
            <th className="px-4 py-2 font-semibold">{t("dashboard.teller.recent.account")}</th>
            <th className="px-4 py-2 text-right font-semibold">{t("dashboard.teller.recent.amount")}</th>
            <th className="px-4 py-2 font-semibold">{t("dashboard.teller.recent.channel")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {DEMO_TX.map((tx) => (
            <tr key={tx.id}>
              <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                {tx.date}
              </td>
              <td className="px-4 py-2.5 text-foreground">
                {t(`dashboard.teller.recent.types.${tx.type}`)}
              </td>
              <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                {tx.account}
              </td>
              <td
                className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                  tx.sign > 0 ? "text-success" : "text-danger"
                }`}
              >
                {tx.sign > 0 ? "+" : "−"}
                {format.currencyMinor(tx.amountMinor, { currency: CURRENCY })}
              </td>
              <td className="px-4 py-2.5">
                <Badge tone="neutral">
                  {t(`dashboard.teller.recent.channels.${tx.channel}`)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications (placeholder — back-issue #26)                               */
/* -------------------------------------------------------------------------- */
const DEMO_NOTIFS = [
  { id: "1", tone: "info" as const, text: "Maintenance système prévue le 25/05, 23h–02h.", ago: "il y a 10 min" },
  { id: "2", tone: "success" as const, text: "Mise à jour KYC d'un client validée.", ago: "il y a 25 min" },
  { id: "3", tone: "warning" as const, text: "Niveau de caisse élevé sur la caisse CTLL1.", ago: "il y a 1 h" },
];

export function DashboardNotificationsCard() {
  const t = useTranslations();
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <SectionHeader title={t("dashboard.teller.notifications.title")} />
      <ul className="flex flex-col divide-y divide-border">
        {DEMO_NOTIFS.map((n) => {
          const Icon =
            n.tone === "success" ? CheckCircleIcon : n.tone === "warning" ? ShieldIcon : InfoIcon;
          const color =
            n.tone === "success"
              ? "text-success"
              : n.tone === "warning"
                ? "text-warning"
                : "text-info";
          return (
            <li key={n.id} className="flex items-start gap-3 px-5 py-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{n.text}</span>
                <span className="text-xs text-muted-foreground">{n.ago}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
