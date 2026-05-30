"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import {
  fetchGuarantors,
  type ClientGuarantor,
} from "@/lib/api/client-guarantors";
import {
  createGuaranteeObligation,
  fetchGuaranteeObligations,
  releaseGuaranteeObligation,
  updateGuaranteeObligation,
  type GuaranteeObligation,
  type GuaranteeObligationStatus,
  type GuaranteeObligationWritePayload,
} from "@/lib/api/guarantee-obligations";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import type { Loan } from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { ObligationDrawer, type ObligationDrawerMode } from "./ObligationDrawer";

type Props = {
  loan: Loan;
  loanClosed: boolean;
};

const STATUS_TONE: Record<
  GuaranteeObligationStatus,
  "success" | "neutral" | "danger"
> = {
  active: "success",
  released: "neutral",
  cancelled: "danger",
};

export function GuarantorsObligationsTab({ loan, loanClosed }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<GuaranteeObligation[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchGuaranteeObligations(token, loan.public_id, { perPage: 100 });
    },
    [token, loan.public_id],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    loan.public_id,
  ]);

  // Verified + active guarantors of the loan's client feed the picker.
  const [guarantors, setGuarantors] = useState<ClientGuarantor[]>([]);
  useEffect(() => {
    if (!token || !loan.client_public_id) {
      setGuarantors([]);
      return;
    }
    let cancelled = false;
    fetchGuarantors(token, loan.client_public_id, { perPage: 100 })
      .then((rows) => {
        if (cancelled) return;
        setGuarantors(
          rows.filter(
            (g) =>
              g.status === "active" && g.verification_status === "verified",
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setGuarantors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, loan.client_public_id]);

  const [drawerMode, setDrawerMode] = useState<ObligationDrawerMode | null>(
    null,
  );
  const [editing, setEditing] = useState<GuaranteeObligation | null>(null);

  function guarantorName(o: GuaranteeObligation): string {
    return (
      o.guarantor_identity_snapshot?.guarantor_full_name ??
      o.client_guarantor_public_id ??
      "—"
    );
  }

  async function handleSubmit(payload: GuaranteeObligationWritePayload) {
    if (!token) return;
    if (drawerMode === "create") {
      await createGuaranteeObligation(token, loan.public_id, payload);
      toast.success(
        t("guarantees.obligation.toast.createdTitle"),
        t("guarantees.obligation.toast.createdBody"),
      );
    } else if (drawerMode === "edit" && editing) {
      await updateGuaranteeObligation(
        token,
        loan.public_id,
        editing.public_id,
        payload,
      );
      toast.success(
        t("guarantees.obligation.toast.updatedTitle"),
        t("guarantees.obligation.toast.updatedBody"),
      );
    }
    setDrawerMode(null);
    setEditing(null);
    refetch();
  }

  const handleCancel = useCallback(
    async (o: GuaranteeObligation) => {
      if (!token) return;
      try {
        await updateGuaranteeObligation(token, loan.public_id, o.public_id, {
          status: "cancelled",
        });
        toast.success(
          t("guarantees.obligation.toast.cancelledTitle"),
          t("guarantees.obligation.toast.cancelledBody"),
        );
        refetch();
      } catch (cause) {
        const { generalMessage } = localizeApiError(cause);
        toast.error(
          t("guarantees.obligation.toast.errorTitle"),
          generalMessage,
        );
      }
    },
    [token, loan.public_id, t, toast, refetch],
  );

  const handleRelease = useCallback(
    async (o: GuaranteeObligation) => {
      if (!token) return;
      try {
        await releaseGuaranteeObligation(token, loan.public_id, o.public_id);
        toast.success(
          t("guarantees.obligation.toast.releasedTitle"),
          t("guarantees.obligation.toast.releasedBody"),
        );
        refetch();
      } catch (cause) {
        const { generalMessage } = localizeApiError(cause);
        toast.error(
          t("guarantees.obligation.toast.errorTitle"),
          generalMessage,
        );
      }
    },
    [token, loan.public_id, t, toast, refetch],
  );

  const columns = useMemo<ColumnDef<GuaranteeObligation, unknown>[]>(
    () => [
      {
        id: "guarantor",
        header: t("guarantees.obligation.columns.guarantor"),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {guarantorName(row.original)}
          </span>
        ),
      },
      {
        id: "amount",
        header: t("guarantees.obligation.columns.coverage"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const { obligation_amount_minor, obligation_percentage, currency } =
            row.original;
          if (obligation_amount_minor !== null) {
            return (
              <span className="tabular-nums text-foreground">
                {format.currencyMinor(obligation_amount_minor, {
                  currency: currency ?? "XAF",
                })}
              </span>
            );
          }
          if (obligation_percentage !== null) {
            return (
              <span className="tabular-nums text-foreground">
                {Number(obligation_percentage)}%
              </span>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "status",
        header: t("guarantees.obligation.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as GuaranteeObligationStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`guarantees.obligation.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        id: "period",
        header: t("guarantees.obligation.columns.period"),
        cell: ({ row }) => {
          const { starts_on, ends_on } = row.original;
          if (!starts_on && !ends_on)
            return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums text-muted-foreground">
              {(starts_on ?? "…").slice(0, 10)} → {(ends_on ?? "…").slice(0, 10)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("guarantees.obligation.columns.actions"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const o = row.original;
          const items: DropdownMenuItem[] = [];
          if (o.status === "active") {
            items.push({
              label: t("guarantees.obligation.actions.edit"),
              onClick: () => {
                setEditing(o);
                setDrawerMode("edit");
              },
            });
            items.push({
              label: t("guarantees.obligation.actions.cancel"),
              onClick: () => handleCancel(o),
              destructive: true,
            });
            items.push({
              label: t("guarantees.obligation.actions.release"),
              onClick: () => handleRelease(o),
              disabled: !loanClosed,
            });
          }
          if (items.length === 0) {
            return <span className="block text-right text-muted-foreground">—</span>;
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu
                trigger={<MoreVerticalIcon className="h-4 w-4" />}
                triggerLabel={t("guarantees.obligation.actions.menu")}
                items={items}
                align="right"
              />
            </div>
          );
        },
      },
    ],
    [t, format, loanClosed, handleCancel, handleRelease],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("guarantees.obligation.intro")}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setDrawerMode("create");
          }}
        >
          {t("guarantees.obligation.actions.create")}
        </Button>
      </div>

      {error ? (
        <Alert
          variant="danger"
          title={t("guarantees.obligation.errorTitle")}
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

      <DataTable<GuaranteeObligation>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("guarantees.obligation.empty")}
        getRowId={(row) => row.public_id}
        title={t("guarantees.obligation.title")}
        titleAside={t("guarantees.obligation.count", {
          count: data?.length ?? 0,
        })}
      />

      <ObligationDrawer
        open={drawerMode !== null}
        mode={drawerMode ?? "create"}
        initial={editing}
        guarantors={guarantors}
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
