"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { Loan, LoanStatus } from "@/lib/api/loans";
import { LOAN_STATUS_TONE } from "./status";

type Props = {
  rows: ReadonlyArray<Loan>;
  loading: boolean;
  pagination?: DataTablePagination;
  /** product public_id → display label. */
  productNameOf: (publicId: string | null) => string;
};

export function LoansTable({ rows, loading, pagination, productNameOf }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();

  const columns = useMemo<ColumnDef<Loan, unknown>[]>(
    () => [
      {
        accessorKey: "loan_number",
        header: t("loans.columns.number"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: t("loans.columns.product"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {productNameOf(row.original.loan_product_public_id)}
          </span>
        ),
      },
      {
        accessorKey: "requested_amount_minor",
        header: t("loans.columns.amount"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const value = row.original.requested_amount_minor;
          if (value === null || value === undefined)
            return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums text-foreground">
              {format.currencyMinor(value, {
                currency: row.original.currency ?? "XAF",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("loans.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as LoanStatus;
          return (
            <Badge tone={LOAN_STATUS_TONE[status]}>
              {t(`loans.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "applied_on",
        header: t("loans.columns.appliedOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 10) : "—"}
            </span>
          );
        },
      },
    ],
    [t, format, productNameOf],
  );

  return (
    <DataTable<Loan>
      columns={columns}
      data={rows as Loan[]}
      loading={loading}
      emptyMessage={t("loans.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("loans.list.titleHeader")}
      titleAside={t("loans.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("loans.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
      onRowClick={(row) => router.push(`/credit/loans/${row.public_id}`)}
    />
  );
}
