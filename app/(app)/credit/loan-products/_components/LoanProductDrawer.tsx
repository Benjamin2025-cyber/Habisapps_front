"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import { fetchFormulaPolicies } from "@/lib/api/reference";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import {
  FEE_POLICY_VALUE,
  INTEREST_POLICY_VALUE,
  PENALTY_POLICY_VALUE,
  REPAYMENT_ALLOCATION_POLICY_VALUE,
  type GuaranteeDepositType,
  type LoanProduct,
  type LoanProductWritePayload,
  type RepaymentFrequency,
  type TermUnit,
} from "@/lib/api/loan-products";

export type LoanProductDrawerMode = "create" | "edit";

/**
 * Penalty enums consumed by the arrears engine (issue #5 /
 * `LoanPenaltyTermsResolver`). `value_type` + `value` + `formula_base` drive the
 * per-period penalty; `formula_type` is descriptive metadata. Values must match
 * the backend exactly — an unknown string makes the engine fall back to the
 * global config policy.
 */
const PENALTY_VALUE_TYPES = ["amount", "percentage"] as const;
const PENALTY_FORMULA_BASES = [
  "unpaid_scheduled_due",
  "overdue_amount",
  "principal",
  "outstanding_principal",
] as const;
const PENALTY_FORMULA_TYPES = [
  "fixed",
  "flat_rate",
  "percentage",
  "variable_rate",
] as const;

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
  fee_amount: string;
  floor_amount: string;
  guarantee_deposit_type: GuaranteeDepositType | "";
  guarantee_deposit_value: string;
  // Pénalité
  penalty_grace_days: string;
  penalty_formula_type: string;
  penalty_formula_base: string;
  penalty_value_type: string;
  penalty_value: string;
  // Comptabilité
  ledger_account_public_id: string;
  policy_interest: boolean;
  policy_penalty: boolean;
  policy_repayment_allocation: boolean;
  policy_fee: boolean;
  policy_tax: boolean;
  policy_insurance: boolean;
  policy_guarantee_deposit: boolean;
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
  fee_amount: "",
  floor_amount: "",
  guarantee_deposit_type: "",
  guarantee_deposit_value: "",
  penalty_grace_days: "",
  penalty_formula_type: "",
  penalty_formula_base: "",
  penalty_value_type: "",
  penalty_value: "",
  ledger_account_public_id: "",
  policy_interest: false,
  policy_penalty: false,
  policy_repayment_allocation: false,
  policy_fee: false,
  policy_tax: false,
  policy_insurance: false,
  policy_guarantee_deposit: false,
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
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Formula-policy catalog (back-issue #20): drives which policy toggles are
  // selectable. Unapproved policies (e.g. penalties_and_arrears) are disabled
  // here instead of being hardcoded, and never submitted.
  const [policyApproved, setPolicyApproved] = useState<Map<string, boolean>>(
    new Map(),
  );
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    fetchFormulaPolicies(token)
      .then((policies) => {
        if (!cancelled) {
          setPolicyApproved(
            new Map(policies.map((p) => [p.key, p.approved])),
          );
        }
      })
      .catch(() => {
        /* leave empty — toggles stay enabled until we know otherwise */
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  // A policy is selectable unless the catalog explicitly marks it unapproved.
  const policyEnabled = (key: string): boolean => policyApproved.get(key) !== false;

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
        fee_amount: fromMinor(initial.fee_amount_minor),
        floor_amount: fromMinor(initial.floor_amount_minor),
        guarantee_deposit_type: initial.guarantee_deposit_type ?? "",
        guarantee_deposit_value: initial.guarantee_deposit_value ?? "",
        penalty_grace_days: fromNumber(initial.penalty_grace_days),
        penalty_formula_type: initial.penalty_formula_type ?? "",
        penalty_formula_base: initial.penalty_formula_base ?? "",
        penalty_value_type: initial.penalty_value_type ?? "",
        penalty_value: initial.penalty_value ?? "",
        ledger_account_public_id: initial.ledger_account_public_id ?? "",
        policy_interest: initial.interest_policy_key !== null,
        policy_penalty: initial.penalty_policy_key !== null,
        policy_repayment_allocation:
          initial.repayment_allocation_policy_key !== null,
        policy_fee: initial.fee_policy_key !== null,
        policy_tax: initial.tax_policy_key !== null,
        policy_insurance: initial.insurance_policy_key !== null,
        policy_guarantee_deposit: initial.guarantee_deposit_policy_key !== null,
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

  const depositTypeOptions: Array<{ value: GuaranteeDepositType; label: string }> =
    [
      { value: "percentage", label: t("loanProducts.depositType.percentage") },
      { value: "fixed", label: t("loanProducts.depositType.fixed") },
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
      fee_amount_minor: toMinor(form.fee_amount),
      floor_amount_minor: toMinor(form.floor_amount),
      guarantee_deposit_type: form.guarantee_deposit_type || null,
      guarantee_deposit_value: toNum(form.guarantee_deposit_value),
      penalty_grace_days: toInt(form.penalty_grace_days),
      penalty_formula_type: nullable(form.penalty_formula_type),
      penalty_formula_base: nullable(form.penalty_formula_base),
      penalty_value_type: nullable(form.penalty_value_type),
      penalty_value: toNum(form.penalty_value),
      ledger_account_public_id: nullable(form.ledger_account_public_id),
      interest_policy_key:
        form.policy_interest && policyEnabled(INTEREST_POLICY_VALUE)
          ? INTEREST_POLICY_VALUE
          : null,
      // Only attach a policy the catalog reports as approved — attaching an
      // unapproved one (e.g. penalties_and_arrears) makes loan creation 422
      // (back-issues #16/#20). penalties_and_arrears is approved=false, so this
      // stays null until the backend approves it.
      penalty_policy_key:
        form.policy_penalty && policyEnabled(PENALTY_POLICY_VALUE)
          ? PENALTY_POLICY_VALUE
          : null,
      repayment_allocation_policy_key:
        form.policy_repayment_allocation &&
        policyEnabled(REPAYMENT_ALLOCATION_POLICY_VALUE)
          ? REPAYMENT_ALLOCATION_POLICY_VALUE
          : null,
      fee_policy_key:
        form.policy_fee && policyEnabled(FEE_POLICY_VALUE)
          ? FEE_POLICY_VALUE
          : null,
      tax_policy_key:
        form.policy_tax && policyEnabled(FEE_POLICY_VALUE)
          ? FEE_POLICY_VALUE
          : null,
      insurance_policy_key:
        form.policy_insurance && policyEnabled(FEE_POLICY_VALUE)
          ? FEE_POLICY_VALUE
          : null,
      guarantee_deposit_policy_key:
        form.policy_guarantee_deposit && policyEnabled(FEE_POLICY_VALUE)
          ? FEE_POLICY_VALUE
          : null,
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
        ledger_account_public_id: t("loanProducts.fields.ledgerAccount"),
        min_term_count: t("loanProducts.fields.minTerm"),
        max_term_count: t("loanProducts.fields.maxTerm"),
        term_unit: t("loanProducts.fields.termUnit"),
        min_amount_minor: t("loanProducts.fields.minAmount"),
        max_amount_minor: t("loanProducts.fields.maxAmount"),
        due_date_day: t("loanProducts.fields.dueDateDay"),
        interest_rate: t("loanProducts.fields.interestRate"),
        tax_rate: t("loanProducts.fields.taxRate"),
        insurance_rate: t("loanProducts.fields.insuranceRate"),
        fee_amount_minor: t("loanProducts.fields.feeAmount"),
        floor_amount_minor: t("loanProducts.fields.floorAmount"),
        guarantee_deposit_value: t("loanProducts.fields.depositValue"),
        penalty_value: t("loanProducts.fields.penaltyValue"),
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
            <MoneyField
              label={t("loanProducts.fields.feeAmount")}
              value={form.fee_amount}
              onChange={(event) => set("fee_amount", event.target.value)}
              error={errors.fee_amount_minor}
              hint={t("loanProducts.fields.amountHint")}
            />
            <MoneyField
              label={t("loanProducts.fields.floorAmount")}
              value={form.floor_amount}
              onChange={(event) => set("floor_amount", event.target.value)}
              error={errors.floor_amount_minor}
              hint={t("loanProducts.fields.amountHint")}
            />
            <Select
              label={t("loanProducts.fields.depositType")}
              value={form.guarantee_deposit_type}
              options={depositTypeOptions}
              placeholder={t("loanProducts.fields.depositTypePlaceholder")}
              isClearable
              onChange={(next) =>
                set("guarantee_deposit_type", next as GuaranteeDepositType | "")
              }
              error={errors.guarantee_deposit_type}
            />
            <MoneyField
              label={t("loanProducts.fields.depositValue")}
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

          {/*
           * Penalty terms are now consumed by the arrears engine (issue #5):
           * `penalty_value_type` + `penalty_value` + `penalty_formula_base`
           * drive the per-period penalty, with snapshot → product → global
           * config precedence. `penalty_formula_type` is descriptive metadata
           * snapshotted onto the loan. Selects keep the values to the exact
           * enums the engine matches (a free-text typo would silently fall back
           * to the global config policy).
           */}
          <p className="rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("loanProducts.fields.penaltyHint")}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("loanProducts.fields.penaltyValueType")}
              value={form.penalty_value_type}
              options={PENALTY_VALUE_TYPES.map((value) => ({
                value,
                label: t(`loanProducts.penaltyValueTypeOptions.${value}`),
              }))}
              placeholder={t("loanProducts.fields.penaltyValueTypePlaceholder")}
              onChange={(value) => set("penalty_value_type", value)}
              error={errors.penalty_value_type}
              hint={t("loanProducts.fields.penaltyValueTypeHint")}
              isClearable
            />
            <TextField
              label={t("loanProducts.fields.penaltyValue")}
              type="number"
              value={form.penalty_value}
              onChange={(event) => set("penalty_value", event.target.value)}
              error={errors.penalty_value}
              hint={
                form.penalty_value_type === "percentage"
                  ? t("loanProducts.fields.penaltyValueRateHint")
                  : form.penalty_value_type === "amount"
                    ? t("loanProducts.fields.penaltyValueAmountHint")
                    : undefined
              }
            />
            {form.penalty_value_type === "percentage" ? (
              <Select
                label={t("loanProducts.fields.penaltyFormulaBase")}
                value={form.penalty_formula_base}
                options={PENALTY_FORMULA_BASES.map((value) => ({
                  value,
                  label: t(`loanProducts.penaltyFormulaBaseOptions.${value}`),
                }))}
                placeholder={t(
                  "loanProducts.fields.penaltyFormulaBasePlaceholder",
                )}
                onChange={(value) => set("penalty_formula_base", value)}
                error={errors.penalty_formula_base}
                hint={t("loanProducts.fields.penaltyFormulaBaseHint")}
                isClearable
                className="sm:col-span-2"
              />
            ) : null}
            <Select
              label={t("loanProducts.fields.penaltyFormulaType")}
              value={form.penalty_formula_type}
              options={PENALTY_FORMULA_TYPES.map((value) => ({
                value,
                label: t(`loanProducts.penaltyFormulaTypeOptions.${value}`),
              }))}
              placeholder={t("loanProducts.fields.penaltyFormulaTypePlaceholder")}
              onChange={(value) => set("penalty_formula_type", value)}
              error={errors.penalty_formula_type}
              hint={t("loanProducts.fields.penaltyFormulaTypeHint")}
              isClearable
              className="sm:col-span-2"
            />
          </div>
        </Section>

        {/* Comptabilité */}
        <Section title={t("loanProducts.drawer.sectionAccounting")}>
          <TextField
            label={t("loanProducts.fields.ledgerAccount")}
            value={form.ledger_account_public_id}
            onChange={(event) =>
              set("ledger_account_public_id", event.target.value)
            }
            error={errors.ledger_account_public_id}
            hint={t("loanProducts.fields.ledgerAccountHint")}
          />
          <div className="mt-1 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("loanProducts.fields.policiesLabel")}
            </span>
            <p className="text-xs text-muted-foreground">
              {t("loanProducts.fields.policiesHint")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CheckboxField
                label={t("loanProducts.fields.policyInterest")}
                checked={form.policy_interest}
                onChange={(checked) => set("policy_interest", checked)}
                disabled={!policyEnabled(INTEREST_POLICY_VALUE)}
                hint={
                  policyEnabled(INTEREST_POLICY_VALUE)
                    ? undefined
                    : t("loanProducts.fields.policyUnapprovedHint")
                }
              />
              <CheckboxField
                label={t("loanProducts.fields.policyPenalty")}
                checked={form.policy_penalty && policyEnabled(PENALTY_POLICY_VALUE)}
                onChange={(checked) => set("policy_penalty", checked)}
                disabled={!policyEnabled(PENALTY_POLICY_VALUE)}
                hint={
                  policyEnabled(PENALTY_POLICY_VALUE)
                    ? undefined
                    : t("loanProducts.fields.policyUnapprovedHint")
                }
              />
              <CheckboxField
                label={t("loanProducts.fields.policyRepaymentAllocation")}
                checked={form.policy_repayment_allocation}
                onChange={(checked) =>
                  set("policy_repayment_allocation", checked)
                }
                disabled={!policyEnabled(REPAYMENT_ALLOCATION_POLICY_VALUE)}
                hint={
                  policyEnabled(REPAYMENT_ALLOCATION_POLICY_VALUE)
                    ? undefined
                    : t("loanProducts.fields.policyUnapprovedHint")
                }
              />
              <CheckboxField
                label={t("loanProducts.fields.policyFee")}
                checked={form.policy_fee}
                onChange={(checked) => set("policy_fee", checked)}
                disabled={!policyEnabled(FEE_POLICY_VALUE)}
              />
              <CheckboxField
                label={t("loanProducts.fields.policyTax")}
                checked={form.policy_tax}
                onChange={(checked) => set("policy_tax", checked)}
                disabled={!policyEnabled(FEE_POLICY_VALUE)}
              />
              <CheckboxField
                label={t("loanProducts.fields.policyInsurance")}
                checked={form.policy_insurance}
                onChange={(checked) => set("policy_insurance", checked)}
                disabled={!policyEnabled(FEE_POLICY_VALUE)}
              />
              <CheckboxField
                label={t("loanProducts.fields.policyGuaranteeDeposit")}
                checked={form.policy_guarantee_deposit}
                onChange={(checked) =>
                  set("policy_guarantee_deposit", checked)
                }
                disabled={!policyEnabled(FEE_POLICY_VALUE)}
              />
            </div>
          </div>
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
