"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  createDelinquencyTracking,
  fetchDelinquencyTrackings,
  updateDelinquencyTracking,
  type DelinquencyTracking,
  type DelinquencyTrackingWritePayload,
} from "@/lib/api/delinquency-trackings";
import { localizeApiMessage } from "@/lib/api/errors";
import { openBrandedReport } from "@/lib/print/report";
import type { Loan } from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import {
  TrackingDrawer,
  type TrackingDrawerMode,
  REASON_CODE_SLUGS,
  APPOINTMENT_TYPE_SLUGS,
} from "./TrackingDrawer";

type Props = {
  loan: Loan;
};

export function DelinquencyTrackingsTab({ loan }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<DelinquencyTracking[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchDelinquencyTrackings(token, loan.public_id, { perPage: 100 });
    },
    [token, loan.public_id],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    loan.public_id,
  ]);

  const [drawerMode, setDrawerMode] = useState<TrackingDrawerMode | null>(null);
  const [editing, setEditing] = useState<DelinquencyTracking | null>(null);

  const reasonLabel = (code: string | null) =>
    !code
      ? "—"
      : (REASON_CODE_SLUGS as readonly string[]).includes(code)
        ? t(`delinquencies.tracking.reason.${code}`)
        : code;
  const appointmentLabel = (type: string | null) =>
    !type
      ? "—"
      : (APPOINTMENT_TYPE_SLUGS as readonly string[]).includes(type)
        ? t(`delinquencies.tracking.appointment.${type}`)
        : type;

  function handlePrint() {
    const rows = (data ?? []).map((d) => [
      d.tracking_date?.slice(0, 10) ?? "—",
      reasonLabel(d.reason_code),
      [appointmentLabel(d.appointment_type), d.appointment_date?.slice(0, 10)]
        .filter((part) => part && part !== "—")
        .join(" · ") || "—",
      d.promised_amount_minor !== null && d.promised_amount_minor !== undefined
        ? format.currencyMinor(d.promised_amount_minor, {
            currency: d.currency ?? "XAF",
          })
        : "—",
      d.comments ?? "",
    ]);
    const ok = openBrandedReport({
      documentTitle: `Suivis-${loan.loan_number ?? loan.public_id}`,
      heading: t("delinquencies.tracking.report.heading"),
      subheading: loan.loan_number ?? undefined,
      meta: [
        { label: t("delinquencies.tracking.report.loan"), value: loan.loan_number ?? "—" },
        {
          label: t("delinquencies.tracking.report.status"),
          value: t(`loans.status.${loan.status}`),
        },
        {
          label: t("delinquencies.tracking.report.count"),
          value: String(data?.length ?? 0),
        },
      ],
      columns: [
        t("delinquencies.tracking.columns.date"),
        t("delinquencies.tracking.columns.reason"),
        t("delinquencies.tracking.columns.appointment"),
        t("delinquencies.tracking.columns.promised"),
        t("delinquencies.tracking.fields.comments"),
      ],
      rows,
      numericColumns: [3],
      generatedLabel: t("delinquencies.tracking.report.generated"),
      emptyLabel: t("delinquencies.tracking.empty"),
    });
    if (!ok) {
      toast.error(
        t("delinquencies.tracking.report.popupBlockedTitle"),
        t("delinquencies.tracking.report.popupBlockedBody"),
      );
    }
  }

  async function handleSubmit(payload: DelinquencyTrackingWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      await createDelinquencyTracking(token, loan.public_id, payload);
      toast.success(
        t("delinquencies.tracking.toast.createdTitle"),
        t("delinquencies.tracking.toast.createdBody"),
      );
    } else if (drawerMode === "edit" && editing) {
      await updateDelinquencyTracking(
        token,
        loan.public_id,
        editing.public_id,
        payload,
      );
      toast.success(
        t("delinquencies.tracking.toast.updatedTitle"),
        t("delinquencies.tracking.toast.updatedBody"),
      );
    }
    setDrawerMode(null);
    setEditing(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<DelinquencyTracking, unknown>[]>(
    () => [
      {
        accessorKey: "tracking_date",
        header: t("delinquencies.tracking.columns.date"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-foreground">
            {(getValue() as string | null)?.slice(0, 10) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "reason_code",
        header: t("delinquencies.tracking.columns.reason"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {reasonLabel(getValue() as string | null)}
          </span>
        ),
      },
      {
        id: "appointment",
        header: t("delinquencies.tracking.columns.appointment"),
        cell: ({ row }) => {
          const type = appointmentLabel(row.original.appointment_type);
          const date = row.original.appointment_date?.slice(0, 10);
          return (
            <span className="text-muted-foreground">
              {type}
              {date ? ` · ${date}` : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "promised_amount_minor",
        header: t("delinquencies.tracking.columns.promised"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const value = row.original.promised_amount_minor;
          return value === null || value === undefined ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums text-foreground">
              {format.currencyMinor(value, {
                currency: row.original.currency ?? "XAF",
              })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("delinquencies.tracking.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original);
                setDrawerMode("edit");
              }}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("delinquencies.tracking.actions.edit")}
            </button>
          </div>
        ),
      },
    ],
    [t, format],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("delinquencies.tracking.intro")}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={(data?.length ?? 0) === 0}
          >
            {t("delinquencies.tracking.actions.print")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDrawerMode("create");
            }}
          >
            {t("delinquencies.tracking.actions.create")}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert
          variant="danger"
          title={t("delinquencies.tracking.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <DataTable<DelinquencyTracking>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("delinquencies.tracking.empty")}
        getRowId={(row) => row.public_id}
        title={t("delinquencies.tracking.title")}
        titleAside={t("delinquencies.tracking.count", {
          count: data?.length ?? 0,
        })}
      />

      <TrackingDrawer
        open={drawerMode !== null}
        mode={drawerMode ?? "create"}
        initial={editing}
        defaultCurrency={loan.currency}
        onClose={() => {
          setDrawerMode(null);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
