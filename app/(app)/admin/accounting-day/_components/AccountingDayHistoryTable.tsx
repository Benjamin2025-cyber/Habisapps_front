"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { AccountingDay } from "@/lib/api/accounting-days";
import {
  ACCOUNTING_DAY_STATUS_TONES,
  accountingDayStatusKey,
} from "./status";

type Props = {
  rows: AccountingDay[];
  loading: boolean;
  total: number;
  pagination?: DataTablePagination;
};

/** Paginated history of accounting days for the caller's scope. */
export function AccountingDayHistoryTable({ rows, loading, total, pagination }: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const columns = useMemo<ColumnDef<AccountingDay, unknown>[]>(
    () => [
      {
        id: "business_date",
        header: t("accountingDay.table.businessDate"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-foreground">
            {row.original.business_date
              ? format.date(row.original.business_date)
              : "—"}
          </span>
        ),
      },
      {
        id: "scope",
        header: t("accountingDay.table.scope"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {t(`accountingDay.scope.${row.original.scope}`)}
          </span>
        ),
      },
      {
        id: "status",
        header: t("accountingDay.table.status"),
        cell: ({ row }) => (
          <Badge tone={ACCOUNTING_DAY_STATUS_TONES[row.original.status]}>
            {t(accountingDayStatusKey(row.original.status))}
          </Badge>
        ),
      },
      {
        id: "opened_at",
        header: t("accountingDay.table.openedAt"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.calendar_opened_at
              ? format.dateTime(row.original.calendar_opened_at)
              : "—"}
          </span>
        ),
      },
      {
        id: "closed_at",
        header: t("accountingDay.table.closedAt"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.calendar_closed_at
              ? format.dateTime(row.original.calendar_closed_at)
              : "—"}
          </span>
        ),
      },
    ],
    [t, format],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      getRowId={(row) => row.public_id}
      title={t("accountingDay.table.title")}
      titleAside={t("accountingDay.table.count", { count: total })}
      emptyMessage={t("accountingDay.table.empty")}
      pagination={pagination}
    />
  );
}
