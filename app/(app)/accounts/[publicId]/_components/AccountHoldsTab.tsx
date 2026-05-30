"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import {
  createAccountHold,
  deleteAccountHold,
  fetchAccountHolds,
  releaseAccountHold,
  updateAccountHold,
  type AccountHold,
  type AccountHoldStatus,
  type AccountHoldWritePayload,
} from "@/lib/api/account-holds";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  accountPublicId: string;
  currency: string | null;
};

const STATUS_TONE: Record<AccountHoldStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  released: "neutral",
  cancelled: "neutral",
  archived: "danger",
};

export function AccountHoldsTab({ accountPublicId, currency }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;
  const canManage = useHasRole(["platform-admin"]);
  const ccy = currency ?? "XAF";

  const [drawer, setDrawer] = useState<{
    mode: "create" | "edit";
    hold: AccountHold | null;
  } | null>(null);
  const [releasing, setReleasing] = useState<AccountHold | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AccountHold[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const response = await fetchAccountHolds(token, { perPage: 100 });
      // The index is global — narrow to this account client-side.
      return response.data.filter(
        (h) => h.customer_account_public_id === accountPublicId,
      );
    },
    [token, accountPublicId],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    accountPublicId,
  ]);

  async function handleSubmit(payload: AccountHoldWritePayload) {
    if (!token) return;
    if (drawer?.mode === "create") {
      await createAccountHold(token, {
        ...payload,
        customer_account_public_id: accountPublicId,
      });
      toast.success(t("accountDetail.holds.createdTitle"));
    } else if (drawer?.mode === "edit" && drawer.hold) {
      await updateAccountHold(token, drawer.hold.public_id, {
        reference: payload.reference,
      });
      toast.success(t("accountDetail.holds.updatedTitle"));
    }
    setDrawer(null);
    refetch();
  }

  async function handleRelease(reason: string) {
    if (!token || !releasing) return;
    await releaseAccountHold(token, releasing.public_id, reason || null);
    toast.success(t("accountDetail.holds.releasedTitle"));
    setReleasing(null);
    refetch();
  }

  async function handleArchive(hold: AccountHold) {
    if (!token) return;
    try {
      await deleteAccountHold(token, hold.public_id);
      toast.success(t("accountDetail.holds.archivedTitle"));
      refetch();
    } catch (cause) {
      toast.error(
        t("accountDetail.holds.errorTitle"),
        localizeApiError(cause).generalMessage,
      );
    }
  }

  const columns = useMemo<ColumnDef<AccountHold, unknown>[]>(
    () => [
      {
        accessorKey: "amount_minor",
        header: t("accountDetail.holds.columns.amount"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {format.currencyMinor(row.original.amount_minor, {
              currency: row.original.currency ?? ccy,
            })}
          </span>
        ),
      },
      {
        accessorKey: "reason_type",
        header: t("accountDetail.holds.columns.reason"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("accountDetail.holds.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as AccountHoldStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`accountDetail.holds.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "placed_at",
        header: t("accountDetail.holds.columns.placedAt"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 10) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "expires_at",
        header: t("accountDetail.holds.columns.expiresAt"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 10) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "reference",
        header: t("accountDetail.holds.columns.reference"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("accountDetail.holds.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const hold = row.original;
                const items: DropdownMenuItem[] = [];
                if (hold.status === "active") {
                  items.push({
                    label: t("accountDetail.holds.actions.edit"),
                    onClick: () => setDrawer({ mode: "edit", hold }),
                  });
                  items.push({
                    label: t("accountDetail.holds.actions.release"),
                    onClick: () => setReleasing(hold),
                  });
                }
                if (items.length > 0) items.push({ kind: "separator" });
                items.push({
                  label: t("accountDetail.holds.actions.archive"),
                  onClick: () => handleArchive(hold),
                  disabled: hold.status === "archived",
                  destructive: true,
                });
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("accountDetail.holds.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<AccountHold, unknown>,
          ]
        : []),
    ],
    // format/ccy stable for the tab lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canManage, ccy],
  );

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert
          variant="danger"
          title={t("accountDetail.holds.errorTitle")}
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

      <DataTable<AccountHold>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("accountDetail.holds.empty")}
        getRowId={(row) => row.public_id}
        title={t("accountDetail.holds.title")}
        titleAside={t("accountDetail.holds.count", { count: data?.length ?? 0 })}
      />

      {canManage ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDrawer({ mode: "create", hold: null })}
          >
            {t("accountDetail.holds.actions.create")}
          </Button>
        </div>
      ) : null}

      <HoldDrawer
        open={drawer !== null}
        mode={drawer?.mode ?? "create"}
        hold={drawer?.hold ?? null}
        currency={ccy}
        onClose={() => setDrawer(null)}
        onSubmit={handleSubmit}
      />

      <ReleaseDrawer
        hold={releasing}
        onClose={() => setReleasing(null)}
        onSubmit={handleRelease}
      />
    </div>
  );
}

/* ------------------------------- Hold drawer ------------------------------ */

