"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import type {
  DelinquencyTracking,
  DelinquencyTrackingWritePayload,
} from "@/lib/api/delinquency-trackings";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type TrackingDrawerMode = "create" | "edit";

/** Curated reason / appointment slugs (API stores a free string max 64). */
export const REASON_CODE_SLUGS = [
  "forgot_due_date",
  "cash_flow_issue",
  "business_downturn",
  "illness",
  "travel",
  "dispute",
  "refusal_to_pay",
  "unreachable",
  "diverted_funds",
  "other",
] as const;

export const APPOINTMENT_TYPE_SLUGS = [
  "phone_call",
  "field_visit",
  "office_meeting",
  "sms",
  "letter",
  "third_party",
] as const;

type Props = {
  open: boolean;
  mode: TrackingDrawerMode;
  initial?: DelinquencyTracking | null;
  defaultCurrency: string | null;
  onClose: () => void;
  onSubmit: (payload: DelinquencyTrackingWritePayload) => Promise<void>;
};

type FormState = {
  tracking_date: string;
  reason_code: string;
  appointment_type: string;
  appointment_date: string;
  promised_amount: string;
  currency: string;
  comments: string;
};

function emptyForm(defaultCurrency: string | null): FormState {
  return {
    tracking_date: "",
    reason_code: "",
    appointment_type: "",
    appointment_date: "",
    promised_amount: "",
    currency: defaultCurrency ?? "XAF",
    comments: "",
  };
}

export function TrackingDrawer({
  open,
  mode,
  initial,
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
        tracking_date: initial.tracking_date?.slice(0, 10) ?? "",
        reason_code: initial.reason_code ?? "",
        appointment_type: initial.appointment_type ?? "",
        appointment_date: initial.appointment_date?.slice(0, 10) ?? "",
        promised_amount: fromMinor(initial.promised_amount_minor),
        currency: initial.currency ?? defaultCurrency ?? "XAF",
        comments: initial.comments ?? "",
      });
    } else {
      setForm(emptyForm(defaultCurrency));
    }
  }, [open, isEdit, initial, defaultCurrency]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Preserve a legacy free-text value that isn't in our catalog (edit case).
  function optionsFor(
    slugs: ReadonlyArray<string>,
    i18nPrefix: string,
    current: string,
  ) {
    const options = slugs.map((slug) => ({
      value: slug,
      label: t(`${i18nPrefix}.${slug}`),
    }));
    if (current && !slugs.includes(current)) {
      options.push({ value: current, label: current });
    }
    return options;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: DelinquencyTrackingWritePayload = {
      tracking_date: nullable(form.tracking_date),
      reason_code: nullable(form.reason_code),
      appointment_type: nullable(form.appointment_type),
      appointment_date: nullable(form.appointment_date),
      promised_amount_minor: toMinor(form.promised_amount),
      currency: nullable(form.currency)?.toUpperCase() ?? undefined,
      comments: nullable(form.comments),
    };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        tracking_date: t("delinquencies.tracking.fields.date"),
        reason_code: t("delinquencies.tracking.fields.reason"),
        appointment_type: t("delinquencies.tracking.fields.appointmentType"),
        appointment_date: t("delinquencies.tracking.fields.appointmentDate"),
        promised_amount_minor: t("delinquencies.tracking.fields.promisedAmount"),
        currency: t("delinquencies.tracking.fields.currency"),
        comments: t("delinquencies.tracking.fields.comments"),
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
          ? t("delinquencies.tracking.drawer.titleEdit")
          : t("delinquencies.tracking.drawer.titleCreate")
      }
      description={t("delinquencies.tracking.drawer.hint")}
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
            form="tracking-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("delinquencies.tracking.drawer.create")}
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
        id="tracking-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label={t("delinquencies.tracking.fields.date")}
          type="date"
          value={form.tracking_date}
          onChange={(event) => set("tracking_date", event.target.value)}
          error={errors.tracking_date}
          required={!isEdit}
          hint={t("delinquencies.tracking.fields.dateHint")}
        />
        <Select
          label={t("delinquencies.tracking.fields.reason")}
          value={form.reason_code}
          options={optionsFor(
            REASON_CODE_SLUGS,
            "delinquencies.tracking.reason",
            form.reason_code,
          )}
          placeholder={t("delinquencies.tracking.fields.reasonPlaceholder")}
          isClearable
          onChange={(next) => set("reason_code", next)}
          error={errors.reason_code}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={t("delinquencies.tracking.fields.appointmentType")}
            value={form.appointment_type}
            options={optionsFor(
              APPOINTMENT_TYPE_SLUGS,
              "delinquencies.tracking.appointment",
              form.appointment_type,
            )}
            placeholder={t(
              "delinquencies.tracking.fields.appointmentTypePlaceholder",
            )}
            isClearable
            onChange={(next) => set("appointment_type", next)}
            error={errors.appointment_type}
          />
          <TextField
            label={t("delinquencies.tracking.fields.appointmentDate")}
            type="date"
            value={form.appointment_date}
            onChange={(event) => set("appointment_date", event.target.value)}
            error={errors.appointment_date}
          />
          <TextField
            label={t("delinquencies.tracking.fields.promisedAmount")}
            type="number"
            value={form.promised_amount}
            onChange={(event) => set("promised_amount", event.target.value)}
            error={errors.promised_amount_minor}
            hint={t("delinquencies.tracking.fields.amountHint")}
          />
          <TextField
            label={t("delinquencies.tracking.fields.currency")}
            value={form.currency}
            onChange={(event) => set("currency", event.target.value)}
            error={errors.currency}
          />
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("delinquencies.tracking.fields.comments")}
          </span>
          <textarea
            value={form.comments}
            onChange={(event) => set("comments", event.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </label>
      </form>
    </Drawer>
  );
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

function fromMinor(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return String(minor / 100);
}
