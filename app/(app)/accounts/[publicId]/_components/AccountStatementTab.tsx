"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { TextField } from "@/components/ui/TextField";
import {
  fetchAccountStatement,
  type AccountMovement,
  type AccountStatement,
} from "@/lib/api/customer-accounts";
import { localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";

type Props = {
  accountPublicId: string;
  currency: string | null;
};

export function AccountStatementTab({ accountPublicId, currency }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const ccy = currency ?? "XAF";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [printing, setPrinting] = useState(false);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AccountStatement> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchAccountStatement(token, accountPublicId, {
        currency: ccy,
        from: from || undefined,
        to: to || undefined,
        page,
        perPage: 50,
      });
    },
    [token, accountPublicId, ccy, from, to, page],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    accountPublicId,
    ccy,
    from,
    to,
    page,
  ]);

  const money = (minor: number) => format.currencyMinor(minor, { currency: ccy });

  const columns = useMemo<ColumnDef<AccountMovement, unknown>[]>(
    () => [
      {
        accessorKey: "business_date",
        header: t("accountDetail.statement.columns.date"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 10) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "reference",
        header: t("accountDetail.statement.columns.reference"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "line_memo",
        header: t("accountDetail.statement.columns.memo"),
        cell: ({ row }) => (
          <span className="text-foreground">
            {memoLabel(row.original.line_memo)}
            {/*
              Both halves of an annulled pair print. Without this the reader is
              left to work out that a 10 000 deposit and a −10 000 line cancel.
            */}
            {row.original.reversed ? (
              <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[0.7rem] font-semibold text-warning">
                {t("accountDetail.statement.reversed")}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "debit_minor",
        header: t("accountDetail.statement.columns.debit"),
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return (
            <span className="tabular-nums text-foreground">
              {value ? money(value) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "credit_minor",
        header: t("accountDetail.statement.columns.credit"),
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return (
            <span className="tabular-nums text-foreground">
              {value ? money(value) : "—"}
            </span>
          );
        },
      },
    ],
    // money depends on format/ccy which are stable for the tab's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, ccy],
  );

  /**
   * The libellé of a movement, in the reader's language.
   *
   * System postings carry an English memo written at posting time — "Cash
   * deposited to customer account" — because the wording is persisted with the
   * entry and freezing a locale into the ledger would be worse than translating
   * on the way out. A relevé handed to a customer cannot print it, so the known
   * system memos are mapped here; anything a human typed passes through
   * untouched.
   */
  function memoLabel(memo: string | null): string {
    if (!memo) return "—";
    const exact = t(`accountDetail.statement.memos.${memo}`);
    if (exact !== `accountDetail.statement.memos.${memo}`) return exact;
    // Some memos carry a trailing detail ("Loan setup charge collected: TVA").
    const separator = memo.indexOf(":");
    if (separator > 0) {
      const head = memo.slice(0, separator).trim();
      const label = t(`accountDetail.statement.memos.${head}`);
      if (label !== `accountDetail.statement.memos.${head}`) {
        return `${label}${memo.slice(separator)}`;
      }
    }
    return memo;
  }

  const summary = data?.statement;
  const pageMeta = data?.pagination;

  /**
   * Every movement of the filtered period, walked page by page at the API's
   * maximum page size. Bounded so a mis-set filter on a very old account
   * cannot turn a print click into an unbounded request loop; the header
   * prints the number of lines actually collected, so a truncated statement
   * never claims to be complete.
   */
  async function fetchAllMovements(): Promise<AccountMovement[]> {
    if (!token) return [];
    const PER_PAGE = 100;
    const MAX_PAGES = 50;
    const collected: AccountMovement[] = [];
    for (let current = 1; current <= MAX_PAGES; current += 1) {
      const slice = await fetchAccountStatement(token, accountPublicId, {
        currency: ccy,
        from: from || undefined,
        to: to || undefined,
        page: current,
        perPage: PER_PAGE,
      });
      collected.push(...slice.movements);
      if (current >= (slice.pagination?.last_page ?? 1)) break;
    }
    return collected;
  }

  /**
   * IMPRIMER — the accounting team's print button on the statement tab. Prints
   * the period the tab is showing, summary above, movements below.
   *
   * The whole period, not the page on screen: a relevé that printed 50 lines
   * under a header announcing 300 movements is a document the counter cannot
   * hand to a customer. The pages are walked at the API's maximum page size
   * before the print window opens.
   */
  async function handlePrint() {
    if (!summary || !token || printing) return;
    setPrinting(true);
    let movements: AccountMovement[];
    try {
      movements = await fetchAllMovements();
    } catch (cause) {
      setPrinting(false);
      window.alert(localizeApiMessage(cause instanceof Error ? cause.message : ""));
      return;
    }
    setPrinting(false);

    const printed = openBrandedReport({
      documentTitle: t("accountDetail.statement.print.fileName"),
      heading: t("accountDetail.statement.print.heading"),
      subheading:
        from || to ? `${from || "…"} → ${to || "…"}` : t("accountDetail.statement.print.allPeriods"),
      meta: [
        { label: t("accountDetail.statement.opening"), value: money(summary.opening_balance_minor) },
        { label: t("accountDetail.statement.totalDebit"), value: money(summary.debit_total_minor) },
        { label: t("accountDetail.statement.totalCredit"), value: money(summary.credit_total_minor) },
        { label: t("accountDetail.statement.closing"), value: money(summary.closing_balance_minor) },
        { label: t("accountDetail.statement.print.count"), value: String(movements.length) },
      ],
      columns: [
        t("accountDetail.statement.columns.date"),
        t("accountDetail.statement.columns.reference"),
        t("accountDetail.statement.columns.memo"),
        t("accountDetail.statement.columns.debit"),
        t("accountDetail.statement.columns.credit"),
      ],
      rows: movements.map((m) => [
        m.business_date?.slice(0, 10) ?? "—",
        m.reference ?? "—",
        m.reversed
          ? `${memoLabel(m.line_memo)} (${t("accountDetail.statement.reversed")})`
          : memoLabel(m.line_memo),
        m.debit_minor ? money(m.debit_minor) : "—",
        m.credit_minor ? money(m.credit_minor) : "—",
      ]),
      numericColumns: [3, 4],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("accountDetail.statement.empty"),
    });
    if (!printed) {
      window.alert(t("accountDetail.statement.print.printError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <TextField
            label={t("accountDetail.statement.from")}
            type="date"
            value={from}
            onChange={(event) => {
              setPage(1);
              setFrom(event.target.value);
            }}
          />
        </div>
        <div className="sm:w-44">
          <TextField
            label={t("accountDetail.statement.to")}
            type="date"
            value={to}
            onChange={(event) => {
              setPage(1);
              setTo(event.target.value);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {t("accountDetail.balances.currencyNote", { currency: ccy })}
        </p>
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={!summary || loading || printing}
          className="shrink-0 rounded-[var(--radius-field)] border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {printing
            ? t("common.loading")
            : t("accountDetail.statement.print.action")}
        </button>
      </section>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={t("accountDetail.statement.opening")}
            value={money(summary.opening_balance_minor)}
          />
          <Stat
            label={t("accountDetail.statement.totalDebit")}
            value={money(summary.debit_total_minor)}
          />
          <Stat
            label={t("accountDetail.statement.totalCredit")}
            value={money(summary.credit_total_minor)}
          />
          <Stat
            label={t("accountDetail.statement.closing")}
            value={money(summary.closing_balance_minor)}
            emphasis
          />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="danger"
          title={t("accountDetail.statement.errorTitle")}
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

      <DataTable<AccountMovement>
        columns={columns}
        data={data?.movements ?? []}
        loading={loading && !data}
        emptyMessage={t("accountDetail.statement.empty")}
        getRowId={(row) => row.public_id}
        title={t("accountDetail.statement.title")}
        titleAside={t("accountDetail.statement.count", {
          count: pageMeta?.total ?? data?.movements.length ?? 0,
        })}
        pagination={
          pageMeta
            ? {
                page: pageMeta.current_page,
                pageSize: pageMeta.per_page,
                total: pageMeta.total,
                lastPage: pageMeta.last_page,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </div>
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
