"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  entryTotals,
  fetchJournalEntries,
  type JournalEntry,
  type JournalEntryStatus,
  type PaginatedJournalEntries,
} from "@/lib/api/journal-entries";
import {
  fetchLedgerAccounts,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";
import { JournalTable } from "./_components/JournalTable";

const STATUSES: JournalEntryStatus[] = [
  "draft",
  "submitted",
  "approved",
  "posted",
  "rejected",
  "reversed",
];

const PAGE_SIZES = [25, 50, 100];

/**
 * P19 — Édition › Journal des écritures (consultation du livre-journal).
 * Vue en lecture seule de toutes les écritures comptables (manuelles ou
 * générées par les opérations), filtrables par statut / période / référence,
 * avec détail des lignes par écriture et export imprimable (PDF brandé).
 * Câblé sur `journal-entries` (lignes incluses dans la réponse). Lecture seule.
 */
export default function JournalPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["journal.entries.view"]);
  const canView = isPlatformAdmin || viewPerm;

  const [statusFilter, setStatusFilter] = useState<JournalEntryStatus | "all">(
    "posted",
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedJournalEntries> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchJournalEntries(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
  ]);

  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLedgerAccounts(token, { perPage: 100 })
      .then((res) => {
        if (!cancelled) setLedgerAccounts(res.data);
      })
      .catch(() => {
        if (!cancelled) setLedgerAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accountLabel = useCallback(
    (publicId: string | null) => {
      if (!publicId) return "—";
      const a = ledgerAccounts.find((x) => x.public_id === publicId);
      return a ? `${a.code} — ${a.name}` : publicId;
    },
    [ledgerAccounts],
  );

  const filtered = useMemo(() => {
    const rows = data?.data ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (from && e.business_date < from) return false;
      if (to && e.business_date > to) return false;
      if (needle.length > 0) {
        const hay = `${e.reference} ${e.description ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, statusFilter, from, to, search]);

  if (session.status !== "authenticated" || !canView) return null;

  function handlePrint() {
    const currency = filtered[0]?.lines[0]?.currency ?? "XAF";
    let sumDebit = 0;
    let sumCredit = 0;
    const rows: Array<Array<string | number | null>> = [];
    for (const entry of filtered) {
      for (const line of entry.lines) {
        sumDebit += line.debit_minor || 0;
        sumCredit += line.credit_minor || 0;
        rows.push([
          entry.business_date,
          entry.reference,
          accountLabel(line.ledger_account_public_id),
          line.line_memo || "—",
          line.debit_minor
            ? format.currencyMinor(line.debit_minor, { currency: line.currency })
            : "",
          line.credit_minor
            ? format.currencyMinor(line.credit_minor, { currency: line.currency })
            : "",
        ]);
      }
    }
    rows.push([
      "",
      "",
      "",
      t("journal.print.totals"),
      format.currencyMinor(sumDebit, { currency }),
      format.currencyMinor(sumCredit, { currency }),
    ]);

    openBrandedReport({
      documentTitle: t("journal.print.fileName"),
      heading: t("journal.print.heading"),
      subheading:
        from || to
          ? `${from || "…"} → ${to || "…"}`
          : t("journal.print.allPeriods"),
      meta: [
        {
          label: t("journal.filters.statusLabel"),
          value:
            statusFilter === "all"
              ? t("journal.filters.statusAll")
              : t(`journal.status.${statusFilter}`),
        },
        { label: t("journal.print.entryCount"), value: String(filtered.length) },
      ],
      columns: [
        t("journal.columns.date"),
        t("journal.columns.reference"),
        t("journal.lineColumns.account"),
        t("journal.lineColumns.memo"),
        t("journal.lineColumns.debit"),
        t("journal.lineColumns.credit"),
      ],
      rows,
      numericColumns: [4, 5],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("journal.empty"),
    });
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("journal.pageTitle")}
        description={t("journal.pageDescription")}
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={handlePrint}
            disabled={filtered.length === 0}
          >
            {t("journal.print.action")}
          </Button>
        }
      />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="journal-search"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("journal.filters.searchLabel")}
          </label>
          <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              id="journal-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("journal.filters.searchPlaceholder")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
            />
          </div>
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="journal-status"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("journal.filters.statusLabel")}
          </label>
          <Select
            id="journal-status"
            size="sm"
            value={statusFilter}
            options={[
              { value: "all", label: t("journal.filters.statusAll") },
              ...STATUSES.map((s) => ({
                value: s,
                label: t(`journal.status.${s}`),
              })),
            ]}
            onChange={(next) => setStatusFilter(next as JournalEntryStatus | "all")}
            className="mt-2"
          />
        </div>
        <div className="sm:w-40">
          <TextField
            label={t("journal.filters.from")}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="sm:w-40">
          <TextField
            label={t("journal.filters.to")}
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("journal.errorTitle")}
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

      <JournalTable
        entries={filtered}
        loading={loading && !data}
        accountLabel={accountLabel}
      />

      <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {t("journal.pagination.perPage")}
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            disabled={loading}
            aria-label={t("journal.pagination.perPage")}
            className="h-8 rounded-[var(--radius-field)] border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="tabular-nums">
            {t("journal.count", { count: filtered.length })}
          </span>
          {pageMeta && pageMeta.last_page > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || pageMeta.current_page <= 1}
                className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.previous")}
              </button>
              <span className="tabular-nums">
                {t("journal.pagination.pageOf", {
                  page: pageMeta.current_page,
                  total: pageMeta.last_page,
                })}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || pageMeta.current_page >= pageMeta.last_page}
                className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.next")}
              </button>
            </>
          ) : null}
        </div>
      </footer>
    </>
  );
}
