"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  BellIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  FileTextIcon,
  InfoIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import {
  fetchTellerTransactions,
  type TellerTransaction,
} from "@/lib/api/teller-transactions";
import {
  fetchNotifications,
  type AppNotification,
} from "@/lib/api/notifications";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

/* -------------------------------------------------------------------------- */
/* Recent transactions — real teller-transactions for the signed-in teller    */
/* -------------------------------------------------------------------------- */
export function DashboardRecentTransactions() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const tellerPublicId =
    session.status === "authenticated" ? session.user.public_id : null;

  const [rows, setRows] = useState<TellerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || !tellerPublicId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchTellerTransactions(token, {
      tellerUserPublicId: tellerPublicId,
      perPage: 6,
    })
      .then((res) => {
        if (!cancelled) setRows(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tellerPublicId]);

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("dashboard.teller.recent.title")}
        </h2>
        <Link
          href="/operations/transactions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          {t("dashboard.teller.recent.viewAll")}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </header>
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr className="text-muted-foreground">
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.teller.recent.time")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.teller.recent.type")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.teller.recent.description")}</th>
            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.teller.recent.amount")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">{t("dashboard.teller.recent.status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                {t("common.loading")}
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-danger">
                {t("dashboard.teller.recent.loadError")}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <FileTextIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {t("dashboard.teller.recent.empty")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.teller.recent.emptyHint")}
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((tx) => {
              const isWithdrawal = tx.transaction_type === "cash_withdrawal";
              const sign = isWithdrawal ? -1 : tx.transaction_type === "cash_deposit" ? 1 : 0;
              const amountClass =
                sign > 0 ? "text-success" : sign < 0 ? "text-danger" : "text-foreground";
              return (
                <tr key={tx.public_id}>
                  <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-muted-foreground">
                    {format.dateTime(tx.created_at)}
                  </td>
                  <td className="px-5 py-3.5 text-foreground">
                    {t(`cashTx.txType.${tx.transaction_type}`)}
                  </td>
                  <td className="max-w-[16rem] truncate px-5 py-3.5 text-muted-foreground">
                    {tx.description ?? tx.reference ?? "—"}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${amountClass}`}>
                    {sign > 0 ? "+" : sign < 0 ? "−" : ""}
                    {format.currencyMinor(tx.amount_minor, {
                      currency: tx.currency ?? "XAF",
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={tx.status === "reversed" ? "danger" : "success"}>
                      {t(`cashTx.status.${tx.status}`)}
                    </Badge>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications — real user notification feed                                 */
/* -------------------------------------------------------------------------- */
const NOTIF_ICON: Record<string, typeof InfoIcon> = {
  success: CheckCircleIcon,
  warning: ShieldIcon,
  error: ShieldIcon,
  info: InfoIcon,
};
const NOTIF_COLOR: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
  info: "text-info",
};

export function DashboardNotificationsCard() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchNotifications(token, { perPage: 5 })
      .then((res) => {
        if (!cancelled) setRows(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BellIcon className="h-4 w-4 text-accent" />
          {t("dashboard.teller.notifications.title")}
        </h2>
        <span className="text-xs font-semibold text-accent">
          {t("dashboard.teller.notifications.viewAll")}
        </span>
      </header>
      {loading && rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : error ? (
        <p className="px-5 py-6 text-center text-xs text-danger">
          {t("dashboard.teller.notifications.loadError")}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs text-muted-foreground">
          {t("dashboard.teller.notifications.empty")}
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((n) => {
              const Icon = NOTIF_ICON[n.type] ?? InfoIcon;
              const color = NOTIF_COLOR[n.type] ?? "text-info";
              return (
                <li key={n.public_id} className="flex items-start gap-3 px-5 py-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">{n.title}</span>
                    {n.message ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {n.message}
                      </span>
                    ) : null}
                    <span className="text-[0.7rem] text-muted-foreground/80">
                      {format.relative(n.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-5 py-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
              {t("dashboard.teller.notifications.viewAllFooter")}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </>
      )}
    </section>
  );
}
