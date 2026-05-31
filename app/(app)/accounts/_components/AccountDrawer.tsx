"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ClientPicker, type ClientOption } from "../../_components/ClientPicker";
import type { Agency } from "@/lib/api/agencies";
import type { LedgerAccount } from "@/lib/api/ledger-accounts";
import type { Client } from "@/lib/api/clients";
import type { AccountProduct } from "@/lib/api/account-products";
import type {
  CustomerAccount,
  CustomerAccountStatus,
  CustomerAccountWritePayload,
} from "@/lib/api/customer-accounts";

export type AccountDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: AccountDrawerMode;
  initial?: CustomerAccount | null;
  clients: ReadonlyArray<Client>;
  agencies: ReadonlyArray<Agency>;
  accountProducts: ReadonlyArray<AccountProduct>;
  ledgerAccounts: ReadonlyArray<LedgerAccount>;
  onClose: () => void;
  onSubmit: (payload: CustomerAccountWritePayload) => Promise<void>;
};

type FormState = {
  client_public_id: string;
  account_number: string;
  account_title: string;
  account_product_public_id: string;
  currency: string;
  agency_public_id: string;
  ledger_account_public_id: string;
  opened_on: string;
  closed_on: string;
  status: CustomerAccountStatus | "";
};

const EMPTY: FormState = {
  client_public_id: "",
  account_number: "",
  account_title: "",
  account_product_public_id: "",
  currency: "XAF",
  agency_public_id: "",
  ledger_account_public_id: "",
  opened_on: "",
  closed_on: "",
  status: "",
};

