"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import {
  fetchCustomerAccounts,
  type CustomerAccount,
} from "@/lib/api/customer-accounts";
import {
  fetchLoanProducts,
  type LoanProduct,
} from "@/lib/api/loan-products";
import { fetchSectors, fetchSubSectors, type Sector, type SubSector } from "@/lib/api/sectors";
import type { Loan, LoanWritePayload } from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ClientPicker, type ClientOption } from "../../../_components/ClientPicker";
import { StaffUserPicker } from "../../../_components/StaffUserPicker";

export type LoanDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: LoanDrawerMode;
  initial?: Loan | null;
  onClose: () => void;
  onSubmit: (payload: LoanWritePayload) => Promise<void>;
};

type FormState = {
  client: ClientOption | null;
  loan_product_public_id: string;
  credit_agent_public_id: string;
  applied_on: string;
  requested_amount: string;
  currency: string;
  number_of_installments: string;
  tranche_duration: string;
  grace_period_duration: string;
  total_loan_duration: string;
  first_installment_date: string;
  amortization_account_public_id: string;
  unpaid_account_public_id: string;
  recovery_account_public_id: string;
  transfer_account_public_id: string;
  purpose: string;
  sector_public_id: string;
  sub_sector_public_id: string;
  financed_activity_code: string;
  activity_address: string;
  entrepreneur_address: string;
};

const EMPTY: FormState = {
  client: null,
  loan_product_public_id: "",
  credit_agent_public_id: "",
  applied_on: "",
  requested_amount: "",
  currency: "XAF",
  number_of_installments: "",
  tranche_duration: "",
  grace_period_duration: "",
  total_loan_duration: "",
  first_installment_date: "",
  amortization_account_public_id: "",
  unpaid_account_public_id: "",
  recovery_account_public_id: "",
  transfer_account_public_id: "",
  purpose: "",
  sector_public_id: "",
  sub_sector_public_id: "",
  financed_activity_code: "",
  activity_address: "",
  entrepreneur_address: "",
};

