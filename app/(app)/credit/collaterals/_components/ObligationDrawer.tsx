"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import type { ClientGuarantor } from "@/lib/api/client-guarantors";
import type {
  GuaranteeObligation,
  GuaranteeObligationWritePayload,
} from "@/lib/api/guarantee-obligations";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type ObligationDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: ObligationDrawerMode;
  initial?: GuaranteeObligation | null;
  /** Verified + active guarantors of the loan's client. */
  guarantors: ReadonlyArray<ClientGuarantor>;
  defaultCurrency: string | null;
  onClose: () => void;
  onSubmit: (payload: GuaranteeObligationWritePayload) => Promise<void>;
};

type FormState = {
  client_guarantor_public_id: string;
  obligation_amount: string;
  obligation_percentage: string;
  currency: string;
  starts_on: string;
  ends_on: string;
  release_condition: string;
};

export function ObligationDrawer({
  open,
  mode,
  initial,
  guarantors,
  defaultCurrency,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [form, setForm] = useState<FormState>(emptyForm(defaultCurrency));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (isEdit && initial) {
      setForm({
        client_guarantor_public_id: initial.client_guarantor_public_id ?? "",
        obligation_amount: fromMinor(initial.obligation_amount_minor),
        obligation_percentage: initial.obligation_percentage
          ? String(Number(initial.obligation_percentage))
          : "",
        currency: initial.currency ?? defaultCurrency ?? "XAF",
        starts_on: initial.starts_on ?? "",
        ends_on: initial.ends_on ?? "",
        release_condition: initial.release_condition ?? "loan_closed",
      });
    } else {
      setForm(emptyForm(defaultCurrency));
    }
  }, [open, isEdit, initial, defaultCurrency]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const guarantorOptions = useMemo(
    () =>
      guarantors.map((g) => ({
        value: g.public_id,
        label: `${g.guarantor_full_name ?? g.public_id}${
          g.guarantor_phone_number ? ` — ${g.guarantor_phone_number}` : ""
        }`,
      })),
    [guarantors],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const common: GuaranteeObligationWritePayload = {
      obligation_amount_minor: toMinor(form.obligation_amount),
      obligation_percentage: toNum(form.obligation_percentage),
      currency: nullable(form.currency)?.toUpperCase() ?? undefined,
      starts_on: nullable(form.starts_on),
      ends_on: nullable(form.ends_on),
      release_condition: nullable(form.release_condition),
    };

    const payload: GuaranteeObligationWritePayload = isEdit
      ? { ...common, client_guarantor_public_id: form.client_guarantor_public_id || undefined }
      : {
          ...common,
          client_guarantor_public_id: form.client_guarantor_public_id || undefined,
          obligation_type: "personal_guarantee",
        };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        client_guarantor_public_id: t("guarantees.obligation.fields.guarantor"),
        obligation_amount_minor: t("guarantees.obligation.fields.amount"),
        obligation_percentage: t("guarantees.obligation.fields.percentage"),
        currency: t("guarantees.obligation.fields.currency"),
        starts_on: t("guarantees.obligation.fields.startsOn"),
        ends_on: t("guarantees.obligation.fields.endsOn"),
        release_condition: t("guarantees.obligation.fields.releaseCondition"),
      };
      const { generalMessage, fieldErrors } = localizeApiError(
        cause,
        fieldLabels,
      );
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
          ? t("guarantees.obligation.drawer.titleEdit")
          : t("guarantees.obligation.drawer.titleCreate")
      }
      description={t("guarantees.obligation.drawer.hint")}
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
            form="obligation-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("guarantees.obligation.drawer.create")}
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
        id="obligation-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Select
          label={t("guarantees.obligation.fields.guarantor")}
          value={form.client_guarantor_public_id}
          options={guarantorOptions}
          placeholder={t("guarantees.obligation.fields.guarantorPlaceholder")}
          onChange={(next) => set("client_guarantor_public_id", next)}
          error={errors.client_guarantor_public_id}
          required
          hint={
            guarantorOptions.length === 0
              ? t("guarantees.obligation.fields.noGuarantors")
              : undefined
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("guarantees.obligation.fields.amount")}
            type="number"
            value={form.obligation_amount}
            onChange={(event) => set("obligation_amount", event.target.value)}
            error={errors.obligation_amount_minor}
            hint={t("guarantees.obligation.fields.amountHint")}
          />
          <TextField
            label={t("guarantees.obligation.fields.percentage")}
            type="number"
            value={form.obligation_percentage}
            onChange={(event) =>
              set("obligation_percentage", event.target.value)
            }
            error={errors.obligation_percentage}
            hint={t("guarantees.obligation.fields.percentageHint")}
          />
          <TextField
            label={t("guarantees.obligation.fields.currency")}
            value={form.currency}
            onChange={(event) => set("currency", event.target.value)}
            error={errors.currency}
            hint={t("guarantees.obligation.fields.currencyHint")}
          />
          <Select
            label={t("guarantees.obligation.fields.releaseCondition")}
            value={form.release_condition}
            options={[
              {
                value: "loan_closed",
                label: t(
                  "guarantees.obligation.fields.releaseConditionOptions.loanClosed",
                ),
              },
            ]}
            onChange={(next) => set("release_condition", next)}
            error={errors.release_condition}
            hint={t("guarantees.obligation.fields.releaseConditionHint")}
          />
          <TextField
            label={t("guarantees.obligation.fields.startsOn")}
            type="date"
            value={form.starts_on}
            onChange={(event) => set("starts_on", event.target.value)}
            error={errors.starts_on}
          />
          <TextField
            label={t("guarantees.obligation.fields.endsOn")}
            type="date"
            value={form.ends_on}
            onChange={(event) => set("ends_on", event.target.value)}
            error={errors.ends_on}
          />
        </div>
      </form>
    </Drawer>
  );
}

function emptyForm(defaultCurrency: string | null): FormState {
  return {
    client_guarantor_public_id: "",
    obligation_amount: "",
    obligation_percentage: "",
    currency: defaultCurrency ?? "XAF",
    starts_on: "",
    ends_on: "",
    release_condition: "loan_closed",
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMinor(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function fromMinor(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return String(minor / 100);
}
