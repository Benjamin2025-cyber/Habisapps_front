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
  StaffUser,
  StaffUserStatus,
} from "@/lib/api/staff-users";

type Props = {
  rows: ReadonlyArray<StaffUser>;
  loading: boolean;
  pagination?: DataTablePagination;
  /** Optional map of role.name → display_name for prettier badges. */
  roleLabels?: Record<string, string>;
  onEdit: (user: StaffUser) => void;
  onManageRoles: (user: StaffUser) => void;
  onChangeStatus: (
    user: StaffUser,
    next: Exclude<StaffUserStatus, "pending_verification">,
  ) => void;
};

const STATUS_TONE: Record<
  StaffUserStatus,
  "success" | "warning" | "danger" | "neutral" | "info"
> = {
  active: "success",
  pending_verification: "info",
  suspended: "warning",
  deactivated: "danger",
};

export function StaffUsersTable({
  rows,
  loading,
  pagination,
  roleLabels = {},
  onEdit,
  onManageRoles,
  onChangeStatus,
}: Props) {
  const t = useTranslations();

  const columns = useMemo<ColumnDef<StaffUser, unknown>[]>(
    () => [
      {
        accessorKey: "matricule",
        header: t("staffUsers.columns.matricule"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="text-base font-bold tabular-nums text-foreground">
              {value ?? "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "name",
        header: t("staffUsers.columns.name"),
        cell: ({ getValue }) => (
          <span className="text-foreground">{String(getValue() ?? "")}</span>
        ),
      },
      {
        accessorKey: "phone_number",
        header: t("staffUsers.columns.phone"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: t("staffUsers.columns.email"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="text-muted-foreground">{value}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "roles",
        header: t("staffUsers.columns.roles"),
        cell: ({ row }) => {
          const roles = row.original.roles;
          if (roles.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {roles.slice(0, 2).map((role) => (
                <Badge key={role} tone="accent">
                  {roleLabels[role] ?? role}
                </Badge>
              ))}
              {roles.length > 2 ? (
                <Badge tone="neutral">+{roles.length - 2}</Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "agency_code",
        header: t("staffUsers.columns.agency"),
        cell: ({ row }) => {
          const code = row.original.agency_code;
          const name = row.original.agency_name;
          if (!code && !name) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="text-foreground">
              <span className="font-semibold tabular-nums">{code ?? ""}</span>
              {name ? (
                <span className="text-muted-foreground"> — {name}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("staffUsers.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as StaffUserStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`staffUsers.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("staffUsers.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const user = row.original;
          const items: DropdownMenuItem[] = [
            {
              label: t("staffUsers.actions.edit"),
              onClick: () => onEdit(user),
            },
            {
              label: t("staffUsers.actions.manageRoles"),
              onClick: () => onManageRoles(user),
            },
            { kind: "separator" },
            { kind: "label", label: t("staffUsers.actions.changeStatus") },
            {
              label: t("staffUsers.actions.statusActive"),
              onClick: () => onChangeStatus(user, "active"),
              disabled:
                user.status === "active" ||
                user.status === "pending_verification",
            },
            {
              label: t("staffUsers.actions.statusSuspended"),
              onClick: () => onChangeStatus(user, "suspended"),
              disabled: user.status === "suspended",
            },
            {
              label: t("staffUsers.actions.statusDeactivated"),
              onClick: () => onChangeStatus(user, "deactivated"),
              disabled: user.status === "deactivated",
              destructive: true,
            },
          ];
          return (
            <div className="flex justify-end">
              <DropdownMenu
                trigger={<MoreVerticalIcon className="h-4 w-4" />}
                triggerLabel={t("staffUsers.actions.menu")}
                items={items}
                align="right"
              />
            </div>
          );
        },
      },
    ],
    [t, roleLabels, onEdit, onManageRoles, onChangeStatus],
  );

  return (
    <DataTable<StaffUser>
      columns={columns}
      data={rows as StaffUser[]}
      loading={loading}
      emptyMessage={t("staffUsers.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("staffUsers.list.titleHeader")}
      titleAside={t("staffUsers.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("staffUsers.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
