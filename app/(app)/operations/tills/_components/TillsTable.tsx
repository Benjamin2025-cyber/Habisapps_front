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
import type { Till, TillStatus } from "@/lib/api/tills";

type Props = {
  rows: ReadonlyArray<Till>;
  loading: boolean;
  pagination?: DataTablePagination;
  canManage: boolean;
  tellerNameOf: (publicId: string | null) => string;
  onEdit: (till: Till) => void;
  onSetStatus: (till: Till, next: TillStatus) => void;
};

export function TillsTable({
  rows,
  loading,
  pagination,
  canManage,
  tellerNameOf,
  onEdit,
  onSetStatus,
}: Props) {
  const t = useTranslations();

  const columns = useMemo<ColumnDef<Till, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("tills.columns.code"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: t("tills.columns.name"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        id: "teller",
        header: t("tills.columns.teller"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {tellerNameOf(row.original.assigned_user_public_id)}
          </span>
        ),
      },
      {
        accessorKey: "currency",
        header: t("tills.columns.currency"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "daily_state",
        header: t("tills.columns.dailyState"),
        cell: ({ getValue }) => {
          const s = getValue() as Till["daily_state"];
          return (
            <Badge tone={s === "open" ? "info" : "neutral"}>
              {t(`tills.dailyState.${s}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("tills.columns.status"),
        cell: ({ getValue }) => {
          const s = getValue() as TillStatus;
          return (
            <Badge tone={s === "active" ? "success" : "neutral"}>
              {t(`tills.status.${s}`)}
            </Badge>
          );
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("tills.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const till = row.original;
                const items: DropdownMenuItem[] = [
                  {
                    label: t("tills.actions.edit"),
                    onClick: () => onEdit(till),
                  },
                  { kind: "separator" },
                ];
                if (till.status !== "active") {
                  items.push({
                    label: t("tills.actions.activate"),
                    onClick: () => onSetStatus(till, "active"),
                  });
                } else {
                  items.push({
                    label: t("tills.actions.deactivate"),
                    onClick: () => onSetStatus(till, "inactive"),
                    disabled: till.daily_state === "open",
                  });
                }
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("tills.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<Till, unknown>,
          ]
        : []),
    ],
    [t, canManage, tellerNameOf, onEdit, onSetStatus],
  );

  return (
    <DataTable<Till>
      columns={columns}
      data={rows as Till[]}
      loading={loading}
      emptyMessage={t("tills.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("tills.list.titleHeader")}
      titleAside={t("tills.list.count", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
