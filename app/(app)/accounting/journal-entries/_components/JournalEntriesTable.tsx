"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import {
  entryTotals,
  type JournalEntry,
  type JournalEntryStatus,
} from "@/lib/api/journal-entries";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { JOURNAL_STATUS_TONE } from "./status";

type Props = {
  rows: ReadonlyArray<JournalEntry>;
  loading: boolean;
  pagination?: DataTablePagination;
  onOpen: (entry: JournalEntry) => void;
};

export function JournalEntriesTable({ rows, loading, pagination, onOpen }: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const columns = useMemo<ColumnDef<JournalEntry, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("journalEntries.columns.reference"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "business_date",
        header: t("journalEntries.columns.date"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: t("journalEntries.columns.description"),
        cell: ({ getValue }) => (
          <span className="text-foreground">
            {(getValue() as string | null) || "—"}
          </span>
        ),
      },
      {
        id: "amount",
        header: t("journalEntries.columns.amount"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const { debit } = entryTotals(row.original);
          const currency = row.original.lines[0]?.currency ?? "XAF";
          return (
            <span className="tabular-nums text-foreground">
              {debit > 0 ? format.currencyMinor(debit, { currency }) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("journalEntries.columns.status"),
        cell: ({ getValue }) => {
          const s = getValue() as JournalEntryStatus;
          return (
            <Badge tone={JOURNAL_STATUS_TONE[s]}>
              {t(`journalEntries.status.${s}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("journalEntries.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpen(row.original)}>
              {t("journalEntries.actions.open")}
            </Button>
          </div>
        ),
      },
    ],
    [t, format, onOpen],
  );

  return (
    <DataTable<JournalEntry>
      columns={columns}
      data={rows as JournalEntry[]}
      loading={loading}
      emptyMessage={t("journalEntries.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("journalEntries.list.titleHeader")}
      titleAside={t("journalEntries.list.count", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