type HoldFormState = {
  amount: string;
  currency: string;
  reason_type: string;
  source_type: string;
  source_public_id: string;
  expires_at: string;
  reference: string;
};

function HoldDrawer({
  open,
  mode,
  hold,
  currency,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  hold: AccountHold | null;
  currency: string;
  onClose: () => void;
  onSubmit: (payload: AccountHoldWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<HoldFormState>(emptyHoldForm(currency));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (isEdit && hold) {
      setForm({
        amount: String((hold.amount_minor ?? 0) / 100),
        currency: hold.currency ?? currency,
        reason_type: hold.reason_type ?? "",
        source_type: hold.source_type ?? "",
        source_public_id: hold.source_public_id ?? "",
        expires_at: hold.expires_at ? hold.expires_at.slice(0, 10) : "",
        reference: hold.reference ?? "",
      });
    } else {
      setForm(emptyHoldForm(currency));
    }
  }, [open, isEdit, hold, currency]);

  function set<K extends keyof HoldFormState>(key: K, value: HoldFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    // Edit only carries `reference`; create carries the full hold.
    const payload: AccountHoldWritePayload = isEdit
      ? { reference: nullable(form.reference) }
      : {
          amount_minor: toMinor(form.amount) ?? undefined,
          currency: form.currency.trim().toUpperCase(),
          reason_type: form.reason_type.trim(),
          source_type: nullable(form.source_type),
          source_public_id: nullable(form.source_public_id),
          expires_at: nullable(form.expires_at),
          reference: nullable(form.reference),
        };
    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        amount_minor: t("accountDetail.holds.fields.amount"),
        currency: t("accountDetail.holds.fields.currency"),
        reason_type: t("accountDetail.holds.fields.reason"),
        source_type: t("accountDetail.holds.fields.sourceType"),
        source_public_id: t("accountDetail.holds.fields.sourceId"),
        expires_at: t("accountDetail.holds.fields.expiresAt"),
        reference: t("accountDetail.holds.fields.reference"),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        isEdit
          ? t("accountDetail.holds.editTitle")
          : t("accountDetail.holds.createTitle")
      }
      widthClassName="sm:w-[34rem]"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="hold-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("accountDetail.holds.actions.create")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {generalError}
        </p>
      ) : null}
      <form
        id="hold-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        noValidate
      >
        <TextField
          label={t("accountDetail.holds.fields.amount")}
          type="number"
          value={form.amount}
          onChange={(event) => set("amount", event.target.value)}
          error={errors.amount_minor}
          required={!isEdit}
          disabled={isEdit}
          hint={t("accountDetail.holds.fields.amountHint")}
        />
        <TextField
          label={t("accountDetail.holds.fields.currency")}
          value={form.currency}
          onChange={(event) => set("currency", event.target.value)}
          error={errors.currency}
          disabled={isEdit}
        />
        <TextField
          label={t("accountDetail.holds.fields.reason")}
          value={form.reason_type}
          onChange={(event) => set("reason_type", event.target.value)}
          error={errors.reason_type}
          required={!isEdit}
          disabled={isEdit}
          hint={t("accountDetail.holds.fields.reasonHint")}
          className="sm:col-span-2"
        />
        <TextField
          label={t("accountDetail.holds.fields.sourceType")}
          value={form.source_type}
          onChange={(event) => set("source_type", event.target.value)}
          error={errors.source_type}
          disabled={isEdit}
        />
        <TextField
          label={t("accountDetail.holds.fields.sourceId")}
          value={form.source_public_id}
          onChange={(event) => set("source_public_id", event.target.value)}
          error={errors.source_public_id}
          disabled={isEdit}
        />
        <TextField
          label={t("accountDetail.holds.fields.expiresAt")}
          type="date"
          value={form.expires_at}
          onChange={(event) => set("expires_at", event.target.value)}
          error={errors.expires_at}
          disabled={isEdit}
        />
        <TextField
          label={t("accountDetail.holds.fields.reference")}
          value={form.reference}
          onChange={(event) => set("reference", event.target.value)}
          error={errors.reference}
        />
      </form>
    </Drawer>
  );
}

/* ----------------------------- Release drawer ----------------------------- */

function ReleaseDrawer({
  hold,
  onClose,
  onSubmit,
}: {
  hold: AccountHold | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hold) {
      setReason("");
      setError(null);
    }
  }, [hold]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (cause) {
      setError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={hold !== null}
      onClose={submitting ? () => undefined : onClose}
      title={t("accountDetail.holds.releaseTitle")}
      widthClassName="sm:w-[28rem]"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="hold-release-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("accountDetail.holds.actions.release")}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <form id="hold-release-form" onSubmit={handleSubmit} noValidate>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("accountDetail.holds.releaseIntro")}
        </p>
        <TextField
          label={t("accountDetail.holds.fields.releaseReason")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint={t("accountDetail.holds.fields.releaseReasonHint")}
        />
      </form>
    </Drawer>
  );
}

function emptyHoldForm(currency: string): HoldFormState {
  return {
    amount: "",
    currency,
    reason_type: "",
    source_type: "",
    source_public_id: "",
    expires_at: "",
    reference: "",
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toMinor(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}
