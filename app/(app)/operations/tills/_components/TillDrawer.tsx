"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import type { Agency } from "@/lib/api/agencies";
import type { LedgerAccount } from "@/lib/api/ledger-accounts";
import type { StaffUser } from "@/lib/api/staff-users";
import type { Till, TillWritePayload } from "@/lib/api/tills";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type TillDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: TillDrawerMode;
  initial?: Till | null;
  agencies: ReadonlyArray<Agency>;
  tellers: ReadonlyArray<StaffUser>;
  ledgerAccounts: ReadonlyArray<LedgerAccount>;
  onClose: () => void;
  onSubmit: (payload: TillWritePayload) => Promise<void>;
};

type FormState = {
  code: string;
  name: string;
  currency: string;
  agency_public_id: string;
  assigned_user_public_id: string;
  ledger_account_public_id: string;
  nature: string;
  is_central_till: boolean;
  requires_denominations: boolean;
  max_balance_limit: string;
  max_withdrawal_limit: string;
  status: "active" | "inactive";
};

const EMPTY: FormState = {
  code: "",
  name: "",
  currency: "XAF",
  agency_public_id: "",
  assigned_user_public_id: "",
  ledger_account_public_id: "",
  nature: "",
  is_central_till: false,
  requires_denominations: false,
  max_balance_limit: "",
  max_withdrawal_limit: "",
  status: "active",
};

