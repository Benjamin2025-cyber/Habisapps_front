"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import type {
  TellerSession,
  TellerSessionStatus,
} from "@/lib/api/teller-sessions";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  rows: ReadonlyArray<TellerSession>;
  loading: boolean;
  pagination?: DataTablePagination;
  canManage: boolean;
  tillLabelOf: (publicId: string | null) => string;
  tellerNameOf: (publicId: string | null) => string;
  onClose: (session: TellerSession) => void;
};

export function SessionsTable({
  rows,
  loading,
  pagination,
  canManage,
  tillLabelOf,
  tellerNameOf,
  onClose,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const columns = useMemo<ColumnDef<TellerSession, unknown>[]>(
    () => [
      {
        id: "till",
        header: t("sessions.columns.till"),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {tillLabelOf(row.original.till_public_id)}
          </span>
        ),
      },
      {
        id: "teller",
        header: t("sessions.columns.teller"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {tellerNameOf(row.original.teller_user_public_id)}
          </span>
        ),
      },
      {
        accessorKey: "business_date",
        header: t("sessions.columns.businessDate"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        id: "opening",
        header: t("sessions.columns.opening"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const v = row.original.opening_declaration_minor;
          return (
            <span className="tabular-nums text-foreground">
              {v !== null && v !== undefined
                ? format.currencyMinor(v, {
                    currency: row.original.currency ?? "XAF",
                  })
                : "—"}
            </span>
          );
        },
      },
      {
        id: "closing",
        header: t("sessions.columns.closing"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const v = row.original.closing_declaration_minor;
          return (
            <span className="tabular-nums text-foreground">
              {v !== null && v !== undefined
                ? format.currencyMinor(v, {
                    currency: row.original.currency ?? "XAF",
                  })
                : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("sessions.columns.status"),
        cell: ({ getValue }) => {
          const s = getValue() as TellerSessionStatus;
          return (
            <Badge tone={s === "open" ? "success" : "neutral"}>
              {t(`sessions.status.${s}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("sessions.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) =>
          canManage && row.original.status === "open" ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClose(row.original)}
              >
                {t("sessions.actions.close")}
              </Button>
            </div>
          ) : (
            <span className="block text-right text-muted-foreground">—</span>
          ),
      },
    ],
    [t, format, canManage, tillLabelOf, tellerNameOf, onClose],
  );

  return (
    <DataTable<TellerSession>
      columns={columns}
      data={rows as TellerSession[]}
      loading={loading}
      emptyMessage={t("sessions.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("sessions.list.titleHeader")}
      titleAside={t("sessions.list.count", {
        count: pagination?.total ?? rows.length,
      })}
    />
  );
}
