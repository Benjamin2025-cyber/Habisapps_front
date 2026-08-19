"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import {
  LedgerAccountPicker,
  type LedgerAccountOption,
} from "@/app/(app)/_components/LedgerAccountPicker";
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
  agenciesError?: string | null;
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
  status: "",
};

export function AccountProductDrawer({
  open,
  mode,
  initial,
  agencies,
  agenciesError,
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
  const [ledgerSelection, setLedgerSelection] =
    useState<LedgerAccountOption | null>(null);

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
              error={agenciesError ?? errors.agency_public_id}
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
            {/* Server-searched rather than picked from a prefetched page: the
                chart runs to a thousand accounts per agency and the first page
                stops in class 2, so anything past it — 3712 Comptes courants
                clients among them — was seeded, listed by the API, and simply
                unreachable from this field. */}
            <div className="sm:col-span-2">
              <LedgerAccountPicker
                label={t("accountProducts.fields.ledgerAccount")}
                value={ledgerSelection}
                onChange={(option) => {
                  setLedgerSelection(option);
                  set("ledger_account_public_id", option?.value ?? "");
                }}
                agencyPublicId={ledgerAgency}
                resetKey={ledgerAgency ?? ""}
                initialValuePublicId={initial?.ledger_account_public_id ?? null}
                filter={(a) => a.status === "active"}
                placeholder={t("accountProducts.fields.ledgerAccountPlaceholder")}
                error={errors.ledger_account_public_id}
                hint={t("accountProducts.fields.ledgerAccountHint")}
              />
            </div>
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
  hint,
  checked,
  onChange,
}: {
  label: string;
  /** Shown under the box — used here to say which flags nothing reads yet. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-input text-accent focus:ring-2 focus:ring-ring/20"
        />
        {label}
      </label>
      {hint ? (
        <p className="pl-[26px] text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
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
