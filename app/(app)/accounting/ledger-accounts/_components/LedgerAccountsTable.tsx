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
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  LedgerAccount,
  LedgerAccountClass,
  LedgerAccountStatus,
} from "@/lib/api/ledger-accounts";

type Props = {
  rows: ReadonlyArray<LedgerAccount>;
  loading: boolean;
  pagination?: DataTablePagination;
  canManage: boolean;
  onView: (account: LedgerAccount) => void;
  onEdit: (account: LedgerAccount) => void;
  onSetStatus: (account: LedgerAccount, next: "active" | "inactive") => void;
  onArchive: (account: LedgerAccount) => void;
};

const CLASS_TONE: Record<LedgerAccountClass, "info" | "success" | "warning"> = {
  asset: "info",
  liability: "warning",
  equity: "warning",
  revenue: "success",
  expense: "info",
};

const STATUS_TONE: Record<
  LedgerAccountStatus,
  "success" | "neutral" | "warning" | "danger"
> = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  archived: "danger",
};

export function LedgerAccountsTable({
  rows,
  loading,
  pagination,
  canManage,
  onView,
  onEdit,
  onSetStatus,
  onArchive,
}: Props) {
  const t = useTranslations();

  const columns = useMemo<ColumnDef<LedgerAccount, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("ledgerAccounts.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: t("ledgerAccounts.columns.name"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "account_class",
        header: t("ledgerAccounts.columns.class"),
        cell: ({ getValue }) => {
          const value = getValue() as LedgerAccountClass;
          return (
            <Badge tone={CLASS_TONE[value]}>
              {t(`ledgerAccounts.class.${value}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "normal_balance_side",
        header: t("ledgerAccounts.columns.normalSide"),
        cell: ({ getValue }) => {
          const value = getValue() as LedgerAccount["normal_balance_side"];
          return (
            <span className="text-muted-foreground">
              {t(`ledgerAccounts.side.${value}`)}
            </span>
          );
        },
      },
      {
        accessorKey: "account_type",
        header: t("ledgerAccounts.columns.type"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("ledgerAccounts.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as LedgerAccountStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`ledgerAccounts.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("ledgerAccounts.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const account = row.original;
          const items: DropdownMenuItem[] = [
            {
              label: t("ledgerAccounts.actions.view"),
              onClick: () => onView(account),
            },
          ];
          if (canManage) {
            items.push({ kind: "separator" });
            items.push({
              label: t("ledgerAccounts.actions.edit"),
              onClick: () => onEdit(account),
            });
            if (account.status !== "active") {
              items.push({
                label: t("ledgerAccounts.actions.activate"),
                onClick: () => onSetStatus(account, "active"),
                disabled: account.status === "archived",
              });
            }
            if (account.status === "active") {
              items.push({
                label: t("ledgerAccounts.actions.deactivate"),
                onClick: () => onSetStatus(account, "inactive"),
              });
            }
            items.push({ kind: "separator" });
            items.push({
              label: t("ledgerAccounts.actions.archive"),
              onClick: () => onArchive(account),
              disabled: account.status === "archived",
              destructive: true,
            });
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu
                trigger={<MoreVerticalIcon className="h-4 w-4" />}
                triggerLabel={t("ledgerAccounts.actions.menu")}
                items={items}
                align="right"
              />
            </div>
          );
        },
      },
    ],
    [t, canManage, onView, onEdit, onSetStatus, onArchive],
  );

  return (
    <DataTable<LedgerAccount>
      columns={columns}
      data={rows as LedgerAccount[]}
      loading={loading}
      emptyMessage={t("ledgerAccounts.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("ledgerAccounts.list.titleHeader")}
      titleAside={t("ledgerAccounts.list.count", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
