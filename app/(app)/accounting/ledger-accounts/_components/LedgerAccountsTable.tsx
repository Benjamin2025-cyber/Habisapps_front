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

/**
 * Tone per PCEMF class. Grouped so the balance sheet (classes 1–5) reads apart
 * from the income statement (6–7), with the off-balance-sheet class (8) distinct
 * from both.
 */
const CLASS_TONE: Record<LedgerAccountClass, "info" | "success" | "warning"> = {
  capitaux_permanents: "info",
  valeurs_immobilisees: "info",
  operations_clientele: "info",
  tiers: "info",
  tresorerie_interbancaire: "info",
  charges: "warning",
  produits: "success",
  hors_bilan: "warning",
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
        id: "structure",
        header: t("ledgerAccounts.columns.structure"),
        // Where the account sits in the consolidated chart. A grouping account
        // takes no entries, so flagging it here saves users discovering that
        // only when a journal line is refused.
        cell: ({ row }) => {
          const account = row.original;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {account.scope === "institution" ? (
                <Badge tone="accent">
                  {t("ledgerAccounts.scope.institution")}
                </Badge>
              ) : null}
              {account.is_postable ? null : (
                <Badge tone="neutral">
                  {t("ledgerAccounts.nature.grouping")}
                </Badge>
              )}
              {account.scope === "agency" && account.is_postable ? (
                <span className="text-muted-foreground">—</span>
              ) : null}
            </div>
          );
        },
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
              // Archived accounts are reactivatable on purpose. A code belongs to
              // the regulated chart and cannot be reinvented, so if archiving were
              // final a mistyped account would strand its code for good — and the
              // account holding it could never be corrected.
              items.push({
                label: t("ledgerAccounts.actions.activate"),
                onClick: () => onSetStatus(account, "active"),
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