export function AccountDrawer({
  open,
  mode,
  initial,
  clients,
  agencies,
  accountProducts,
  ledgerAccounts,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  // Picker display option (carries the client's agency), tracked so the agency
  // field can auto-fill from the client and clear the client on agency change.
  const [clientOption, setClientOption] = useState<ClientOption | null>(null);
  // Once the user edits the title manually, stop auto-filling it from the client
  // (so joint / business / group account titles aren't overwritten).
  const [titleEdited, setTitleEdited] = useState(false);

  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (isEdit && initial) {
      setForm({
        client_public_id: initial.client_public_id ?? "",
        account_number: initial.account_number ?? "",
        account_title: initial.account_title ?? "",
        account_product_public_id: initial.account_product_public_id ?? "",
        currency: initial.currency ?? "XAF",
        agency_public_id: initial.agency_public_id ?? "",
        ledger_account_public_id: initial.ledger_account_public_id ?? "",
        opened_on: initial.opened_on ? initial.opened_on.slice(0, 10) : "",
        closed_on: initial.closed_on ? initial.closed_on.slice(0, 10) : "",
        status: initial.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, isEdit, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Seed the picker's label for the pre-selected client (edit mode) so it shows
  // without a search round-trip. The picker itself searches the backend.
  const initialClientOption = useMemo<ClientOption | null>(() => {
    const id = initial?.client_public_id;
    if (!id) return null;
    const client = clients.find((c) => c.public_id === id);
    const name = client
      ? [client.last_name?.toUpperCase(), client.first_name]
          .filter((part): part is string => !!part && part.length > 0)
          .join(" ") || id
      : id;
    return {
      value: id,
      label:
        client && client.client_reference ? `${name} — ${client.client_reference}` : name,
      agencyPublicId: client?.agency_public_id ?? initial?.agency_public_id ?? null,
      holderName: name,
    };
  }, [initial, clients]);

  // Seed / reset the picker selection alongside the form. Re-runs when the
  // resolved label arrives (clients load async in the parent).
  useEffect(() => {
    if (!open) return;
    setClientOption(isEdit && initial?.client_public_id ? initialClientOption : null);
    // Editing: keep the stored title as-is. Creating: title is auto-fillable.
    setTitleEdited(isEdit);
  }, [open, isEdit, initial, initialClientOption]);

  function handleClientChange(option: ClientOption | null) {
    setClientOption(option);
    set("client_public_id", option?.value ?? "");
    // Client carries its agency → reflect it on the agency field.
    if (option?.agencyPublicId) set("agency_public_id", option.agencyPublicId);
    // Default the account title to the holder's name until the user edits it.
    if (option && !titleEdited) set("account_title", option.holderName);
  }

  function handleAgencyChange(next: string) {
    set("agency_public_id", next);
    // Switching to a different agency invalidates a client from another one.
    if (next && clientOption?.agencyPublicId && clientOption.agencyPublicId !== next) {
      setClientOption(null);
      set("client_public_id", "");
    }
  }

  const agencyOptions = useMemo(
    () =>
      agencies.map((agency) => ({
        value: agency.public_id,
        label: `${agency.code} — ${agency.name}`,
      })),
    [agencies],
  );

  // Active ledger accounts in the account's agency (or institutional). A client
  // deposit account is typically a liability control account (e.g. dépôts).
  const ledgerAgency = form.agency_public_id || null;
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
        .map((a) => ({
          value: a.public_id,
          label: `${a.code} — ${a.name}`,
        })),
    [ledgerAccounts, ledgerAgency],
  );

  // The "type de compte" is really the linked account product. Only active
  // products are offered; an already-linked product is kept visible even if it
  // is no longer active so editing doesn't silently drop it.
  const productOptions = useMemo(() => {
    const options = accountProducts
      .filter((product) => product.status === "active")
      .map((product) => ({
        value: product.public_id,
        label: `${product.name} — ${t(`accountProducts.family.${product.account_family}`)}`,
      }));
    const current = initial?.account_product_public_id;
    if (current && !options.some((option) => option.value === current)) {
      const linked = accountProducts.find((p) => p.public_id === current);
      options.push({
        value: current,
        label: linked
          ? `${linked.name} — ${t(`accountProducts.family.${linked.account_family}`)}`
          : current,
      });
    }
    return options;
  }, [accountProducts, initial, t]);

  const statusOptions: Array<{ value: CustomerAccountStatus; label: string }> = [
    { value: "active", label: t("accounts.status.active") },
    { value: "suspended", label: t("accounts.status.suspended") },
    { value: "closed", label: t("accounts.status.closed") },
    { value: "archived", label: t("accounts.status.archived") },
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    // The update endpoint ignores client/account_number/agency — only the
    // create form carries them. Build the payload per mode.
    const payload: CustomerAccountWritePayload = isEdit
      ? {
          account_title: nullable(form.account_title),
          account_product_public_id: nullable(form.account_product_public_id),
          currency: nullable(form.currency)?.toUpperCase() ?? undefined,
          ledger_account_public_id: nullable(form.ledger_account_public_id),
          closed_on: nullable(form.closed_on),
          status: form.status || undefined,
        }
      : {
          client_public_id: form.client_public_id,
          account_number: form.account_number.trim(),
          account_title: nullable(form.account_title),
          account_product_public_id: nullable(form.account_product_public_id),
          currency: nullable(form.currency)?.toUpperCase(),
          agency_public_id: nullable(form.agency_public_id),
          ledger_account_public_id: nullable(form.ledger_account_public_id),
          opened_on: form.opened_on,
          status: form.status || undefined,
        };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        client_public_id: t("accounts.fields.client"),
        account_number: t("accounts.fields.number"),
        account_title: t("accounts.fields.title"),
        account_product_public_id: t("accounts.fields.product"),
        currency: t("accounts.fields.currency"),
        agency_public_id: t("accounts.fields.agency"),
        ledger_account_public_id: t("accounts.fields.ledgerAccount"),
        opened_on: t("accounts.fields.openedOn"),
        closed_on: t("accounts.fields.closedOn"),
        status: t("accounts.fields.status"),
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
          ? t("accounts.drawer.titleEdit", {
              number: initial?.account_number ?? "",
            })
          : t("accounts.drawer.titleCreate")
      }
      description={
        isEdit
          ? t("accounts.drawer.editHint")
          : t("accounts.drawer.createHint")
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
            form="account-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("accounts.drawer.create")}
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
        id="account-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <Section title={t("accounts.drawer.sectionHolder")}>
          <ClientPicker
            id="account-client"
            label={t("accounts.fields.client")}
            value={clientOption}
            agencyPublicId={form.agency_public_id || undefined}
            placeholder={t("accounts.fields.clientPlaceholder")}
            onChange={handleClientChange}
            error={errors.client_public_id}
            disabled={isEdit}
            required={!isEdit}
          />
          <Select
            label={t("accounts.fields.agency")}
            value={form.agency_public_id}
            options={agencyOptions}
            placeholder={t("accounts.fields.agencyPlaceholder")}
            isClearable
            onChange={handleAgencyChange}
            error={errors.agency_public_id}
            disabled={isEdit}
            hint={isEdit ? t("accounts.fields.agencyEditHint") : undefined}
          />
        </Section>

        <Section title={t("accounts.drawer.sectionAccount")}>
          <Select
            label={t("accounts.fields.product")}
            value={form.account_product_public_id}
            options={productOptions}
            placeholder={t("accounts.fields.productPlaceholder")}
            isClearable
            onChange={(next) => set("account_product_public_id", next)}
            error={errors.account_product_public_id}
            hint={t("accounts.fields.productHint")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("accounts.fields.number")}
              value={form.account_number}
              onChange={(event) => set("account_number", event.target.value)}
              error={errors.account_number}
              disabled={isEdit}
              required={!isEdit}
            />
            <TextField
              label={t("accounts.fields.currency")}
              value={form.currency}
              onChange={(event) => set("currency", event.target.value)}
              error={errors.currency}
              hint={t("accounts.fields.currencyHint")}
            />
            <TextField
              label={t("accounts.fields.title")}
              value={form.account_title}
              onChange={(event) => {
                setTitleEdited(true);
                set("account_title", event.target.value);
              }}
              error={errors.account_title}
              hint={t("accounts.fields.titleHint")}
              className="sm:col-span-2"
            />
          </div>
        </Section>

        <Section title={t("accounts.drawer.sectionAccounting")}>
          <Select
            label={t("accounts.fields.ledgerAccount")}
            value={form.ledger_account_public_id}
            options={ledgerOptions}
            placeholder={t("accounts.fields.ledgerAccountPlaceholder")}
            isClearable
            onChange={(next) => set("ledger_account_public_id", next)}
            error={errors.ledger_account_public_id}
            hint={
              ledgerOptions.length === 0
                ? t("accounts.fields.noLedgerAccounts")
                : t("accounts.fields.ledgerAccountHint")
            }
          />
        </Section>

        <Section title={t("accounts.drawer.sectionLifecycle")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("accounts.fields.openedOn")}
              type="date"
              value={form.opened_on}
              onChange={(event) => set("opened_on", event.target.value)}
              error={errors.opened_on}
              disabled={isEdit}
              required={!isEdit}
            />
            <TextField
              label={t("accounts.fields.closedOn")}
              type="date"
              value={form.closed_on}
              onChange={(event) => set("closed_on", event.target.value)}
              error={errors.closed_on}
            />
            {isEdit ? (
              <Select
                label={t("accounts.fields.status")}
                value={form.status}
                options={statusOptions}
                placeholder={t("accounts.fields.statusPlaceholder")}
                onChange={(next) =>
                  set("status", next as CustomerAccountStatus | "")
                }
                error={errors.status}
                className="sm:col-span-2"
              />
            ) : null}
          </div>
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
