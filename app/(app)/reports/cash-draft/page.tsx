"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  fetchTills,
  fetchTillCashJournal,
  type TillCashJournalLine,
} from "@/lib/api/tills";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";
import { localizeApiMessage } from "@/lib/api/errors";
import { PageHeader } from "../../_components/PageHeader";

/**
 * P22 — Édition › Brouillard de caisse. The accounting team's line-by-line
 * cash journal for one till: the ten printed columns (n° d'ordre, pièce de
 * caisse, date, n° de compte, libellé, montant débité, montant crédité, solde
 * progressif, code guichet, caissier), served by `GET tills/{till}/cash-journal`.
 * The running balance is computed by the API over the till's whole history, so
 * it stays true across filters and pages.
 *
 * « Code guichet » is the branch code; the caisse keeps its own column, so the
 * printed sheet names both rather than leaving the reader to guess which one
 * the column meant.
 */

/** The API's maximum page size — used on screen and when walking to print. */
const PER_PAGE = 100;

export default function CashDraftPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  // The endpoint sits behind both policies: the till must be readable
  // (cash.tills.view) and the journal lines are teller transactions
  // (cash.transactions.view).
  const canViewTill = useCanAny(["cash.tills.view"]);
  const canViewTransactions = useCanAny(["cash.transactions.view"]);
  const canView = isPlatformAdmin || (canViewTill && canViewTransactions);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tillId, setTillId] = useState("");
  const [tills, setTills] = useState<{ value: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [printing, setPrinting] = useState(false);

  // Till referential — the brouillard is per caisse.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchTills(token, { perPage: 100 })
      .then((res) => {
        if (cancelled) return;
        setTills(
          res.data
            .filter((x) => x.status === "active")
            .map((x) => ({ value: x.public_id, label: `${x.code} — ${x.name}` })),
        );
      })
      .catch(() => {
        if (!cancelled) setTills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetcher = useCallback(async (): Promise<{
    lines: TillCashJournalLine[];
    openingBalanceMinor: number;
    total: number;
    lastPage: number;
    currentPage: number;
    tillCode: string;
    agencyCode: string | null;
  } | null> => {
    if (!token || !tillId) return null;
    const result = await fetchTillCashJournal(token, tillId, {
      from: from || undefined,
      to: to || undefined,
      page,
      perPage: PER_PAGE,
    });
    return {
      lines: result.lines,
      openingBalanceMinor: result.openingBalanceMinor,
      total: result.pagination.total,
      lastPage: result.pagination.last_page,
      currentPage: result.pagination.current_page,
      tillCode: result.till.code,
      agencyCode: result.till.agency_code,
    };
  }, [token, tillId, from, to, page]);

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    tillId,
    from,
    to,
    page,
  ]);

  if (session.status !== "authenticated" || !canView) return null;

  const selectedLabel = tills.find((x) => x.value === tillId)?.label ?? "";

  function money(minor: number | null | undefined, currency = "XAF"): string {
    if (minor === null || minor === undefined) return "—";
    return format.currencyMinor(minor, { currency });
  }

  /**
   * The libellé column: what the teller wrote, and failing that the nature of
   * the operation in the reader's language — never the API's generated English
   * description, which is what a blank libellé used to print.
   */
  function lineLabel(line: TillCashJournalLine): string {
    if (line.label) return line.label;
    const key = `cashDraft.txType.${line.transaction_type}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return line.journal_description ?? line.operation_code ?? "—";
  }

  /**
   * Every line of the filtered window, walked page by page. A brouillard is a
   * document the caisse signs off, so printing the 100 rows on screen under a
   * header announcing 400 operations is not an option; the bound keeps a
   * mis-set filter from turning one click into an unbounded request loop.
   */
  async function fetchAllLines(): Promise<TillCashJournalLine[]> {
    if (!token || !tillId) return [];
    const MAX_PAGES = 50;
    const collected: TillCashJournalLine[] = [];
    for (let current = 1; current <= MAX_PAGES; current += 1) {
      const slice = await fetchTillCashJournal(token, tillId, {
        from: from || undefined,
        to: to || undefined,
        page: current,
        perPage: PER_PAGE,
      });
      collected.push(...slice.lines);
      if (current >= slice.pagination.last_page) break;
    }
    return collected;
  }

  async function handlePrint() {
    if (!data || printing) return;
    setPrinting(true);
    let lines: TillCashJournalLine[];
    try {
      lines = await fetchAllLines();
    } catch (cause) {
      setPrinting(false);
      window.alert(localizeApiMessage(cause instanceof Error ? cause.message : ""));
      return;
    }
    setPrinting(false);

    const printed = openBrandedReport({
      documentTitle: t("cashDraft.print.fileName"),
      heading: t("cashDraft.print.heading"),
      subheading:
        from || to ? `${from || "…"} → ${to || "…"}` : t("cashDraft.print.allPeriods"),
      meta: [
        { label: t("cashDraft.print.till"), value: selectedLabel || data.tillCode },
        {
          label: t("cashDraft.columns.guichetCode"),
          value: data.agencyCode ?? "—",
        },
        {
          label: t("cashDraft.print.openingBalance"),
          value: money(data.openingBalanceMinor),
        },
        { label: t("cashDraft.print.count"), value: String(lines.length) },
      ],
      columns: [
        t("cashDraft.columns.sequence"),
        t("cashDraft.columns.reference"),
        t("cashDraft.columns.date"),
        t("cashDraft.columns.account"),
        t("cashDraft.columns.label"),
        t("cashDraft.columns.debit"),
        t("cashDraft.columns.credit"),
        t("cashDraft.columns.runningBalance"),
        t("cashDraft.columns.guichetCode"),
        t("cashDraft.columns.teller"),
      ],
      rows: lines.map((line) => [
        line.sequence_number,
        line.reference ?? "—",
        line.transaction_date ?? "—",
        line.customer_account_number ?? "—",
        lineLabel(line),
        line.cash_debit_minor ? money(line.cash_debit_minor, line.currency) : "—",
        line.cash_credit_minor ? money(line.cash_credit_minor, line.currency) : "—",
        money(line.running_balance_minor, line.currency),
        line.agency_code ?? "—",
        line.teller_name ?? "—",
      ]),
      numericColumns: [5, 6, 7],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("cashDraft.empty"),
      // Ten columns do not fit an A4 portrait page.
      orientation: "landscape",
    });
    if (!printed) {
      window.alert(t("cashDraft.print.printError"));
    }
  }

  const finalBalance = data?.lines.at(-1)?.running_balance_minor;

  return (
    <>
      <PageHeader
        title={t("cashDraft.pageTitle")}
        description={t("cashDraft.pageDescription")}
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => void handlePrint()}
            disabled={!data || data.lines.length === 0 || printing}
          >
            {printing ? t("common.loading") : t("cashDraft.print.action")}
          </Button>
        }
      />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <Select
            label={t("cashDraft.filters.till")}
            value={tillId}
            options={tills}
            placeholder={t("cashDraft.filters.tillPlaceholder")}
            onChange={(next) => {
              setPage(1);
              setTillId(next);
            }}
            required
          />
        </div>
        <div className="sm:w-44">
          <TextField
            label={t("cashDraft.filters.from")}
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </div>
        <div className="sm:w-44">
          <TextField
            label={t("cashDraft.filters.to")}
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {data ? t("cashDraft.count", { count: data.total }) : ""}
        </span>
      </section>

      {!tillId ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("cashDraft.pickTill")}
        </div>
      ) : (
        <>
          {data ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label={t("cashDraft.print.openingBalance")}
                value={money(data.openingBalanceMinor)}
              />
              <Stat
                label={t("cashDraft.columns.runningBalance")}
                value={money(finalBalance)}
                emphasis
              />
              <Stat
                label={t("cashDraft.print.count")}
                value={String(data.total)}
              />
              <Stat
                label={t("cashDraft.filters.till")}
                value={selectedLabel || data.tillCode}
              />
            </div>
          ) : null}

          {error ? (
            <Alert
              variant="danger"
              title={t("cashDraft.pageTitle")}
              action={
                <button
                  type="button"
                  onClick={refetch}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {t("common.tryAgain")}
                </button>
              }
            >
              {localizeApiMessage(error.message)}
            </Alert>
          ) : null}

          {loading && !data ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : data ? (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-background">
              <table className="w-full min-w-[86rem] text-sm">
                <thead className="bg-accent/5 text-xs">
                  <tr className="text-left">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.sequence")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.reference")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.date")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.account")}</th>
                    <th className="px-3 py-2 font-semibold">{t("cashDraft.columns.label")}</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">{t("cashDraft.columns.debit")}</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">{t("cashDraft.columns.credit")}</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">{t("cashDraft.columns.runningBalance")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.guichetCode")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.tillCode")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.teller")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("cashDraft.columns.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.lines.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                        {t("cashDraft.empty")}
                      </td>
                    </tr>
                  ) : (
                    data.lines.map((line) => (
                      <tr key={line.public_id} className={line.status === "reversed" ? "opacity-60" : undefined}>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{line.sequence_number}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-foreground">{line.reference ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{line.transaction_date ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-foreground">{line.customer_account_number ?? "—"}</td>
                        <td className="max-w-xs px-3 py-2.5 text-foreground">
                          {lineLabel(line)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-foreground">
                          {line.cash_debit_minor ? money(line.cash_debit_minor, line.currency) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-foreground">
                          {line.cash_credit_minor ? money(line.cash_credit_minor, line.currency) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                          {money(line.running_balance_minor, line.currency)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{line.agency_code ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{line.till_code}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{line.teller_name ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <Badge tone={line.status === "reversed" ? "warning" : "neutral"}>
                            {t(`cashDraft.status.${line.status}`)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {data && data.lastPage > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={data.currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {data.currentPage} / {data.lastPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.currentPage >= data.lastPage}
                onClick={() => setPage((p) => Math.min(data.lastPage, p + 1))}
              >
                {t("common.next")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-muted/30 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-base font-bold tabular-nums text-foreground"
            : "text-sm font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
