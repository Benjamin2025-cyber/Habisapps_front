"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { LoanProduct, LoanProductStatus } from "@/lib/api/loan-products";

type Props = {
  rows: ReadonlyArray<LoanProduct>;
  loading: boolean;
  pagination?: DataTablePagination;
  canManage: boolean;
  onEdit: (product: LoanProduct) => void;
  onSetStatus: (product: LoanProduct, next: "active" | "inactive") => void;
  onArchive: (product: LoanProduct) => void;
};

const STATUS_TONE: Record<LoanProductStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  archived: "danger",
};

export function LoanProductsTable({
  rows,
  loading,
  pagination,
  canManage,
  onEdit,
  onSetStatus,
  onArchive,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const columns = useMemo<ColumnDef<LoanProduct, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("loanProducts.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: t("loanProducts.columns.name"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        id: "term",
        header: t("loanProducts.columns.term"),
        cell: ({ row }) => {
          const { min_term_count, max_term_count, term_unit } = row.original;
          if (min_term_count === null && max_term_count === null)
            return <span className="text-muted-foreground">—</span>;
          const unit = term_unit
            ? t(`loanProducts.termUnit.${term_unit}`)
            : "";
          const range =
            min_term_count !== null && max_term_count !== null
              ? `${min_term_count}–${max_term_count}`
              : String(min_term_count ?? max_term_count);
          return (
            <span className="tabular-nums text-muted-foreground">
              {range} {unit}
            </span>
          );
        },
      },
      {
        id: "amount",
        header: t("loanProducts.columns.amountRange"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const { min_amount_minor, max_amount_minor } = row.original;
          if (min_amount_minor === null && max_amount_minor === null)
            return <span className="text-muted-foreground">—</span>;
          const fmt = (minor: number | null) =>
            minor === null
              ? "—"
              : format.currencyMinor(minor, { currency: "XAF" });
          return (
            <span className="tabular-nums text-foreground">
              {fmt(min_amount_minor)} – {fmt(max_amount_minor)}
            </span>
          );
        },
      },
      {
        accessorKey: "interest_rate",
        header: t("loanProducts.columns.interestRate"),
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          if (value === null || value === "")
            return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums text-foreground">
              {formatRate(value)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("loanProducts.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as LoanProductStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`loanProducts.status.${status}`)}
            </Badge>
          );
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("loanProducts.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const product = row.original;
                const items: DropdownMenuItem[] = [
                  {
                    label: t("loanProducts.actions.edit"),
                    onClick: () => onEdit(product),
                  },
                  { kind: "separator" },
                ];
                if (product.status !== "active") {
                  items.push({
                    label: t("loanProducts.actions.activate"),
                    onClick: () => onSetStatus(product, "active"),
                  });
                }
                if (product.status !== "inactive") {
                  items.push({
                    label: t("loanProducts.actions.deactivate"),
                    onClick: () => onSetStatus(product, "inactive"),
                    disabled: product.status === "archived",
                  });
                }
                items.push({ kind: "separator" });
                items.push({
                  label: t("loanProducts.actions.archive"),
                  onClick: () => onArchive(product),
                  disabled: product.status === "archived",
                  destructive: true,
                });
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("loanProducts.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<LoanProduct, unknown>,
          ]
        : []),
    ],
    [t, format, canManage, onEdit, onSetStatus, onArchive],
  );

  return (
    <DataTable<LoanProduct>
      columns={columns}
      data={rows as LoanProduct[]}
      loading={loading}
      emptyMessage={t("loanProducts.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("loanProducts.list.titleHeader")}
      titleAside={t("loanProducts.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("loanProducts.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}

/**
 * Rates are stored as decimals. We can't tell from the value alone whether
 * `0.05` means 5 % (fraction) or `5` means 5 % (percent), so we render the raw
 * number with a `%` suffix — the drawer hint documents the same convention.
 */
function formatRate(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${parsed}%`;
}
