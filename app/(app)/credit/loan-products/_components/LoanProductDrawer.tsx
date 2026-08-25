"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  LoanProduct,
  LoanProductWritePayload,
  RepaymentFrequency,
  TermUnit,
} from "@/lib/api/loan-products";

export type LoanProductDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: LoanProductDrawerMode;
  initial?: LoanProduct | null;
  onClose: () => void;
  onSubmit: (payload: LoanProductWritePayload) => Promise<void>;
};

type FormState = {
  // Identité
  code: string;
  name: string;
  requires_guarantor: boolean;
  requires_collateral: boolean;
  // Limites
  min_term_count: string;
  max_term_count: string;
  term_unit: TermUnit | "";
  freq_daily: boolean;
  freq_weekly: boolean;
  freq_monthly: boolean;
  freq_custom: boolean;
  min_amount: string;
  max_amount: string;
  due_date_day: string;
  min_grace_period_days: string;
  max_grace_period_days: string;
  // Frais
  interest_rate: string;
  tax_rate: string;
  insurance_rate: string;
  fee_rate: string;
  dossier_fee_tax_rate: string;
  guarantee_deposit_value: string;
  // Pénalité — seul le délai de grâce est paramétrable, la formule est
  // universelle (5 000 FCFA + 2 % de l'impayé).
  penalty_grace_days: string;
  // Statut
  status: "active" | "inactive" | "";
};

const EMPTY: FormState = {
  code: "",
  name: "",
  requires_guarantor: false,
  requires_collateral: false,
  min_term_count: "",
  max_term_count: "",
  term_unit: "",
  freq_daily: false,
  freq_weekly: false,
  freq_monthly: false,
  freq_custom: false,
  min_amount: "",
  max_amount: "",
  due_date_day: "",
  min_grace_period_days: "",
  max_grace_period_days: "",
  interest_rate: "",
  tax_rate: "",
  insurance_rate: "",
  fee_rate: "",
  dossier_fee_tax_rate: "19.25",
  guarantee_deposit_value: "",
  penalty_grace_days: "",
  status: "",
};

