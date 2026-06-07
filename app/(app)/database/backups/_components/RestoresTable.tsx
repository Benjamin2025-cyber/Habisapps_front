"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import type { DatabaseRestoreOperation } from "@/lib/api/database";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { RESTORE_STATUS_TONE } from "./database-status";

type Props = {
  rows: DatabaseRestoreOperation[];
  loading: boolean;
  pagination?: DataTablePagination;
  busyId: string | null;
  canCancel: boolean;
  onCancel: (op: DatabaseRestoreOperation) => void;
};

export function RestoresTable({
  rows,
  loading,
  pagination,
  busyId,
  canCancel,
  onCancel,
}: Props) {
  const t = useTranslations("database.restores");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<DatabaseRestoreOperation, unknown>[]>(() => {
    return [
      {
        accessorKey: "created_at",
        header: () => t("columns.startedAt"),
        cell: (info) => (
          <span className="text-foreground">
            {format.dateTime(info.row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: "target",
        header: () => t("columns.target"),
        cell: (info) => (
          <span className="text-foreground">
            {t(`target.${info.row.original.target}`)}
          </span>
        ),
      },
      {
        accessorKey: "mode",
        header: () => t("columns.mode"),
        cell: (info) => {
          const op = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="text-foreground">{t(`mode.${op.mode}`)}</span>
              {op.destructive ? (
                <Badge tone="danger">{t("destructive")}</Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: () => t("columns.status"),
        cell: (info) => {
          const op = info.row.original;
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={RESTORE_STATUS_TONE[op.status]}>
                {t(`status.${op.status}`)}
              </Badge>
              {op.failure_reason ? (
                <span className="text-xs text-danger">{op.failure_reason}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => t("columns.actions"),
        meta: { align: "right" },
        cell: (info) => {
          const op = info.row.original;
          const cancellable =
            canCancel && (op.status === "planned" || op.status === "pending");
          if (!cancellable) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <button
              type="button"
              onClick={() => onCancel(op)}
              disabled={busyId === op.public_id}
              className="rounded-[var(--radius-field)] px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("actions.cancel")}
            </button>
          );
        },
      },
    ];
  }, [t, format, busyId, canCancel, onCancel]);

  return (
    <DataTable<DatabaseRestoreOperation>
      columns={columns}
      data={rows}
      loading={loading}
      emptyMessage={t("empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
    />
  );
}
