"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Agency } from "@/lib/api/agencies";
import type { LedgerAccount } from "@/lib/api/ledger-accounts";
import type {
  AccountFamily,
  AccountProduct,
  AccountProductWritePayload,
} from "@/lib/api/account-products";

export type AccountProductDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: AccountProductDrawerMode;
  initial?: AccountProduct | null;
  agencies: ReadonlyArray<Agency>;
  ledgerAccounts: ReadonlyArray<LedgerAccount>;
  onClose: () => void;
  onSubmit: (payload: AccountProductWritePayload) => Promise<void>;
};

type FormState = {
  code: string;
  name: string;
  account_family: AccountFamily | "";
  currency: string;
  agency_public_id: string;
  ledger_account_public_id: string;
  minimum_balance: string;
  allows_overdraft: boolean;
  overdraft_limit: string;
  is_ordinary_savings: boolean;
  is_recovery_account: boolean;
  allows_recovery_debit: boolean;
  status: "active" | "inactive" | "";
};

const EMPTY: FormState = {
  code: "",
  name: "",
  account_family: "",
  currency: "XAF",
  agency_public_id: "",
  ledger_account_public_id: "",
  minimum_balance: "",
  allows_overdraft: false,
  overdraft_limit: "",
  is_ordinary_savings: false,
  is_recovery_account: false,
  allows_recovery_debit: false,
  status: "",
};

