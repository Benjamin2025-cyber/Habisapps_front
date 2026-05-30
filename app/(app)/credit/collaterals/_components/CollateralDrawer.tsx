"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import type {
  Collateral,
  CollateralType,
  CollateralWritePayload,
} from "@/lib/api/collaterals";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type CollateralDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: CollateralDrawerMode;
  initial?: Collateral | null;
  defaultCurrency: string | null;
  onClose: () => void;
  onSubmit: (payload: CollateralWritePayload) => Promise<void>;
};

type FormState = {
  collateral_type: CollateralType | "";
  description: string;
  owner_full_name: string;
  valuation_date: string;
  declared_value: string;
  currency: string;
};

export function CollateralDrawer({
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
        collateral_type: initial.collateral_type,
        description: initial.description ?? "",
        owner_full_name: initial.owner_full_name ?? "",
        valuation_date: initial.valuation_date ?? "",
        declared_value: fromMinor(initial.declared_value_minor),
        currency: initial.currency ?? defaultCurrency ?? "XAF",
      });
    } else {
      setForm(emptyForm(defaultCurrency));
    }
  }, [open, isEdit, initial, defaultCurrency]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const typeOptions: Array<{ value: CollateralType; label: string }> = [
    { value: "real_estate", label: t("guarantees.collateralType.real_estate") },
    { value: "movable", label: t("guarantees.collateralType.movable") },
    {
      value: "personal_guarantee",
      label: t("guarantees.collateralType.personal_guarantee"),
    },
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: CollateralWritePayload = {
      collateral_type: form.collateral_type || undefined,
      description: nullable(form.description),
      owner_full_name: nullable(form.owner_full_name),
      valuation_date: nullable(form.valuation_date),
      declared_value_minor: toMinor(form.declared_value),
      currency: nullable(form.currency)?.toUpperCase() ?? undefined,
    };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        collateral_type: t("guarantees.collateral.fields.type"),
        description: t("guarantees.collateral.fields.description"),
        owner_full_name: t("guarantees.collateral.fields.owner"),
        valuation_date: t("guarantees.collateral.fields.valuationDate"),
        declared_value_minor: t("guarantees.collateral.fields.declaredValue"),
        currency: t("guarantees.collateral.fields.currency"),
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
          ? t("guarantees.collateral.drawer.titleEdit")
          : t("guarantees.collateral.drawer.titleCreate")
      }
      description={t("guarantees.collateral.drawer.hint")}
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
            form="collateral-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("guarantees.collateral.drawer.create")}
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
        id="collateral-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Select
          label={t("guarantees.collateral.fields.type")}
          value={form.collateral_type}
          options={typeOptions}
          placeholder={t("guarantees.collateral.fields.typePlaceholder")}
          onChange={(next) => set("collateral_type", next as CollateralType | "")}
          error={errors.collateral_type}
          required
        />
        <TextField
          label={t("guarantees.collateral.fields.description")}
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          error={errors.description}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("guarantees.collateral.fields.owner")}
            value={form.owner_full_name}
            onChange={(event) => set("owner_full_name", event.target.value)}
            error={errors.owner_full_name}
          />
          <TextField
            label={t("guarantees.collateral.fields.valuationDate")}
            type="date"
            value={form.valuation_date}
            onChange={(event) => set("valuation_date", event.target.value)}
            error={errors.valuation_date}
          />
          <TextField
            label={t("guarantees.collateral.fields.declaredValue")}
            type="number"
            value={form.declared_value}
            onChange={(event) => set("declared_value", event.target.value)}
            error={errors.declared_value_minor}
            hint={t("guarantees.collateral.fields.amountHint")}
          />
          <TextField
            label={t("guarantees.collateral.fields.currency")}
            value={form.currency}
            onChange={(event) => set("currency", event.target.value)}
            error={errors.currency}
            hint={t("guarantees.collateral.fields.currencyHint")}
          />
        </div>
      </form>
    </Drawer>
  );
}

function emptyForm(defaultCurrency: string | null): FormState {
  return {
    collateral_type: "",
    description: "",
    owner_full_name: "",
    valuation_date: "",
    declared_value: "",
    currency: defaultCurrency ?? "XAF",
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

function fromMinor(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return String(minor / 100);
}
