"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import type {
  CollateralItem,
  CollateralItemWritePayload,
  CollateralType,
} from "@/lib/api/collaterals";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type ItemDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: ItemDrawerMode;
  /** Parent collateral type — drives which type-specific fields show. */
  collateralType: CollateralType;
  initial?: CollateralItem | null;
  defaultCurrency: string | null;
  onClose: () => void;
  onSubmit: (payload: CollateralItemWritePayload) => Promise<void>;
};

type FormState = {
  description: string;
  quantity: string;
  reference: string;
  amount: string;
  currency: string;
  // movable
  chassis_number: string;
  registration_number: string;
  meta_brand: string;
  meta_model: string;
  // real_estate
  meta_title_deed: string;
  meta_lot: string;
  meta_location: string;
};

export function CollateralItemDrawer({
  open,
  mode,
  collateralType,
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
  const isMovable = collateralType === "movable";
  const isRealEstate = collateralType === "real_estate";

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (isEdit && initial) {
      const meta = initial.metadata ?? {};
      setForm({
        description: initial.description ?? "",
        quantity: fromNumber(initial.quantity),
        reference: initial.reference ?? "",
        amount: fromMinor(initial.amount_minor),
        currency: initial.currency ?? defaultCurrency ?? "XAF",
        chassis_number: initial.chassis_number ?? "",
        registration_number: initial.registration_number ?? "",
        meta_brand: metaString(meta, "brand"),
        meta_model: metaString(meta, "model"),
        meta_title_deed: metaString(meta, "title_deed_number"),
        meta_lot: metaString(meta, "lot_number"),
        meta_location: metaString(meta, "location"),
      });
    } else {
      setForm(emptyForm(defaultCurrency));
    }
  }, [open, isEdit, initial, defaultCurrency]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const metadata: Record<string, unknown> = {};
    if (isMovable) {
      if (form.meta_brand.trim()) metadata.brand = form.meta_brand.trim();
      if (form.meta_model.trim()) metadata.model = form.meta_model.trim();
    }
    if (isRealEstate) {
      if (form.meta_title_deed.trim())
        metadata.title_deed_number = form.meta_title_deed.trim();
      if (form.meta_lot.trim()) metadata.lot_number = form.meta_lot.trim();
      if (form.meta_location.trim())
        metadata.location = form.meta_location.trim();
    }

    const payload: CollateralItemWritePayload = {
      description: form.description.trim(),
      quantity: toInt(form.quantity),
      reference: nullable(form.reference),
      amount_minor: toMinor(form.amount),
      currency: nullable(form.currency)?.toUpperCase() ?? undefined,
      chassis_number: isMovable ? nullable(form.chassis_number) : undefined,
      registration_number: isMovable
        ? nullable(form.registration_number)
        : undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        description: t("guarantees.item.fields.description"),
        quantity: t("guarantees.item.fields.quantity"),
        reference: t("guarantees.item.fields.reference"),
        amount_minor: t("guarantees.item.fields.amount"),
        currency: t("guarantees.item.fields.currency"),
        chassis_number: t("guarantees.item.fields.chassis"),
        registration_number: t("guarantees.item.fields.registration"),
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
          ? t("guarantees.item.drawer.titleEdit")
          : t("guarantees.item.drawer.titleCreate")
      }
      description={t(`guarantees.item.drawer.hint.${collateralType}`)}
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
            form="collateral-item-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("guarantees.item.drawer.create")}
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
        id="collateral-item-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label={t("guarantees.item.fields.description")}
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          error={errors.description}
          required
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("guarantees.item.fields.quantity")}
            type="number"
            value={form.quantity}
            onChange={(event) => set("quantity", event.target.value)}
            error={errors.quantity}
          />
          <TextField
            label={t("guarantees.item.fields.reference")}
            value={form.reference}
            onChange={(event) => set("reference", event.target.value)}
            error={errors.reference}
          />
          <TextField
            label={t("guarantees.item.fields.amount")}
            type="number"
            value={form.amount}
            onChange={(event) => set("amount", event.target.value)}
            error={errors.amount_minor}
            hint={t("guarantees.item.fields.amountHint")}
          />
          <TextField
            label={t("guarantees.item.fields.currency")}
            value={form.currency}
            onChange={(event) => set("currency", event.target.value)}
            error={errors.currency}
          />
        </div>

        {/* Type-adaptive fields */}
        {isMovable ? (
          <fieldset className="flex flex-col gap-4 rounded-[var(--radius-field)] border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("guarantees.item.groups.movable")}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t("guarantees.item.fields.chassis")}
                value={form.chassis_number}
                onChange={(event) => set("chassis_number", event.target.value)}
                error={errors.chassis_number}
              />
              <TextField
                label={t("guarantees.item.fields.registration")}
                value={form.registration_number}
                onChange={(event) =>
                  set("registration_number", event.target.value)
                }
                error={errors.registration_number}
              />
              <TextField
                label={t("guarantees.item.fields.brand")}
                value={form.meta_brand}
                onChange={(event) => set("meta_brand", event.target.value)}
              />
              <TextField
                label={t("guarantees.item.fields.model")}
                value={form.meta_model}
                onChange={(event) => set("meta_model", event.target.value)}
              />
            </div>
          </fieldset>
        ) : null}

        {isRealEstate ? (
          <fieldset className="flex flex-col gap-4 rounded-[var(--radius-field)] border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("guarantees.item.groups.realEstate")}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t("guarantees.item.fields.titleDeed")}
                value={form.meta_title_deed}
                onChange={(event) => set("meta_title_deed", event.target.value)}
              />
              <TextField
                label={t("guarantees.item.fields.lot")}
                value={form.meta_lot}
                onChange={(event) => set("meta_lot", event.target.value)}
              />
              <TextField
                label={t("guarantees.item.fields.location")}
                value={form.meta_location}
                onChange={(event) => set("meta_location", event.target.value)}
                className="sm:col-span-2"
              />
            </div>
          </fieldset>
        ) : null}
      </form>
    </Drawer>
  );
}

function emptyForm(defaultCurrency: string | null): FormState {
  return {
    description: "",
    quantity: "",
    reference: "",
    amount: "",
    currency: defaultCurrency ?? "XAF",
    chassis_number: "",
    registration_number: "",
    meta_brand: "",
    meta_model: "",
    meta_title_deed: "",
    meta_lot: "",
    meta_location: "",
  };
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === "string" ? value : "";
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
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

function fromNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
