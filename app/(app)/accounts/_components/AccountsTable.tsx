"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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
  CustomerAccount,
  CustomerAccountStatus,
} from "@/lib/api/customer-accounts";

type Props = {
  rows: ReadonlyArray<CustomerAccount>;
  loading: boolean;
  pagination?: DataTablePagination;
  /** Resolve a client public_id to a display name (falls back to the id). */
  clientNameOf: (publicId: string | null) => string;
  /** Resolve an account-product public_id to its display name. */
  productNameOf: (publicId: string | null) => string;
  /** Platform-admin-only management actions (edit / status / archive). */
  canManage: boolean;
  onEdit: (account: CustomerAccount) => void;
  onChangeStatus: (account: CustomerAccount, next: CustomerAccountStatus) => void;
  onArchive: (account: CustomerAccount) => void;
};

const STATUS_TONE: Record<
  CustomerAccountStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  suspended: "warning",
  closed: "neutral",
  archived: "danger",
};

export function AccountsTable({
  rows,
  loading,
  pagination,
  clientNameOf,
  productNameOf,
  canManage,
  onEdit,
  onChangeStatus,
  onArchive,
}: Props) {
  const t = useTranslations();
  const router = useRouter();

  const columns = useMemo<ColumnDef<CustomerAccount, unknown>[]>(
    () => [
      {
        accessorKey: "account_number",
        header: t("accounts.columns.number"),
        cell: ({ getValue }) => (
          <span className="text-base font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "account_title",
        header: t("accounts.columns.title"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="text-foreground">{value || "—"}</span>
          );
        },
      },
      {
        id: "holder",
        header: t("accounts.columns.holder"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {clientNameOf(row.original.client_public_id)}
          </span>
        ),
      },
      {
        id: "product",
        header: t("accounts.columns.type"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {productNameOf(row.original.account_product_public_id)}
          </span>
        ),
      },
      {
        accessorKey: "currency",
        header: t("accounts.columns.currency"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("accounts.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as CustomerAccountStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`accounts.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "opened_on",
        header: t("accounts.columns.openedOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          if (!value) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value.slice(0, 10)}
            </span>
          );
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("accounts.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const account = row.original;
                const items: DropdownMenuItem[] = [];
                items.push({
                  label: t("accounts.actions.edit"),
                  onClick: () => onEdit(account),
                });
                items.push({ kind: "separator" });
                items.push({
                  kind: "label",
                  label: t("accounts.actions.changeStatus"),
                });
                items.push({
                  label: t("accounts.actions.statusActive"),
                  onClick: () => onChangeStatus(account, "active"),
                  disabled: account.status === "active",
                });
                items.push({
                  label: t("accounts.actions.statusSuspended"),
                  onClick: () => onChangeStatus(account, "suspended"),
                  disabled: account.status === "suspended",
                });
                items.push({
                  label: t("accounts.actions.statusClosed"),
                  onClick: () => onChangeStatus(account, "closed"),
                  disabled: account.status === "closed",
                });
                items.push({ kind: "separator" });
                items.push({
                  label: t("accounts.actions.archive"),
                  onClick: () => onArchive(account),
                  disabled: account.status === "archived",
                  destructive: true,
                });
                return (
                  <div
                    className="flex justify-end"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("accounts.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<CustomerAccount, unknown>,
          ]
        : []),
    ],
    [t, clientNameOf, productNameOf, canManage, onEdit, onChangeStatus, onArchive],
  );

  return (
    <DataTable<CustomerAccount>
      columns={columns}
      data={rows as CustomerAccount[]}
      loading={loading}
      emptyMessage={t("accounts.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("accounts.list.titleHeader")}
      titleAside={t("accounts.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("accounts.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
      onRowClick={(row) => router.push(`/accounts/${row.public_id}`)}
    />
  );
}
