"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import {
  fetchTellerSessions,
  getTellerSession,
  type TellerSession,
} from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import {
  fetchTellerTransactions,
  reverseTellerTransaction,
  type TellerTransaction,
} from "@/lib/api/teller-transactions";
import { localizeApiError } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { CashTransactionForm } from "./_components/CashTransactionForm";

type Direction = "deposit" | "withdrawal";

/**
 * P21 — Caisse › Retrait/Versement. Mouvements d'espèces sur une session de
 * caisse ouverte. Câblé sur `teller-sessions/{id}/deposits` & `/withdrawals`
 * et `teller-transactions/{id}/reverse`. Permissions `cash.transactions.*`.
 */
export default function CashTransactionsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.transactions.view"]);
  const managePerm = useCanAny(["cash.transactions.manage"]);
  const reversePerm = useCanAny(["cash.transactions.reverse"]);
  const canView = isPlatformAdmin || viewPerm;
  const canManage = isPlatformAdmin || managePerm;
  const canReverse = isPlatformAdmin || reversePerm;

  const [openSessions, setOpenSessions] = useState<TellerSession[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [direction, setDirection] = useState<Direction>("deposit");
  const [transactions, setTransactions] = useState<TellerTransaction[]>([]);
  const [reverseTarget, setReverseTarget] = useState<TellerTransaction | null>(
    null,
  );
  const [reversing, setReversing] = useState(false);

  const token = session.status === "authenticated" ? session.token : null;

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setLoadingSessions(true);
    try {
      const [sessions, tillsRes] = await Promise.all([
        fetchTellerSessions(token, { perPage: 100 }),
        fetchTills(token, { perPage: 100 }),
      ]);
      const open = sessions.data.filter((s) => s.status === "open");
      setOpenSessions(open);
      setTills(tillsRes.data);
      setSessionId((current) =>
        current && open.some((s) => s.public_id === current)
          ? current
          : (open[0]?.public_id ?? ""),
      );
    } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Real per-session transaction history from the server (#24a) — replaces the
  // previous browser-session-only list.
  const loadTransactions = useCallback(
    async (sid: string) => {
      if (!token || !sid) {
        setTransactions([]);
        return;
      }
      try {
        const res = await fetchTellerTransactions(token, {
          tellerSessionPublicId: sid,
          perPage: 100,
        });
        setTransactions(res.data);
      } catch {
        setTransactions([]);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadTransactions(sessionId);
  }, [loadTransactions, sessionId]);

  // Refresh one session's summary totals without the full-list loading flash.
  const refreshSummary = useCallback(
    async (sid: string) => {
      if (!token || !sid) return;
      try {
        const fresh = await getTellerSession(token, sid);
        setOpenSessions((cur) =>
          cur.map((s) =>
            s.public_id === sid ? { ...s, summary: fresh.summary } : s,
          ),
        );
      } catch {
        // non-fatal — the summary strip just stays as-is
      }
    },
    [token],
  );

  const tillLabelOf = useCallback(
    (publicId: string | null) => {
      if (!publicId) return "—";
      const till = tills.find((x) => x.public_id === publicId);
      return till ? `${till.code} — ${till.name}` : publicId;
    },
    [tills],
  );

  const sessionOptions = useMemo(
    () =>
      openSessions.map((s) => ({
        value: s.public_id,
        label: `${tillLabelOf(s.till_public_id)}${s.business_date ? ` · ${s.business_date}` : ""}`,
      })),
    [openSessions, tillLabelOf],
  );

  const activeSession = openSessions.find((s) => s.public_id === sessionId) ?? null;

  if (session.status !== "authenticated" || !canView) return null;

  function handleDone(tx: TellerTransaction) {
    setTransactions((current) => [tx, ...current]); // optimistic
    toast.success(
      t("cashTx.toast.doneTitle"),
      t("cashTx.toast.doneBody", {
        amount: format.currencyMinor(tx.amount_minor, {
          currency: tx.currency ?? "XAF",
        }),
      }),
    );
    void loadTransactions(sessionId); // reconcile with server
    void refreshSummary(sessionId);
  }

  async function confirmReverse() {
    if (!token || !reverseTarget) return;
    setReversing(true);
    try {
      await reverseTellerTransaction(token, reverseTarget.public_id);
      toast.success(t("cashTx.toast.reversedTitle"), t("cashTx.toast.reversedBody"));
      setReverseTarget(null);
      void loadTransactions(sessionId);
      void refreshSummary(sessionId);
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("cashTx.toast.errorTitle"), generalMessage);
    } finally {
      setReversing(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("cashTx.pageTitle")}
        description={t("cashTx.pageDescription")}
      />

      {loadingSessions ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : openSessions.length === 0 ? (
        <Alert variant="warning" title={t("cashTx.noSession.title")}>
          <div className="flex flex-col gap-2">
            <span>{t("cashTx.noSession.body")}</span>
            <Link
              href="/operations/sessions"
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("cashTx.noSession.link")}
            </Link>
          </div>
        </Alert>
      ) : (
        <>
          {/* Session context */}
          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:max-w-md">
            <label
              htmlFor="cashtx-session"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t("cashTx.sessionLabel")}
            </label>
            <Select
              id="cashtx-session"
              value={sessionId}
              options={sessionOptions}
              onChange={setSessionId}
            />
          </section>

          {activeSession?.summary ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label={t("cashTx.sessionSummary.deposits")}
                value={format.currencyMinor(activeSession.summary.deposits_total_minor, {
                  currency: activeSession.currency ?? "XAF",
                })}
                tone="success"
              />
              <Stat
                label={t("cashTx.sessionSummary.withdrawals")}
                value={format.currencyMinor(activeSession.summary.withdrawals_total_minor, {
                  currency: activeSession.currency ?? "XAF",
                })}
                tone="warning"
              />
              <Stat
                label={t("cashTx.sessionSummary.expected")}
                value={format.currencyMinor(
                  activeSession.summary.expected_cash_balance_minor,
                  { currency: activeSession.currency ?? "XAF" },
                )}
              />
              <Stat
                label={t("cashTx.sessionSummary.count")}
                value={String(activeSession.summary.transaction_count)}
              />
            </section>
          ) : null}

          {canManage && activeSession ? (
            <>
              {/* Direction tabs */}
              <div className="inline-flex rounded-[var(--radius-field)] border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setDirection("deposit")}
                  className={`rounded-[calc(var(--radius-field)-2px)] px-4 py-1.5 text-sm font-semibold transition-colors ${
                    direction === "deposit"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("cashTx.direction.deposit")}
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("withdrawal")}
                  className={`rounded-[calc(var(--radius-field)-2px)] px-4 py-1.5 text-sm font-semibold transition-colors ${
                    direction === "withdrawal"
                      ? "bg-danger text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("cashTx.direction.withdrawal")}
                </button>
              </div>

              <CashTransactionForm
                key={`${direction}-${activeSession.public_id}`}
                direction={direction}
                session={activeSession}
                onDone={handleDone}
              />
            </>
          ) : !canManage ? (
            <Alert variant="info" title={t("cashTx.readOnly.title")}>
              {t("cashTx.readOnly.body")}
            </Alert>
          ) : null}

          {/* Transactions performed in this working session */}
          {transactions.length > 0 ? (
            <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
              <header className="border-b border-border border-l-4 border-l-accent bg-accent/5 px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("cashTx.recent.title")}
                </h2>
              </header>
              <table className="w-full text-sm">
                <thead className="bg-accent/5 text-xs">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-semibold">
                      {t("cashTx.recent.type")}
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      {t("cashTx.recent.reference")}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t("cashTx.recent.amount")}
                    </th>
                    <th className="px-4 py-2 font-semibold">
                      {t("cashTx.recent.status")}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {t("cashTx.recent.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.public_id}>
                      <td className="px-4 py-2.5">
                        <Badge
                          tone={
                            tx.transaction_type === "cash_withdrawal"
                              ? "warning"
                              : "info"
                          }
                        >
                          {t(`cashTx.txType.${tx.transaction_type}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {tx.reference ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {format.currencyMinor(tx.amount_minor, {
                          currency: tx.currency ?? "XAF",
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={tx.status === "reversed" ? "danger" : "success"}>
                          {t(`cashTx.status.${tx.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canReverse && tx.status !== "reversed" ? (
                          <button
                            type="button"
                            onClick={() => setReverseTarget(tx)}
                            className="text-xs font-semibold text-danger hover:underline"
                          >
                            {t("cashTx.recent.reverse")}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={reverseTarget !== null}
        title={t("cashTx.reverseConfirm.title")}
        description={t("cashTx.reverseConfirm.body")}
        confirmLabel={t("cashTx.recent.reverse")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={reversing}
        busyLabel={t("common.loading")}
        onConfirm={confirmReverse}
        onClose={() => (reversing ? undefined : setReverseTarget(null))}
      />
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-field)] border border-border bg-background px-4 py-3">
      <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-base font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}
