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
import type { Agency, AgencyStatus } from "@/lib/api/agencies";

type Props = {
  rows: ReadonlyArray<Agency>;
  loading: boolean;
  /** When false, the row action menu is hidden entirely. */
  canManage: boolean;
  pagination?: DataTablePagination;
  onEdit: (agency: Agency) => void;
  onChangeStatus: (agency: Agency, next: AgencyStatus) => void;
  onTransferManager: (agency: Agency) => void;
};

const STATUS_TONE: Record<
  AgencyStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  archived: "danger",
};

export function AgenciesTable({
  rows,
  loading,
  canManage,
  pagination,
  onEdit,
  onChangeStatus,
  onTransferManager,
}: Props) {
  const t = useTranslations();

  const columns = useMemo<ColumnDef<Agency, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("agencies.columns.code"),
        cell: ({ getValue }) => (
          <span className="text-base font-bold tabular-nums text-foreground">
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: t("agencies.columns.name"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{String(getValue() ?? "")}</span>
        ),
      },
      {
        accessorKey: "region",
        header: t("agencies.columns.region"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "city",
        header: t("agencies.columns.city"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "po_box",
        header: t("agencies.columns.poBox"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "phone_number",
        header: t("agencies.columns.phone"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "fax_number",
        header: t("agencies.columns.fax"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("agencies.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as AgencyStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`agencies.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "manager_name",
        header: t("agencies.columns.manager"),
        cell: ({ getValue }) => {
          const name = getValue() as string | null;
          return name ? (
            <span className="text-foreground">{name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("agencies.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const agency = row.original;
                const items: DropdownMenuItem[] = [
                  {
                    label: t("agencies.actions.edit"),
                    onClick: () => onEdit(agency),
                  },
                  {
                    label: t("agencies.actions.transferManager"),
                    onClick: () => onTransferManager(agency),
                  },
                  { kind: "separator" },
                  { kind: "label", label: t("agencies.actions.changeStatus") },
                  {
                    label: t("agencies.actions.statusActive"),
                    onClick: () => onChangeStatus(agency, "active"),
                    disabled: agency.status === "active",
                  },
                  {
                    label: t("agencies.actions.statusInactive"),
                    onClick: () => onChangeStatus(agency, "inactive"),
                    disabled: agency.status === "inactive",
                  },
                  {
                    label: t("agencies.actions.statusSuspended"),
                    onClick: () => onChangeStatus(agency, "suspended"),
                    disabled: agency.status === "suspended",
                  },
                  {
                    label: t("agencies.actions.statusArchived"),
                    onClick: () => onChangeStatus(agency, "archived"),
                    disabled: agency.status === "archived",
                    destructive: true,
                  },
                ];
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("agencies.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<Agency, unknown>,
          ]
        : []),
    ],
    [t, canManage, onEdit, onChangeStatus, onTransferManager],
  );

  return (
    <DataTable<Agency>
      columns={columns}
      data={rows as Agency[]}
      loading={loading}
      emptyMessage={t("agencies.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("agencies.list.titleHeader")}
      titleAside={t("agencies.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("agencies.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
