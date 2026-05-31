"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ChevronDownIcon } from "@/components/ui/icons";
import {
  entryTotals,
  type JournalEntry,
  type JournalEntryStatus,
} from "@/lib/api/journal-entries";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

const STATUS_TONE: Record<
  JournalEntryStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  draft: "neutral",
  submitted: "info",
  approved: "warning",
  posted: "success",
  rejected: "danger",
  cancelled: "neutral",
  archived: "neutral",
  reversed: "danger",
};

type Props = {
  entries: ReadonlyArray<JournalEntry>;
  loading: boolean;
  accountLabel: (publicId: string | null) => string;
};

export function JournalTable({ entries, loading, accountLabel }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && entries.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        {t("journal.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="w-8 px-2 py-2" />
            <th className="px-3 py-2 font-semibold">{t("journal.columns.date")}</th>
            <th className="px-3 py-2 font-semibold">
              {t("journal.columns.reference")}
            </th>
            <th className="px-3 py-2 font-semibold">
              {t("journal.columns.description")}
            </th>
            <th className="px-3 py-2 font-semibold">
              {t("journal.columns.status")}
            </th>
            <th className="px-3 py-2 text-right font-semibold">
              {t("journal.columns.amount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const { debit } = entryTotals(entry);
            const currency = entry.lines[0]?.currency ?? "XAF";
            const isOpen = expanded.has(entry.public_id);
            return (
              <Fragment key={entry.public_id}>
                <tr
                  className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                  onClick={() => toggle(entry.public_id)}
                >
                  <td className="px-2 py-2.5 text-muted-foreground">
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${
                        isOpen ? "" : "-rotate-90"
                      }`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                    {entry.business_date}
                  </td>
                  <td className="px-3 py-2.5 font-bold tabular-nums text-foreground">
                    {entry.reference}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">
                    {entry.description || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS_TONE[entry.status]}>
                      {t(`journal.status.${entry.status}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {debit > 0 ? format.currencyMinor(debit, { currency }) : "—"}
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="border-b border-border/60 bg-muted/10">
                    <td />
                    <td colSpan={5} className="px-3 py-2">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="text-left uppercase tracking-wider text-muted-foreground">
                            <th className="py-1 pr-3 font-semibold">
                              {t("journal.lineColumns.account")}
                            </th>
                            <th className="py-1 pr-3 font-semibold">
                              {t("journal.lineColumns.memo")}
                            </th>
                            <th className="py-1 pr-3 text-right font-semibold">
                              {t("journal.lineColumns.debit")}
                            </th>
                            <th className="py-1 text-right font-semibold">
                              {t("journal.lineColumns.credit")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((line) => (
                            <tr key={line.public_id}>
                              <td className="py-1 pr-3 text-foreground">
                                {accountLabel(line.ledger_account_public_id)}
                              </td>
                              <td className="py-1 pr-3 text-muted-foreground">
                                {line.line_memo || "—"}
                              </td>
                              <td className="py-1 pr-3 text-right tabular-nums text-foreground">
                                {line.debit_minor
                                  ? format.currencyMinor(line.debit_minor, {
                                      currency: line.currency,
                                    })
                                  : "—"}
                              </td>
                              <td className="py-1 text-right tabular-nums text-foreground">
                                {line.credit_minor
                                  ? format.currencyMinor(line.credit_minor, {
                                      currency: line.currency,
                                    })
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