export function AccountProductDrawer({
  open,
  mode,
  initial,
  agencies,
  ledgerAccounts,
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
      setForm({
        code: initial.code ?? "",
        name: initial.name ?? "",
        account_family: initial.account_family,
        currency: initial.currency ?? "XAF",
        agency_public_id: initial.agency_public_id ?? "",
        ledger_account_public_id: initial.ledger_account_public_id ?? "",
        minimum_balance: fromMinor(initial.minimum_balance_minor),
        allows_overdraft: initial.allows_overdraft ?? false,
        overdraft_limit: fromMinor(initial.overdraft_limit_minor),
        is_ordinary_savings: initial.is_ordinary_savings ?? false,
        is_recovery_account: initial.is_recovery_account ?? false,
        allows_recovery_debit: initial.allows_recovery_debit ?? false,
        status: initial.status === "archived" ? "" : initial.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, isEdit, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const familyOptions: Array<{ value: AccountFamily; label: string }> = [
    { value: "savings", label: t("accountProducts.family.savings") },
    { value: "current", label: t("accountProducts.family.current") },
    { value: "recovery", label: t("accountProducts.family.recovery") },
    { value: "islamic", label: t("accountProducts.family.islamic") },
  ];

  const statusOptions: Array<{ value: "active" | "inactive"; label: string }> = [
    { value: "active", label: t("accountProducts.status.active") },
    { value: "inactive", label: t("accountProducts.status.inactive") },
  ];

  const agencyOptions = useMemo(
    () =>
      agencies.map((agency) => ({
        value: agency.public_id,
        label: `${agency.code} — ${agency.name}`,
      })),
    [agencies],
  );

  // Active ledger accounts in the product's agency (or institutional).
  const ledgerAgency = isEdit
    ? (initial?.agency_public_id ?? null)
    : form.agency_public_id || null;
  const ledgerOptions = useMemo(
    () =>
      ledgerAccounts
        .filter(
          (a) =>
            a.status === "active" &&
            (a.agency_public_id === null ||
              !ledgerAgency ||
              a.agency_public_id === ledgerAgency),
        )
        .map((a) => ({ value: a.public_id, label: `${a.code} — ${a.name}` })),
    [ledgerAccounts, ledgerAgency],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const family = form.account_family || undefined;
    const common = {
      name: form.name.trim(),
      account_family: family,
      currency: nullable(form.currency)?.toUpperCase() ?? undefined,
      ledger_account_public_id: nullable(form.ledger_account_public_id),
      minimum_balance_minor: toMinor(form.minimum_balance),
      allows_overdraft: form.allows_overdraft,
      overdraft_limit_minor: form.allows_overdraft
        ? toMinor(form.overdraft_limit)
        : null,
      is_ordinary_savings: form.is_ordinary_savings,
      is_recovery_account: form.is_recovery_account,
      allows_recovery_debit: form.allows_recovery_debit,
      status: form.status || undefined,
    };

    // `code` and `agency_public_id` are create-only (the update endpoint
    // ignores them).
    const payload: AccountProductWritePayload = isEdit
      ? common
      : {
          ...common,
          code: form.code.trim(),
          agency_public_id: nullable(form.agency_public_id),
        };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        code: t("accountProducts.fields.code"),
        name: t("accountProducts.fields.name"),
        account_family: t("accountProducts.fields.family"),
        currency: t("accountProducts.fields.currency"),
        agency_public_id: t("accountProducts.fields.agency"),
        ledger_account_public_id: t("accountProducts.fields.ledgerAccount"),
        minimum_balance_minor: t("accountProducts.fields.minimumBalance"),
        overdraft_limit_minor: t("accountProducts.fields.overdraftLimit"),
        status: t("accountProducts.fields.status"),
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
          ? t("accountProducts.drawer.titleEdit", {
              name: initial?.name ?? initial?.code ?? "",
            })
          : t("accountProducts.drawer.titleCreate")
      }
      description={
        isEdit
          ? t("accountProducts.drawer.editHint")
          : t("accountProducts.drawer.createHint")
      }
      widthClassName="sm:w-[40rem]"
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
            form="account-product-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("accountProducts.drawer.create")}
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
        id="account-product-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <Section title={t("accountProducts.drawer.sectionIdentity")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("accountProducts.fields.code")}
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              error={errors.code}
              disabled={isEdit}
              required={!isEdit}
              hint={isEdit ? t("accountProducts.fields.codeEditHint") : undefined}
            />
            <Select
              label={t("accountProducts.fields.family")}
              value={form.account_family}
              options={familyOptions}
              placeholder={t("accountProducts.fields.familyPlaceholder")}
              onChange={(next) => set("account_family", next as AccountFamily | "")}
              error={errors.account_family}
              required
            />
            <TextField
              label={t("accountProducts.fields.name")}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              error={errors.name}
              required
              className="sm:col-span-2"
            />
          </div>
        </Section>

        <Section title={t("accountProducts.drawer.sectionAccounting")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("accountProducts.fields.agency")}
              value={form.agency_public_id}
              options={agencyOptions}
              placeholder={t("accountProducts.fields.agencyPlaceholder")}
              isClearable
              onChange={(next) => set("agency_public_id", next)}
              error={errors.agency_public_id}
              disabled={isEdit}
              hint={
                isEdit ? t("accountProducts.fields.agencyEditHint") : undefined
              }
            />
            <TextField
              label={t("accountProducts.fields.currency")}
              value={form.currency}
              onChange={(event) => set("currency", event.target.value)}
              error={errors.currency}
              hint={t("accountProducts.fields.currencyHint")}
            />
            <Select
              label={t("accountProducts.fields.ledgerAccount")}
              value={form.ledger_account_public_id}
              options={ledgerOptions}
              placeholder={t("accountProducts.fields.ledgerAccountPlaceholder")}
              isClearable
              onChange={(next) => set("ledger_account_public_id", next)}
              error={errors.ledger_account_public_id}
              hint={
                ledgerOptions.length === 0
                  ? t("accountProducts.fields.noLedgerAccounts")
                  : t("accountProducts.fields.ledgerAccountHint")
              }
              className="sm:col-span-2"
            />
            <MoneyField
              label={t("accountProducts.fields.minimumBalance")}
              value={form.minimum_balance}
              onChange={(event) => set("minimum_balance", event.target.value)}
              error={errors.minimum_balance_minor}
              hint={t("accountProducts.fields.amountHint")}
              className="sm:col-span-2"
            />
          </div>
        </Section>

        <Section title={t("accountProducts.drawer.sectionRules")}>
          <div className="flex flex-col gap-2">
            <CheckboxField
              label={t("accountProducts.fields.isOrdinarySavings")}
              checked={form.is_ordinary_savings}
              onChange={(checked) => set("is_ordinary_savings", checked)}
            />
            <CheckboxField
              label={t("accountProducts.fields.isRecoveryAccount")}
              checked={form.is_recovery_account}
              onChange={(checked) => set("is_recovery_account", checked)}
            />
            <CheckboxField
              label={t("accountProducts.fields.allowsRecoveryDebit")}
              checked={form.allows_recovery_debit}
              onChange={(checked) => set("allows_recovery_debit", checked)}
            />
            <CheckboxField
              label={t("accountProducts.fields.allowsOverdraft")}
              checked={form.allows_overdraft}
              onChange={(checked) => set("allows_overdraft", checked)}
            />
          </div>
          {form.allows_overdraft ? (
            <MoneyField
              label={t("accountProducts.fields.overdraftLimit")}
              value={form.overdraft_limit}
              onChange={(event) => set("overdraft_limit", event.target.value)}
              error={errors.overdraft_limit_minor}
              hint={t("accountProducts.fields.amountHint")}
            />
          ) : null}
        </Section>

        <Section title={t("accountProducts.drawer.sectionStatus")}>
          <Select
            label={t("accountProducts.fields.status")}
            value={form.status}
            options={statusOptions}
            placeholder={t("accountProducts.fields.statusPlaceholder")}
            isClearable
            onChange={(next) =>
              set("status", next as "active" | "inactive" | "")
            }
            error={errors.status}
            hint={t("accountProducts.fields.statusHint")}
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
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-input text-accent focus:ring-2 focus:ring-ring/20"
      />
      {label}
    </label>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Amounts are entered in the major unit but stored as `*_minor` (scale 2,
 * consistent with the app's currency formatter). Empty input → null.
 */
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