export function LoanDrawer({ open, mode, initial, onClose, onSubmit }: Props) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [subSectors, setSubSectors] = useState<SubSector[]>([]);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);

  const isEdit = mode === "edit";

  // Hydrate the form when the drawer opens.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (isEdit && initial) {
      setForm({
        client: null, // immutable on edit — shown read-only below
        loan_product_public_id: initial.loan_product_public_id ?? "",
        credit_agent_public_id: initial.credit_agent_public_id ?? "",
        applied_on: initial.applied_on ?? "",
        requested_amount: fromMinor(initial.requested_amount_minor),
        currency: initial.currency ?? "XAF",
        number_of_installments: fromNumber(initial.number_of_installments),
        tranche_duration: fromNumber(initial.tranche_duration),
        grace_period_duration: fromNumber(initial.grace_period_duration),
        total_loan_duration: fromNumber(initial.total_loan_duration),
        first_installment_date: initial.first_installment_date ?? "",
        amortization_account_public_id:
          initial.amortization_account_public_id ?? "",
        unpaid_account_public_id: initial.unpaid_account_public_id ?? "",
        recovery_account_public_id: initial.recovery_account_public_id ?? "",
        transfer_account_public_id: initial.transfer_account_public_id ?? "",
        purpose: initial.purpose ?? "",
        sector_public_id: initial.sector_public_id ?? "",
        sub_sector_public_id: initial.sub_sector_public_id ?? "",
        financed_activity_code: initial.financed_activity_code ?? "",
        activity_address: initial.activity_address ?? "",
        entrepreneur_address: initial.entrepreneur_address ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, isEdit, initial]);

  // Reference data: active loan products + sectors.
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    Promise.all([
      fetchLoanProducts(token, { perPage: 100, status: "active" }).catch(
        () => ({ data: [] as LoanProduct[] }),
      ),
      fetchSectors(token, { perPage: 100 }).catch(() => [] as Sector[]),
      fetchSubSectors(token, { perPage: 100 }).catch(() => [] as SubSector[]),
    ]).then(([prod, sect, subs]) => {
      if (cancelled) return;
      setProducts(prod.data);
      setSectors(sect);
      setSubSectors(subs);
    });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  // The client whose accounts feed the account-link selects.
  const clientPublicId = isEdit
    ? (initial?.client_public_id ?? null)
    : (form.client?.value ?? null);

  useEffect(() => {
    if (!open || !token || !clientPublicId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    fetchCustomerAccounts(token, { clientPublicId, perPage: 100 })
      .then((response) => {
        if (!cancelled) setAccounts(response.data);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, clientPublicId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.public_id,
        label: `${p.code} — ${p.name}`,
      })),
    [products],
  );

  const sectorOptions = useMemo(
    () => sectors.map((s) => ({ value: s.public_id, label: `${s.code} — ${s.name}` })),
    [sectors],
  );

  const subSectorOptions = useMemo(
    () =>
      subSectors
        .filter(
          (s) =>
            !form.sector_public_id ||
            s.sector_public_id === form.sector_public_id,
        )
        .map((s) => ({ value: s.public_id, label: `${s.code} — ${s.name}` })),
    [subSectors, form.sector_public_id],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.public_id,
        label: `${a.account_number ?? a.public_id}${
          a.status ? ` (${a.status})` : ""
        }`,
      })),
    [accounts],
  );

  const productName = useMemo(() => {
    if (!isEdit) return "";
    const match = products.find(
      (p) => p.public_id === initial?.loan_product_public_id,
    );
    return match ? `${match.code} — ${match.name}` : (initial?.loan_product_public_id ?? "");
  }, [isEdit, products, initial]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const common: LoanWritePayload = {
      credit_agent_public_id: nullable(form.credit_agent_public_id),
      applied_on: nullable(form.applied_on),
      requested_amount_minor: toMinor(form.requested_amount) ?? undefined,
      currency: nullable(form.currency)?.toUpperCase() ?? undefined,
      number_of_installments: toInt(form.number_of_installments),
      tranche_duration: toInt(form.tranche_duration),
      grace_period_duration: toInt(form.grace_period_duration),
      total_loan_duration: toInt(form.total_loan_duration),
      first_installment_date: nullable(form.first_installment_date),
      amortization_account_public_id: nullable(
        form.amortization_account_public_id,
      ),
      unpaid_account_public_id: nullable(form.unpaid_account_public_id),
      recovery_account_public_id: nullable(form.recovery_account_public_id),
      transfer_account_public_id: nullable(form.transfer_account_public_id),
      purpose: nullable(form.purpose),
      sector_public_id: nullable(form.sector_public_id),
      sub_sector_public_id: nullable(form.sub_sector_public_id),
      financed_activity_code: nullable(form.financed_activity_code),
      activity_address: nullable(form.activity_address),
      entrepreneur_address: nullable(form.entrepreneur_address),
    };

    // client + product are create-only (immutable; the update endpoint rejects them).
    const payload: LoanWritePayload = isEdit
      ? common
      : {
          ...common,
          client_public_id: form.client?.value,
          loan_product_public_id: form.loan_product_public_id || undefined,
        };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        client_public_id: t("loans.fields.client"),
        loan_product_public_id: t("loans.fields.product"),
        requested_amount_minor: t("loans.fields.requestedAmount"),
        currency: t("loans.fields.currency"),
        credit_agent_public_id: t("loans.fields.creditAgent"),
        number_of_installments: t("loans.fields.installments"),
        tranche_duration: t("loans.fields.trancheDuration"),
        grace_period_duration: t("loans.fields.gracePeriod"),
        total_loan_duration: t("loans.fields.totalDuration"),
        first_installment_date: t("loans.fields.firstInstallment"),
        amortization_account_public_id: t("loans.fields.amortizationAccount"),
        unpaid_account_public_id: t("loans.fields.unpaidAccount"),
        recovery_account_public_id: t("loans.fields.recoveryAccount"),
        transfer_account_public_id: t("loans.fields.transferAccount"),
        sector_public_id: t("loans.fields.sector"),
        sub_sector_public_id: t("loans.fields.subSector"),
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
          ? t("loans.drawer.titleEdit", {
              number: initial?.loan_number ?? "",
            })
          : t("loans.drawer.titleCreate")
      }
      description={
        isEdit
          ? t("loans.drawer.editHint")
          : t("loans.drawer.createHint")
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
            form="loan-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("loans.drawer.create")}
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
        id="loan-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        {/* Rattachement */}
        <Section title={t("loans.drawer.sectionLinkage")}>
          {isEdit ? (
            <TextField
              label={t("loans.fields.client")}
              value={initial?.client_public_id ?? ""}
              onChange={() => undefined}
              disabled
              hint={t("loans.fields.clientEditHint")}
            />
          ) : (
            <ClientPicker
              label={t("loans.fields.client")}
              value={form.client}
              onChange={(option) => set("client", option)}
              error={errors.client_public_id}
              required
            />
          )}

          {isEdit ? (
            <TextField
              label={t("loans.fields.product")}
              value={productName}
              onChange={() => undefined}
              disabled
              hint={t("loans.fields.productEditHint")}
            />
          ) : (
            <Select
              label={t("loans.fields.product")}
              value={form.loan_product_public_id}
              options={productOptions}
              placeholder={t("loans.fields.productPlaceholder")}
              onChange={(next) => set("loan_product_public_id", next)}
              error={errors.loan_product_public_id}
              required
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StaffUserPicker
              label={t("loans.fields.creditAgent")}
              value={form.credit_agent_public_id}
              onChange={(id) => set("credit_agent_public_id", id)}
              placeholder={t("loans.fields.creditAgentPlaceholder")}
              hint={t("loans.fields.creditAgentHint")}
              filterRoles={["loan-officer"]}
            />
            <TextField
              label={t("loans.fields.appliedOn")}
              type="date"
              value={form.applied_on}
              onChange={(event) => set("applied_on", event.target.value)}
              error={errors.applied_on}
              hint={t("loans.fields.appliedOnHint")}
            />
          </div>
        </Section>

        {/* Montant & échéancier */}
        <Section title={t("loans.drawer.sectionFinancial")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              label={t("loans.fields.requestedAmount")}
              value={form.requested_amount}
              onChange={(event) => set("requested_amount", event.target.value)}
              error={errors.requested_amount_minor}
              required={!isEdit}
              hint={t("loans.fields.amountHint")}
            />
            <TextField
              label={t("loans.fields.currency")}
              value={form.currency}
              onChange={(event) => set("currency", event.target.value)}
              error={errors.currency}
              hint={t("loans.fields.currencyHint")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("loans.fields.installments")}
              type="number"
              value={form.number_of_installments}
              onChange={(event) =>
                set("number_of_installments", event.target.value)
              }
              error={errors.number_of_installments}
            />
            <TextField
              label={t("loans.fields.firstInstallment")}
              type="date"
              value={form.first_installment_date}
              onChange={(event) =>
                set("first_installment_date", event.target.value)
              }
              error={errors.first_installment_date}
            />
            <TextField
              label={t("loans.fields.trancheDuration")}
              type="number"
              value={form.tranche_duration}
              onChange={(event) => set("tranche_duration", event.target.value)}
              error={errors.tranche_duration}
              hint={t("loans.fields.daysHint")}
            />
            <TextField
              label={t("loans.fields.gracePeriod")}
              type="number"
              value={form.grace_period_duration}
              onChange={(event) =>
                set("grace_period_duration", event.target.value)
              }
              error={errors.grace_period_duration}
              hint={t("loans.fields.daysHint")}
            />
            <TextField
              label={t("loans.fields.totalDuration")}
              type="number"
              value={form.total_loan_duration}
              onChange={(event) =>
                set("total_loan_duration", event.target.value)
              }
              error={errors.total_loan_duration}
              hint={t("loans.fields.daysHint")}
              className="sm:col-span-2"
            />
          </div>
        </Section>

        {/* Comptes rattachés */}
        <Section title={t("loans.drawer.sectionAccounts")}>
          {clientPublicId ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={t("loans.fields.amortizationAccount")}
                value={form.amortization_account_public_id}
                options={accountOptions}
                placeholder={t("loans.fields.accountPlaceholder")}
                isClearable
                onChange={(next) => set("amortization_account_public_id", next)}
                error={errors.amortization_account_public_id}
              />
              <Select
                label={t("loans.fields.unpaidAccount")}
                value={form.unpaid_account_public_id}
                options={accountOptions}
                placeholder={t("loans.fields.accountPlaceholder")}
                isClearable
                onChange={(next) => set("unpaid_account_public_id", next)}
                error={errors.unpaid_account_public_id}
              />
              <Select
                label={t("loans.fields.recoveryAccount")}
                value={form.recovery_account_public_id}
                options={accountOptions}
                placeholder={t("loans.fields.accountPlaceholder")}
                isClearable
                onChange={(next) => set("recovery_account_public_id", next)}
                error={errors.recovery_account_public_id}
              />
              <Select
                label={t("loans.fields.transferAccount")}
                value={form.transfer_account_public_id}
                options={accountOptions}
                placeholder={t("loans.fields.accountPlaceholder")}
                isClearable
                onChange={(next) => set("transfer_account_public_id", next)}
                error={errors.transfer_account_public_id}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("loans.fields.accountsNeedClient")}
            </p>
          )}
        </Section>

        {/* Activité financée */}
        <Section title={t("loans.drawer.sectionActivity")}>
          <TextField
            label={t("loans.fields.purpose")}
            value={form.purpose}
            onChange={(event) => set("purpose", event.target.value)}
            error={errors.purpose}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("loans.fields.sector")}
              value={form.sector_public_id}
              options={sectorOptions}
              placeholder={t("loans.fields.sectorPlaceholder")}
              isClearable
              onChange={(next) =>
                setForm((current) => ({
                  ...current,
                  sector_public_id: next,
                  // Reset sub-sector when the parent sector changes.
                  sub_sector_public_id:
                    next === current.sector_public_id
                      ? current.sub_sector_public_id
                      : "",
                }))
              }
              error={errors.sector_public_id}
            />
            <Select
              label={t("loans.fields.subSector")}
              value={form.sub_sector_public_id}
              options={subSectorOptions}
              placeholder={t("loans.fields.subSectorPlaceholder")}
              isClearable
              onChange={(next) => set("sub_sector_public_id", next)}
              error={errors.sub_sector_public_id}
              disabled={!form.sector_public_id}
            />
          </div>
          <TextField
            label={t("loans.fields.financedActivityCode")}
            value={form.financed_activity_code}
            onChange={(event) =>
              set("financed_activity_code", event.target.value)
            }
            error={errors.financed_activity_code}
          />
          <TextField
            label={t("loans.fields.activityAddress")}
            value={form.activity_address}
            onChange={(event) => set("activity_address", event.target.value)}
            error={errors.activity_address}
          />
          <TextField
            label={t("loans.fields.entrepreneurAddress")}
            value={form.entrepreneur_address}
            onChange={(event) =>
              set("entrepreneur_address", event.target.value)
            }
            error={errors.entrepreneur_address}
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