export function LoanProductDrawer({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (isEdit && initial) {
      const freqs = initial.allowed_repayment_frequencies ?? [];
      setForm({
        code: initial.code ?? "",
        name: initial.name ?? "",
        requires_guarantor: initial.requires_guarantor ?? false,
        requires_collateral: initial.requires_collateral ?? false,
        min_term_count: fromNumber(initial.min_term_count),
        max_term_count: fromNumber(initial.max_term_count),
        term_unit: initial.term_unit ?? "",
        freq_daily: freqs.includes("daily"),
        freq_weekly: freqs.includes("weekly"),
        freq_monthly: freqs.includes("monthly"),
        freq_custom: freqs.includes("custom"),
        min_amount: fromMinor(initial.min_amount_minor),
        max_amount: fromMinor(initial.max_amount_minor),
        due_date_day: fromNumber(initial.due_date_day),
        min_grace_period_days: fromNumber(initial.min_grace_period_days),
        max_grace_period_days: fromNumber(initial.max_grace_period_days),
        interest_rate: initial.interest_rate ?? "",
        tax_rate: initial.tax_rate ?? "",
        insurance_rate: initial.insurance_rate ?? "",
        fee_rate: initial.fee_rate ?? "",
        dossier_fee_tax_rate: initial.dossier_fee_tax_rate ?? "19.25",
        guarantee_deposit_value: initial.guarantee_deposit_value ?? "",
        penalty_grace_days: fromNumber(initial.penalty_grace_days),
        status: initial.status === "archived" ? "" : initial.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, isEdit, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const termUnitOptions: Array<{ value: TermUnit; label: string }> = [
    { value: "day", label: t("loanProducts.termUnit.day") },
    { value: "week", label: t("loanProducts.termUnit.week") },
    { value: "month", label: t("loanProducts.termUnit.month") },
  ];

  const statusOptions: Array<{ value: "active" | "inactive"; label: string }> = [
    { value: "active", label: t("loanProducts.status.active") },
    { value: "inactive", label: t("loanProducts.status.inactive") },
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const frequencies: RepaymentFrequency[] = [];
    if (form.freq_daily) frequencies.push("daily");
    if (form.freq_weekly) frequencies.push("weekly");
    if (form.freq_monthly) frequencies.push("monthly");
    if (form.freq_custom) frequencies.push("custom");

    const common: LoanProductWritePayload = {
      name: form.name.trim(),
      requires_guarantor: form.requires_guarantor,
      requires_collateral: form.requires_collateral,
      min_term_count: toInt(form.min_term_count),
      max_term_count: toInt(form.max_term_count),
      term_unit: form.term_unit || null,
      allowed_repayment_frequencies:
        frequencies.length > 0 ? frequencies : null,
      min_amount_minor: toMinor(form.min_amount),
      max_amount_minor: toMinor(form.max_amount),
      due_date_day: toInt(form.due_date_day),
      min_grace_period_days: toInt(form.min_grace_period_days),
      max_grace_period_days: toInt(form.max_grace_period_days),
      interest_rate: toNum(form.interest_rate),
      tax_rate: toNum(form.tax_rate),
      insurance_rate: toNum(form.insurance_rate),
      fee_rate: toNum(form.fee_rate),
      dossier_fee_tax_rate: toNum(form.dossier_fee_tax_rate),
      guarantee_deposit_value: toNum(form.guarantee_deposit_value),
      penalty_grace_days: toInt(form.penalty_grace_days),
      status: form.status || undefined,
    };

    // `code` is create-only — we disable it on edit.
    const payload: LoanProductWritePayload = isEdit
      ? common
      : { ...common, code: form.code.trim() };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        code: t("loanProducts.fields.code"),
        name: t("loanProducts.fields.name"),
        min_term_count: t("loanProducts.fields.minTerm"),
        max_term_count: t("loanProducts.fields.maxTerm"),
        term_unit: t("loanProducts.fields.termUnit"),
        min_amount_minor: t("loanProducts.fields.minAmount"),
        max_amount_minor: t("loanProducts.fields.maxAmount"),
        due_date_day: t("loanProducts.fields.dueDateDay"),
        interest_rate: t("loanProducts.fields.interestRate"),
        tax_rate: t("loanProducts.fields.taxRate"),
        insurance_rate: t("loanProducts.fields.insuranceRate"),
        fee_rate: t("loanProducts.fields.feeRate"),
        dossier_fee_tax_rate: t("loanProducts.fields.dossierFeeTaxRate"),
        guarantee_deposit_value: t("loanProducts.fields.depositValue"),
        status: t("loanProducts.fields.status"),
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
          ? t("loanProducts.drawer.titleEdit", {
              name: initial?.name ?? initial?.code ?? "",
            })
          : t("loanProducts.drawer.titleCreate")
      }
      description={
        isEdit
          ? t("loanProducts.drawer.editHint")
          : t("loanProducts.drawer.createHint")
      }
      widthClassName="sm:w-[44rem]"
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
            form="loan-product-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("loanProducts.drawer.create")}
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
        id="loan-product-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        {/* Identité */}
        <Section title={t("loanProducts.drawer.sectionIdentity")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("loanProducts.fields.code")}
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              error={errors.code}
              disabled={isEdit}
              required={!isEdit}
              hint={isEdit ? t("loanProducts.fields.codeEditHint") : undefined}
            />
            <TextField
              label={t("loanProducts.fields.name")}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              error={errors.name}
              required
            />
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <CheckboxField
              label={t("loanProducts.fields.requiresGuarantor")}
              checked={form.requires_guarantor}
              onChange={(checked) => set("requires_guarantor", checked)}
            />
            <CheckboxField
              label={t("loanProducts.fields.requiresCollateral")}
              checked={form.requires_collateral}
              onChange={(checked) => set("requires_collateral", checked)}
            />
          </div>
        </Section>

        {/* Limites */}
        <Section title={t("loanProducts.drawer.sectionLimits")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label={t("loanProducts.fields.minTerm")}
              type="number"
              value={form.min_term_count}
              onChange={(event) => set("min_term_count", event.target.value)}
              error={errors.min_term_count}
            />
            <TextField
              label={t("loanProducts.fields.maxTerm")}
              type="number"
              value={form.max_term_count}
              onChange={(event) => set("max_term_count", event.target.value)}
              error={errors.max_term_count}
            />
            <Select
              label={t("loanProducts.fields.termUnit")}
              value={form.term_unit}
              options={termUnitOptions}
              placeholder={t("loanProducts.fields.termUnitPlaceholder")}
              isClearable
              onChange={(next) => set("term_unit", next as TermUnit | "")}
              error={errors.term_unit}
            />
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("loanProducts.fields.repaymentFrequencies")}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CheckboxField
                label={t("loanProducts.frequency.daily")}
                checked={form.freq_daily}
                onChange={(checked) => set("freq_daily", checked)}
              />
              <CheckboxField
                label={t("loanProducts.frequency.weekly")}
                checked={form.freq_weekly}
                onChange={(checked) => set("freq_weekly", checked)}
              />
              <CheckboxField
                label={t("loanProducts.frequency.monthly")}
                checked={form.freq_monthly}
                onChange={(checked) => set("freq_monthly", checked)}
              />
              <CheckboxField
                label={t("loanProducts.frequency.custom")}
                checked={form.freq_custom}
                onChange={(checked) => set("freq_custom", checked)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              label={t("loanProducts.fields.minAmount")}
              value={form.min_amount}
              onChange={(event) => set("min_amount", event.target.value)}
              error={errors.min_amount_minor}
              hint={t("loanProducts.fields.amountHint")}
            />
            <MoneyField
              label={t("loanProducts.fields.maxAmount")}
              value={form.max_amount}
              onChange={(event) => set("max_amount", event.target.value)}
              error={errors.max_amount_minor}
              hint={t("loanProducts.fields.amountHint")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label={t("loanProducts.fields.dueDateDay")}
              type="number"
              value={form.due_date_day}
              onChange={(event) => set("due_date_day", event.target.value)}
              error={errors.due_date_day}
              hint={t("loanProducts.fields.dueDateDayHint")}
            />
            <TextField
              label={t("loanProducts.fields.minGrace")}
              type="number"
              value={form.min_grace_period_days}
              onChange={(event) =>
                set("min_grace_period_days", event.target.value)
              }
              error={errors.min_grace_period_days}
            />
            <TextField
              label={t("loanProducts.fields.maxGrace")}
              type="number"
              value={form.max_grace_period_days}
              onChange={(event) =>
                set("max_grace_period_days", event.target.value)
              }
              error={errors.max_grace_period_days}
            />
          </div>
        </Section>

        {/* Frais */}
        <Section title={t("loanProducts.drawer.sectionFees")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label={t("loanProducts.fields.interestRate")}
              type="number"
              value={form.interest_rate}
              onChange={(event) => set("interest_rate", event.target.value)}
              error={errors.interest_rate}
              hint={t("loanProducts.fields.rateHint")}
            />
            <TextField
              label={t("loanProducts.fields.taxRate")}
              type="number"
              value={form.tax_rate}
              onChange={(event) => set("tax_rate", event.target.value)}
              error={errors.tax_rate}
              hint={t("loanProducts.fields.rateHint")}
            />
            <TextField
              label={t("loanProducts.fields.insuranceRate")}
              type="number"
              value={form.insurance_rate}
              onChange={(event) => set("insurance_rate", event.target.value)}
              error={errors.insurance_rate}
              hint={t("loanProducts.fields.rateHint")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Percentage of the principal, and nothing else: no fixed amount and
                no floor. « Le montant des frais de dossier doit être en pourcentage
                et sans plancher. » */}
            <TextField
              label={t("loanProducts.fields.feeRate")}
              value={form.fee_rate}
              inputMode="decimal"
              onChange={(event) => set("fee_rate", event.target.value)}
              error={errors.fee_rate}
              hint={t("loanProducts.fields.rateHint")}
            />
            <TextField
              label={t("loanProducts.fields.dossierFeeTaxRate")}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.dossier_fee_tax_rate}
              onChange={(event) =>
                set("dossier_fee_tax_rate", event.target.value)
              }
              error={errors.dossier_fee_tax_rate}
              hint={t("loanProducts.fields.rateHint")}
            />
            <TextField
              label={t("loanProducts.fields.depositValue")}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.guarantee_deposit_value}
              onChange={(event) =>
                set("guarantee_deposit_value", event.target.value)
              }
              error={errors.guarantee_deposit_value}
              hint={t("loanProducts.fields.depositValueHint")}
            />
          </div>
        </Section>

        {/* Pénalité */}
        <Section title={t("loanProducts.drawer.sectionPenalty")}>
          <TextField
            label={t("loanProducts.fields.penaltyGraceDays")}
            type="number"
            value={form.penalty_grace_days}
            onChange={(event) => set("penalty_grace_days", event.target.value)}
            error={errors.penalty_grace_days}
            hint={t("loanProducts.fields.penaltyGraceDaysHint")}
          />

          {/* The penalty formula is not a product choice: the accounting team
              set one hybrid rule for every credit. Only the grace period above
              varies, so this states the rule instead of offering a selector. */}
          <p className="rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("loanProducts.fields.penaltyHint")}
          </p>
        </Section>

        {/* Comptabilité — nothing to pick. « Il n'y a pas de compte comptable
            par défaut car chaque ligne de crédit entraîne automatiquement la
            création de plusieurs comptes lors de la mise en place. » */}
        <Section title={t("loanProducts.drawer.sectionAccounting")}>
          <p className="rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("loanProducts.fields.accountsAutomaticHint")}
          </p>
          <p className="rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("loanProducts.fields.policiesAutomaticHint")}
          </p>
        </Section>

        {/* Statut */}
        <Section title={t("loanProducts.drawer.sectionStatus")}>
          <Select
            label={t("loanProducts.fields.status")}
            value={form.status}
            options={statusOptions}
            placeholder={t("loanProducts.fields.statusPlaceholder")}
            isClearable
            onChange={(next) =>
              set("status", next as "active" | "inactive" | "")
            }
            error={errors.status}
            hint={t("loanProducts.fields.statusHint")}
          />
        </Section>
      </form>
    </Drawer>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label
        className={cn(
          "flex items-center gap-2.5 text-sm text-foreground",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-input text-accent focus:ring-2 focus:ring-ring/20"
        />
        {label}
      </label>
      {hint ? (
        <span className="pl-[1.625rem] text-[11px] text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Whole-number field → integer or null. */
function toInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

/** Decimal field (rates, deposit value) → number or null. */
function toNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/** Major unit input → `*_minor` (scale 2). Empty → null. */
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
