"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import type { DatabaseBackup } from "@/lib/api/database";
import { useFormatter, useLocale, useTranslations } from "@/lib/i18n/I18nProvider";
import {
  BACKUP_STATUS_TONE,
  formatBytes,
  verificationTone,
} from "./database-status";

type Props = {
  rows: DatabaseBackup[];
  loading: boolean;
  pagination?: DataTablePagination;
  busyId: string | null;
  canDownload: boolean;
  canVerify: boolean;
  canRestore: boolean;
  canDelete: boolean;
  onDownload: (backup: DatabaseBackup) => void;
  onVerify: (backup: DatabaseBackup) => void;
  onRestore: (backup: DatabaseBackup) => void;
  onDelete: (backup: DatabaseBackup) => void;
};

export function BackupsTable({
  rows,
  loading,
  pagination,
  busyId,
  canDownload,
  canVerify,
  canRestore,
  canDelete,
  onDownload,
  onVerify,
  onRestore,
  onDelete,
}: Props) {
  const t = useTranslations("database.backups");
  const format = useFormatter();
  const { intlLocale } = useLocale();

  const columns = useMemo<ColumnDef<DatabaseBackup, unknown>[]>(() => {
    return [
      {
        accessorKey: "filename",
        header: () => t("columns.filename"),
        cell: (info) => {
          const backup = info.row.original;
          const note =
            backup.metadata && typeof backup.metadata.note === "string"
              ? (backup.metadata.note as string)
              : null;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-foreground">
                {backup.filename}
              </span>
              {note ? (
                <span className="text-xs text-muted-foreground">{note}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: () => t("columns.status"),
        cell: (info) => {
          const backup = info.row.original;
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={BACKUP_STATUS_TONE[backup.status]}>
                {t(`status.${backup.status}`)}
              </Badge>
              {backup.verification_status ? (
                <Badge tone={verificationTone(backup.verification_status)}>
                  {t(`verification.${backup.verification_status}`)}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "size_bytes",
        header: () => t("columns.size"),
        meta: { align: "right" },
        cell: (info) => (
          <span className="tabular-nums text-foreground">
            {formatBytes(info.row.original.size_bytes, intlLocale)}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: () => t("columns.createdAt"),
        cell: (info) => (
          <span className="text-foreground">
            {format.dateTime(info.row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => t("columns.actions"),
        meta: { align: "right" },
        cell: (info) => {
          const backup = info.row.original;
          const busy = busyId === backup.public_id;
          const canRunRestore =
            canRestore &&
            (backup.status === "completed" || backup.status === "verified");
          return (
            <div className="flex items-center justify-end gap-1">
              {canDownload && backup.is_downloadable ? (
                <ActionButton
                  label={t("actions.download")}
                  disabled={busy}
                  onClick={() => onDownload(backup)}
                />
              ) : null}
              {canVerify && backup.status !== "deleted" ? (
                <ActionButton
                  label={t("actions.verify")}
                  disabled={busy}
                  onClick={() => onVerify(backup)}
                />
              ) : null}
              {canRunRestore ? (
                <ActionButton
                  label={t("actions.restore")}
                  disabled={busy}
                  onClick={() => onRestore(backup)}
                />
              ) : null}
              {canDelete && backup.status !== "deleted" ? (
                <ActionButton
                  label={t("actions.delete")}
                  tone="danger"
                  disabled={busy}
                  onClick={() => onDelete(backup)}
                />
              ) : null}
            </div>
          );
        },
      },
    ];
  }, [
    t,
    format,
    intlLocale,
    busyId,
    canDownload,
    canVerify,
    canRestore,
    canDelete,
    onDownload,
    onVerify,
    onRestore,
    onDelete,
  ]);

  return (
    <DataTable<DatabaseBackup>
      columns={columns}
      data={rows}
      loading={loading}
      emptyMessage={t("empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
    />
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        tone === "danger"
          ? "rounded-[var(--radius-field)] px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
          : "rounded-[var(--radius-field)] px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {label}
    </button>
  );
}
