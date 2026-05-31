"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { localizeApiMessage } from "@/lib/api/errors";
import {
  fetchLedgerAccountMovements,
  type LedgerAccount,
  type LedgerAccountMovements,
} from "@/lib/api/ledger-accounts";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";

type Props = {
  open: boolean;
  account: LedgerAccount | null;
  onClose: () => void;
};

const PAGE_SIZE = 25;

export function LedgerAccountDetailDrawer({ open, account, onClose }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [currency, setCurrency] = useState("XAF");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LedgerAccountMovements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset filters whenever a different account is opened.
  useEffect(() => {
    if (!open) return;
    setCurrency("XAF");
    setFrom("");
    setTo("");
    setPage(1);
    setResult(null);
    setError(null);
  }, [open, account?.public_id]);

  const load = useCallback(async () => {
    if (!open || !token || !account) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLedgerAccountMovements(token, account.public_id, {
        currency: currency.trim().toUpperCase() || "XAF",
        from: from || undefined,
        to: to || undefined,
        page,
        perPage: PAGE_SIZE,
      });
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [open, token, account, currency, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const statement = result?.statement ?? null;
  const movements = result?.movements ?? [];
  const pagination = result?.meta.pagination;
  const cur = statement?.currency ?? currency.toUpperCase() ?? "XAF";

  function money(minor: number | null | undefined): string {
    if (minor === null || minor === undefined) return "—";
    return format.currencyMinor(minor, { currency: cur });
  }

  function handlePrint() {
    if (!account) return;
    openBrandedReport({
      documentTitle: `${t("ledgerAccounts.detail.printFilePrefix")}-${account.code}`,
      heading: t("ledgerAccounts.detail.printHeading"),
      subheading: `${account.code} — ${account.name}`,
      meta: [
        { label: t("ledgerAccounts.detail.currency"), value: cur },
        {
          label: t("ledgerAccounts.detail.period"),
          value:
            from || to
              ? `${from || "…"} → ${to || "…"}`
              : t("ledgerAccounts.detail.allPeriods"),
        },
        {
          label: t("ledgerAccounts.detail.openingBalance"),
          value: money(statement?.opening_balance_minor),
        },
        {
          label: t("ledgerAccounts.detail.closingBalance"),
          value: money(statement?.closing_balance_minor),
        },
        {
          label: t("ledgerAccounts.detail.totalDebit"),
          value: money(statement?.debit_total_minor),
        },
        {
          label: t("ledgerAccounts.detail.totalCredit"),
          value: money(statement?.credit_total_minor),
        },
      ],
      columns: [
        t("ledgerAccounts.detail.columns.date"),
        t("ledgerAccounts.detail.columns.reference"),
        t("ledgerAccounts.detail.columns.memo"),
        t("ledgerAccounts.detail.columns.debit"),
        t("ledgerAccounts.detail.columns.credit"),
      ],
      rows: movements.map((m) => [
        m.business_date,
        m.reference ?? "—",
        m.line_memo ?? "—",
        m.debit_minor ? money(m.debit_minor) : "",
        m.credit_minor ? money(m.credit_minor) : "",
      ]),
      numericColumns: [3, 4],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("ledgerAccounts.detail.empty"),
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("ledgerAccounts.detail.title", {
        code: account?.code ?? "",
      })}
      description={account?.name ?? ""}
      widthClassName="sm:w-[46rem]"
      footer={
        <Button variant="ghost" size="md" type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField
            label={t("ledgerAccounts.detail.currency")}
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            label={t("ledgerAccounts.detail.from")}
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <TextField
            label={t("ledgerAccounts.detail.to")}
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              size="md"
              type="button"
              onClick={handlePrint}
              disabled={loading || movements.length === 0}
              className="w-full"
            >
              {t("ledgerAccounts.detail.print")}
            </Button>
          </div>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label={t("ledgerAccounts.detail.openingBalance")}
            value={money(statement?.opening_balance_minor)}
          />
          <SummaryCard
            label={t("ledgerAccounts.detail.totalDebit")}
            value={money(statement?.debit_total_minor)}
          />
          <SummaryCard
            label={t("ledgerAccounts.detail.totalCredit")}
            value={money(statement?.credit_total_minor)}
          />
          <SummaryCard
            label={t("ledgerAccounts.detail.closingBalance")}
            value={money(statement?.closing_balance_minor)}
            strong
          />
        </div>

        {error ? (
          <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {localizeApiMessage(error)}
          </p>
        ) : null}

        {/* Movements */}
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">
                  {t("ledgerAccounts.detail.columns.date")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("ledgerAccounts.detail.columns.reference")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("ledgerAccounts.detail.columns.memo")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("ledgerAccounts.detail.columns.debit")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("ledgerAccounts.detail.columns.credit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && movements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    {t("common.loading")}
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    {t("ledgerAccounts.detail.empty")}
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr
                    key={m.public_id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                      {m.business_date}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.reference ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.line_memo ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {m.debit_minor ? money(m.debit_minor) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {m.credit_minor ? money(m.credit_minor) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.last_page > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t("ledgerAccounts.detail.pageOf", {
                page: pagination.current_page,
                total: pagination.last_page,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={loading || pagination.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={
                  loading || pagination.current_page >= pagination.last_page
                }
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

function SummaryCard({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2">
      <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          strong
            ? "text-sm font-semibold tabular-nums text-foreground"
            : "text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