export function TillDrawer({
  open,
  mode,
  initial,
  agencies,
  tellers,
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
        currency: initial.currency ?? "XAF",
        agency_public_id: initial.agency_public_id ?? "",
        assigned_user_public_id: initial.assigned_user_public_id ?? "",
        ledger_account_public_id: initial.ledger_account_public_id ?? "",
        nature: initial.nature ?? "",
        is_central_till: initial.is_central_till ?? false,
        requires_denominations: initial.requires_denominations ?? false,
        max_balance_limit: fromMinor(initial.max_balance_limit_minor),
        max_withdrawal_limit: fromMinor(initial.max_withdrawal_limit_minor),
        status: initial.status === "inactive" ? "inactive" : "active",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, isEdit, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Changing the agency invalidates the agency-scoped selections (cashier and
  // ledger account must belong to the same agency), so clear them.
  function onAgencyChange(next: string) {
    setForm((current) => ({
      ...current,
      agency_public_id: next,
      assigned_user_public_id: "",
      ledger_account_public_id: "",
    }));
  }

  const agencyOptions = useMemo(
    () =>
      agencies.map((a) => ({ value: a.public_id, label: `${a.code} — ${a.name}` })),
    [agencies],
  );

  const agencyForFilter = isEdit ? initial?.agency_public_id : form.agency_public_id;

  // The API only allows assigning an active teller/cashier of the till's agency
  // (TillController::canBeAssignedToTill). Mirror that here so the picker never
  // offers an ineligible user.
  const tellerOptions = useMemo(
    () =>
      tellers
        .filter(
          (u) =>
            u.status === "active" &&
            (u.roles.includes("teller") || u.roles.includes("cashier")) &&
            (!agencyForFilter || u.agency_public_id === agencyForFilter),
        )
        .map((u) => ({ value: u.public_id, label: u.name })),
    [tellers, agencyForFilter],
  );

  // Only active asset ledger accounts in the till's agency are valid.
  const ledgerOptions = useMemo(
    () =>
      ledgerAccounts
        .filter(
          (a) =>
            a.status === "active" &&
            a.account_class === "asset" &&
            (a.agency_public_id === null ||
              !agencyForFilter ||
              a.agency_public_id === agencyForFilter),
        )
        .map((a) => ({ value: a.public_id, label: `${a.code} — ${a.name}` })),
    [ledgerAccounts, agencyForFilter],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const common: TillWritePayload = {
      name: form.name.trim(),
      type: "counter",
      currency: form.currency.trim().toUpperCase() || undefined,
      assigned_user_public_id: nullable(form.assigned_user_public_id),
      ledger_account_public_id: nullable(form.ledger_account_public_id),
      nature: nullable(form.nature),
      is_central_till: form.is_central_till,
      requires_denominations: form.requires_denominations,
      max_balance_limit_minor: toMinor(form.max_balance_limit),
      max_withdrawal_limit_minor: toMinor(form.max_withdrawal_limit),
      status: form.status,
    };
    const payload: TillWritePayload = isEdit
      ? common
      : {
          ...common,
          code: form.code.trim(),
          agency_public_id: nullable(form.agency_public_id),
        };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        code: t("tills.fields.code"),
        name: t("tills.fields.name"),
        currency: t("tills.fields.currency"),
        agency_public_id: t("tills.fields.agency"),
        assigned_user_public_id: t("tills.fields.teller"),
        ledger_account_public_id: t("tills.fields.ledgerAccount"),
        max_balance_limit_minor: t("tills.fields.maxBalance"),
        max_withdrawal_limit_minor: t("tills.fields.maxWithdrawal"),
        status: t("tills.fields.status"),
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
          ? t("tills.drawer.titleEdit", { name: initial?.name ?? "" })
          : t("tills.drawer.titleCreate")
      }
      description={t("tills.drawer.hint")}
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
            form="till-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("tills.drawer.create")}
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
        id="till-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <Section title={t("tills.drawer.sectionIdentity")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("tills.fields.code")}
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              error={errors.code}
              disabled={isEdit}
              required={!isEdit}
              hint={isEdit ? t("tills.fields.codeEditHint") : undefined}
            />
            <TextField
              label={t("tills.fields.name")}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              error={errors.name}
              required
            />
            {!isEdit ? (
              <Select
                label={t("tills.fields.agency")}
                value={form.agency_public_id}
                options={agencyOptions}
                placeholder={t("tills.fields.agencyPlaceholder")}
                isClearable
                onChange={onAgencyChange}
                error={errors.agency_public_id}
                hint={t("tills.fields.agencyHint")}
              />
            ) : null}
            <TextField
              label={t("tills.fields.currency")}
              value={form.currency}
              onChange={(event) => set("currency", event.target.value)}
              error={errors.currency}
            />
          </div>
        </Section>

        <Section title={t("tills.drawer.sectionAssignment")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("tills.fields.teller")}
              value={form.assigned_user_public_id}
              options={tellerOptions}
              placeholder={t("tills.fields.tellerPlaceholder")}
              isClearable
              onChange={(next) => set("assigned_user_public_id", next)}
              error={errors.assigned_user_public_id}
              hint={
                tellerOptions.length === 0
                  ? t("tills.fields.noTellers")
                  : t("tills.fields.tellerHint")
              }
            />
            <Select
              label={t("tills.fields.ledgerAccount")}
              value={form.ledger_account_public_id}
              options={ledgerOptions}
              placeholder={t("tills.fields.ledgerAccountPlaceholder")}
              isClearable
              onChange={(next) => set("ledger_account_public_id", next)}
              error={errors.ledger_account_public_id}
              hint={t("tills.fields.ledgerAccountHint")}
            />
          </div>
        </Section>

        <Section title={t("tills.drawer.sectionLimits")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              label={t("tills.fields.maxBalance")}
              value={form.max_balance_limit}
              onChange={(event) => set("max_balance_limit", event.target.value)}
              error={errors.max_balance_limit_minor}
              hint={t("tills.fields.amountHint")}
            />
            <MoneyField
              label={t("tills.fields.maxWithdrawal")}
              value={form.max_withdrawal_limit}
              onChange={(event) => set("max_withdrawal_limit", event.target.value)}
              error={errors.max_withdrawal_limit_minor}
              hint={t("tills.fields.amountHint")}
            />
            <TextField
              label={t("tills.fields.nature")}
              value={form.nature}
              onChange={(event) => set("nature", event.target.value)}
              className="sm:col-span-2"
            />
          </div>
          <div className="flex flex-col gap-2">
            <CheckboxField
              label={t("tills.fields.isCentral")}
              checked={form.is_central_till}
              onChange={(checked) => set("is_central_till", checked)}
            />
            <CheckboxField
              label={t("tills.fields.requiresDenominations")}
              checked={form.requires_denominations}
              onChange={(checked) => set("requires_denominations", checked)}
            />
          </div>
        </Section>

        <Section title={t("tills.drawer.sectionStatus")}>
          <Select
            label={t("tills.fields.status")}
            value={form.status}
            options={[
              { value: "active", label: t("tills.status.active") },
              { value: "inactive", label: t("tills.status.inactive") },
            ]}
            onChange={(next) => set("status", next as "active" | "inactive")}
            error={errors.status}
          />
        </Section>
      </form>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
