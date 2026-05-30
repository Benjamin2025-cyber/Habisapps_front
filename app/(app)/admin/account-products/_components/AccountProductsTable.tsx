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
import type {
  AccountProduct,
  AccountProductStatus,
} from "@/lib/api/account-products";

type Props = {
  rows: ReadonlyArray<AccountProduct>;
  loading: boolean;
  pagination?: DataTablePagination;
  canManage: boolean;
  onEdit: (product: AccountProduct) => void;
  onSetStatus: (product: AccountProduct, next: "active" | "inactive") => void;
  onArchive: (product: AccountProduct) => void;
};

const STATUS_TONE: Record<
  AccountProductStatus,
  "success" | "neutral" | "danger"
> = {
  active: "success",
  inactive: "neutral",
  archived: "danger",
};

export function AccountProductsTable({
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

  const columns = useMemo<ColumnDef<AccountProduct, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("accountProducts.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: t("accountProducts.columns.name"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "account_family",
        header: t("accountProducts.columns.family"),
        cell: ({ getValue }) => {
          const family = getValue() as AccountProduct["account_family"];
          return (
            <Badge tone="info">{t(`accountProducts.family.${family}`)}</Badge>
          );
        },
      },
      {
        accessorKey: "minimum_balance_minor",
        header: t("accountProducts.columns.minimumBalance"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const value = row.original.minimum_balance_minor;
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
        accessorKey: "currency",
        header: t("accountProducts.columns.currency"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("accountProducts.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as AccountProductStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`accountProducts.status.${status}`)}
            </Badge>
          );
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("accountProducts.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const product = row.original;
                const items: DropdownMenuItem[] = [
                  {
                    label: t("accountProducts.actions.edit"),
                    onClick: () => onEdit(product),
                  },
                  { kind: "separator" },
                ];
                if (product.status !== "active") {
                  items.push({
                    label: t("accountProducts.actions.activate"),
                    onClick: () => onSetStatus(product, "active"),
                  });
                }
                if (product.status !== "inactive") {
                  items.push({
                    label: t("accountProducts.actions.deactivate"),
                    onClick: () => onSetStatus(product, "inactive"),
                    disabled: product.status === "archived",
                  });
                }
                items.push({ kind: "separator" });
                items.push({
                  label: t("accountProducts.actions.archive"),
                  onClick: () => onArchive(product),
                  disabled: product.status === "archived",
                  destructive: true,
                });
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("accountProducts.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<AccountProduct, unknown>,
          ]
        : []),
    ],
    [t, format, canManage, onEdit, onSetStatus, onArchive],
  );

  return (
    <DataTable<AccountProduct>
      columns={columns}
      data={rows as AccountProduct[]}
      loading={loading}
      emptyMessage={t("accountProducts.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("accountProducts.list.titleHeader")}
      titleAside={t("accountProducts.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("accountProducts.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
