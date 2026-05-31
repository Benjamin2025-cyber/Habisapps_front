"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import {
  createRecoveryAttempt,
  fetchRecoveryAttempts,
  type LoanRecoveryAttempt,
  type RecoveryAttemptStatus,
} from "@/lib/api/loan-recovery-attempts";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import type { Loan } from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  loan: Loan;
  recoverable: boolean;
};

const STATUS_TONE: Record<RecoveryAttemptStatus, "success" | "danger"> = {
  succeeded: "success",
  failed: "danger",
};

export function RecoveryAttemptsTab({ loan, recoverable }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;
  const currency = loan.currency ?? "XAF";

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<LoanRecoveryAttempt[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchRecoveryAttempts(token, loan.public_id, { perPage: 100 });
    },
    [token, loan.public_id],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    loan.public_id,
  ]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [recoveredOn, setRecoveredOn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openDrawer() {
    setAmount("");
    setRecoveredOn("");
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleAttempt() {
    if (!token) return;
    const minor = Math.round(Number(amount) * 100);
    if (!Number.isFinite(minor) || minor < 1) {
      setFormError(t("delinquencies.recovery.amountInvalid"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await createRecoveryAttempt(token, loan.public_id, {
        requested_amount_minor: minor,
        recovered_on: recoveredOn || undefined,
      });
      const recovered = format.currencyMinor(result.recovered_amount_minor, {
        currency,
      });
      const remaining = format.currencyMinor(result.remaining_amount_minor, {
        currency,
      });
      if (result.recovered_amount_minor > 0) {
        toast.success(
          t("delinquencies.recovery.toast.doneTitle"),
          t("delinquencies.recovery.toast.doneBody", { recovered, remaining }),
        );
      } else {
        toast.error(
          t("delinquencies.recovery.toast.nothingTitle"),
          t("delinquencies.recovery.toast.nothingBody"),
        );
      }
      setDrawerOpen(false);
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      setFormError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo<ColumnDef<LoanRecoveryAttempt, unknown>[]>(
    () => [
      {
        accessorKey: "attempted_at",
        header: t("delinquencies.recovery.columns.date"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 16).replace("T", " ") : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "requested_amount_minor",
        header: t("delinquencies.recovery.columns.requested"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {format.currencyMinor(row.original.requested_amount_minor ?? 0, {
              currency: row.original.currency ?? currency,
            })}
          </span>
        ),
      },
      {
        accessorKey: "recovered_amount_minor",
        header: t("delinquencies.recovery.columns.recovered"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {format.currencyMinor(row.original.recovered_amount_minor ?? 0, {
              currency: row.original.currency ?? currency,
            })}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("delinquencies.recovery.columns.status"),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={STATUS_TONE[status]}>
                {t(`delinquencies.recovery.status.${status}`)}
              </Badge>
              {status === "failed" && row.original.failure_reason ? (
                <span
                  className="max-w-[16rem] text-xs text-danger"
                  title={row.original.failure_reason}
                >
                  {row.original.failure_reason}
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, format, currency],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {recoverable
            ? t("delinquencies.recovery.intro")
            : t("delinquencies.recovery.notRecoverable")}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={openDrawer}
          disabled={!recoverable}
        >
          {t("delinquencies.recovery.actions.attempt")}
        </Button>
      </div>

      {error ? (
        <Alert
          variant="danger"
          title={t("delinquencies.recovery.errorTitle")}
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

      <DataTable<LoanRecoveryAttempt>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("delinquencies.recovery.empty")}
        getRowId={(row) => row.public_id}
        title={t("delinquencies.recovery.title")}
        titleAside={t("delinquencies.recovery.count", {
          count: data?.length ?? 0,
        })}
      />

      <Drawer
        open={drawerOpen}
        onClose={submitting ? () => undefined : () => setDrawerOpen(false)}
        title={t("delinquencies.recovery.drawer.title")}
        description={t("delinquencies.recovery.drawer.hint")}
        widthClassName="sm:w-[30rem]"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setDrawerOpen(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={handleAttempt}
              disabled={submitting}
            >
              {submitting
                ? t("common.loading")
                : t("delinquencies.recovery.drawer.confirm")}
            </Button>
          </>
        }
      >
        {formError ? (
          <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-col gap-4">
          <MoneyField
            label={t("delinquencies.recovery.fields.amount")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            hint={t("delinquencies.recovery.fields.amountHint")}
          />
          <TextField
            label={t("delinquencies.recovery.fields.recoveredOn")}
            type="date"
            value={recoveredOn}
            onChange={(event) => setRecoveredOn(event.target.value)}
            hint={t("delinquencies.recovery.fields.recoveredOnHint")}
          />
        </div>
      </Drawer>
    </div>
  );
}
