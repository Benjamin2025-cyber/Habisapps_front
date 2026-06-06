"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { Badge } from "@/components/ui/Badge";
import {
  BanknoteIcon,
  BookIcon,
  CalendarIcon,
  CashIcon,
  ChevronDownIcon,
  FileTextIcon,
  UsersIcon,
  WorkflowIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { fetchTellerSessions, type TellerSession } from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import { DashboardCashDrawerCard } from "./DashboardCashDrawerCard";
import {
  DashboardNotificationsCard,
  DashboardRecentTransactions,
} from "./DashboardTellerSections";

type Tone = "accent" | "info" | "primary" | "success" | "danger";

const ICON_TONE: Record<Tone, string> = {
  accent: "bg-accent/10 text-accent",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};
const VALUE_TONE: Record<Tone, string> = {
  accent: "text-accent",
  info: "text-info",
  primary: "text-primary",
  success: "text-success",
  danger: "text-danger",
};
const TILE_TONE: Record<Tone, { wrap: string; icon: string }> = {
  success: { wrap: "border-success/20 bg-success/5 hover:bg-success/10", icon: "bg-success/15 text-success" },
  danger: { wrap: "border-danger/20 bg-danger/5 hover:bg-danger/10", icon: "bg-danger/15 text-danger" },
  accent: { wrap: "border-accent/20 bg-accent/5 hover:bg-accent/10", icon: "bg-accent/15 text-accent" },
  info: { wrap: "border-info/20 bg-info/5 hover:bg-info/10", icon: "bg-info/15 text-info" },
  primary: { wrap: "border-primary/20 bg-primary/5 hover:bg-primary/10", icon: "bg-primary/15 text-primary" },
};

/**
 * Cash-desk dashboard for the `teller` role — redesigned to match the agreed
 * mock: a KPI strip + recent operations + day summary on the left, and the
 * "Ma caisse" session card + quick actions + notifications on the right rail.
 * Wired to real endpoints (teller session summary, teller-transactions,
 * notifications); the existing colour tokens are kept throughout.
 */
export function DashboardTellerLayout() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();

  const token = session.status === "authenticated" ? session.token : null;
  const myPublicId =
    session.status === "authenticated" ? session.user.public_id : null;

  const [mySession, setMySession] = useState<TellerSession | null>(null);
  const [tills, setTills] = useState<Till[]>([]);
  const [loading, setLoading] = useState(true);

  // Today's date for the header chip — computed client-side to avoid an SSR
  // hydration mismatch.
  const [today, setToday] = useState("");
  useEffect(() => {
    const formatted = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    setToday(formatted.charAt(0).toUpperCase() + formatted.slice(1));
  }, []);

  useEffect(() => {
    if (!token || !myPublicId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchTellerSessions(token, {
        status: "open",
        tellerUserPublicId: myPublicId,
        perPage: 1,
      }).catch(() => ({ data: [] as TellerSession[] })),
      fetchTills(token, { perPage: 100 }).catch(() => ({ data: [] as Till[] })),
    ]).then(([s, tl]) => {
      if (cancelled) return;
      setMySession((s.data as TellerSession[])[0] ?? null);
      setTills(tl.data as Till[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, myPublicId]);

  if (session.status !== "authenticated") return null;

  const firstName = session.user.name.split(" ")[0];
  const summary = mySession?.summary ?? null;
  const currency = mySession?.currency ?? "XAF";
  const till = mySession
    ? (tills.find((x) => x.public_id === mySession.till_public_id) ?? null)
    : null;

  const money = (minor: number) => format.currencyMinor(minor, { currency });

  const actions: Array<{
    key: string;
    label: string;
    href: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    tone: Tone;
  }> = [
    { key: "deposit", label: t("dashboard.teller.actions.newDeposit"), href: "/operations/transactions", icon: CashIcon, tone: "success" },
    { key: "withdrawal", label: t("dashboard.teller.actions.newWithdrawal"), href: "/operations/transactions", icon: BanknoteIcon, tone: "danger" },
    { key: "clients", label: t("dashboard.teller.actions.clients"), href: "/clients", icon: UsersIcon, tone: "accent" },
    { key: "accounts", label: t("dashboard.teller.actions.accounts"), href: "/accounts", icon: BookIcon, tone: "info" },
  ];

  return (
    <>
      <PageHeader
        title={t("dashboard.teller.greeting", { name: firstName })}
        description={t("dashboard.teller.subtitle")}
        actions={
          today ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-border bg-background px-3 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span className="tabular-nums">{today}</span>
            </span>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={CashIcon}
              tone="accent"
              label={t("dashboard.teller.kpi.soldeCaisse")}
              value={money(summary?.expected_cash_balance_minor ?? 0)}
              footer={
                <Badge tone={mySession ? "success" : "danger"}>
                  {mySession
                    ? t("dashboard.teller.drawer.open")
                    : t("dashboard.teller.drawer.closed")}
                </Badge>
              }
              loading={loading}
            />
            <KpiCard
              icon={ChevronDownIcon}
              tone="success"
              label={t("dashboard.teller.kpi.deposits")}
              value={money(summary?.deposits_total_minor ?? 0)}
              footer={<span className="text-xs text-muted-foreground">{t("dashboard.teller.today")}</span>}
              loading={loading}
            />
            <KpiCard
              icon={ChevronDownIcon}
              iconClassName="rotate-180"
              tone="danger"
              label={t("dashboard.teller.kpi.withdrawals")}
              value={money(summary?.withdrawals_total_minor ?? 0)}
              footer={<span className="text-xs text-muted-foreground">{t("dashboard.teller.today")}</span>}
              loading={loading}
            />
            <KpiCard
              icon={FileTextIcon}
              tone="primary"
              label={t("dashboard.teller.kpi.transactions")}
              value={String(summary?.transaction_count ?? 0)}
              footer={<span className="text-xs text-muted-foreground">{t("dashboard.teller.today")}</span>}
              loading={loading}
            />
          </div>

          <DashboardRecentTransactions />

          {/* Résumé du jour */}
          <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {t("dashboard.teller.summary.title")}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryItem icon={ChevronDownIcon} tone="success" label={t("dashboard.teller.summary.deposits")} value={money(summary?.deposits_total_minor ?? 0)} />
              <SummaryItem icon={ChevronDownIcon} iconClassName="rotate-180" tone="danger" label={t("dashboard.teller.summary.withdrawals")} value={money(summary?.withdrawals_total_minor ?? 0)} />
              <SummaryItem icon={CashIcon} tone="accent" label={t("dashboard.teller.summary.commissions")} value={money(0)} />
              <SummaryItem icon={UsersIcon} tone="info" label={t("dashboard.teller.summary.clientsServed")} value="0" />
            </div>
          </section>
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-4">
          <DashboardCashDrawerCard session={mySession} till={till} loading={loading} />

          <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <WorkflowIcon className="h-4 w-4 text-accent" />
              {t("dashboard.teller.actionsTitle")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => {
                const Icon = action.icon;
                const tone = TILE_TONE[action.tone];
                return (
                  <Link
                    key={action.key}
                    href={action.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius-field)] border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      tone.wrap,
                    )}
                  >
                    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-field)]", tone.icon)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <DashboardNotificationsCard />
        </aside>
      </div>
    </>
  );
}

function KpiCard({
  icon: Icon,
  iconClassName,
  tone,
  label,
  value,
  footer,
  loading,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
  tone: Tone;
  label: string;
  value: string;
  footer: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-field)]", ICON_TONE[tone])}>
          <Icon className={cn("h-4 w-4", iconClassName)} />
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {loading ? "—" : value}
      </p>
      <div className="mt-2">{footer}</div>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  iconClassName,
  tone,
  label,
  value,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full", ICON_TONE[tone])}>
        <Icon className={cn("h-4 w-4", iconClassName)} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className={cn("truncate text-lg font-bold tabular-nums", VALUE_TONE[tone])}>{value}</span>
      </div>
    </div>
  );
}
