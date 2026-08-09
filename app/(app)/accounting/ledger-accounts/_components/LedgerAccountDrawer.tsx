"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Agency } from "@/lib/api/agencies";
import { classFromCode, LEDGER_ACCOUNT_CLASSES } from "@/lib/api/ledger-accounts";
import {
  LedgerAccountPicker,
  type LedgerAccountOption,
} from "@/app/(app)/_components/LedgerAccountPicker";
import type {
  LedgerAccount,
  LedgerAccountClass,
  LedgerAccountCreatePayload,
  LedgerAccountScope,
  LedgerAccountUpdatePayload,
  LedgerNormalBalanceSide,
} from "@/lib/api/ledger-accounts";

export type LedgerAccountDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: LedgerAccountDrawerMode;
  initial?: LedgerAccount | null;
  agencies: ReadonlyArray<Agency>;
  /**
   * May create/maintain institution-level grouping accounts
   * (`ledger.scope.institution.manage`). Without it the scope choice is not
   * offered at all, since only agency accounts are permitted.
   */
  canManageInstitutionScope: boolean;
  onClose: () => void;
  onSubmit: (
    payload: LedgerAccountCreatePayload | LedgerAccountUpdatePayload,
  ) => Promise<void>;
};

/**
 * `grouping` is `is_postable: false` — the account consolidates the accounts
 * beneath it and refuses entries of its own. Expressed as a named nature rather
 * than a raw flag because that is the accounting concept users are choosing.
 */
type AccountNature = "postable" | "grouping";

type FormState = {
  scope: LedgerAccountScope;
  nature: AccountNature;
  code: string;
  name: string;
  account_class: LedgerAccountClass | "";
  account_type: string;
  agency_public_id: string;
  parent_account_public_id: string;
  normal_balance_side: LedgerNormalBalanceSide | "";
  status: "active" | "inactive" | "suspended" | "";
};

const EMPTY: FormState = {
  scope: "agency",
  nature: "postable",
  code: "",
  name: "",
  account_class: "",
  account_type: "",
  agency_public_id: "",
  parent_account_public_id: "",
  normal_balance_side: "",
  status: "",
};

const CLASSES = LEDGER_ACCOUNT_CLASSES;

/**
 * Conventional normal balance side for each class (suggested, overridable).
 *
 * Classes 3, 4, 5 and 9 legitimately go both ways — client lending is a
 * debit-side class 3 while client deposits are credit-side, treasury holds both
 * cash and borrowings, and commitments given differ from those received. The
 * suggestion here is only the more common case; the field stays editable.
 */
const SIDE_BY_CLASS: Record<LedgerAccountClass, LedgerNormalBalanceSide> = {
  capitaux_permanents: "credit",
  valeurs_immobilisees: "debit",
  operations_clientele: "credit",
  tiers: "credit",
  tresorerie_interbancaire: "debit",
  charges: "debit",
  produits: "credit",
  soldes_intermediaires_gestion: "credit",
  hors_bilan: "debit",
};

export function LedgerAccountDrawer({
  open,
  mode,
  initial,
  agencies,
  canManageInstitutionScope,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [parent, setParent] = useState<LedgerAccountOption | null>(null);
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
        scope: initial.scope,
        nature: initial.is_postable ? "postable" : "grouping",
        code: initial.code ?? "",
        name: initial.name ?? "",
        account_class: initial.account_class,
        account_type: initial.account_type ?? "",
        agency_public_id: initial.agency_public_id ?? "",
        parent_account_public_id: initial.parent_account_public_id ?? "",
        normal_balance_side: initial.normal_balance_side,
        status: initial.status === "archived" ? "" : initial.status,
      });
    } else {
      setForm(EMPTY);
    }
    if (!isEdit) setParent(null);
  }, [open, isEdit, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * In PCEMF the class is the leading digit of the code, and the API refuses any
   * other combination — so deriving it here removes a choice that could only be
   * made wrongly. A code that starts with something else leaves the field alone.
   */
  function onCodeChange(next: string) {
    const derived = classFromCode(next);
    setForm((current) => ({
      ...current,
      code: next,
      account_class: derived ?? current.account_class,
      normal_balance_side:
        derived && current.normal_balance_side === ""
          ? SIDE_BY_CLASS[derived]
          : current.normal_balance_side,
    }));
  }

  /** Picking a class on creation pre-fills the normal side if still empty. */
  function onClassChange(next: LedgerAccountClass | "") {
    setForm((current) => ({
      ...current,
      account_class: next,
      normal_balance_side:
        !isEdit && next && current.normal_balance_side === ""
          ? SIDE_BY_CLASS[next]
          : current.normal_balance_side,
    }));
  }

  /**
   * An institution account carries no agency and is always a grouping account
   * (the API rejects either combination), so switching scope clears both rather
   * than letting the user submit something that cannot be accepted.
   */
  function onScopeChange(next: LedgerAccountScope) {
    setForm((current) => ({
      ...current,
      scope: next,
      agency_public_id: next === "institution" ? "" : current.agency_public_id,
      nature: next === "institution" ? "grouping" : current.nature,
      // A parent legal under the old scope may be illegal under the new one.
      parent_account_public_id: "",
    }));
    // A parent legal under the old scope may be illegal under the new one.
    setParent(null);
  }

  const isInstitutionScope = form.scope === "institution";

  const agencyOptions = useMemo(
    () =>
      agencies.map((agency) => ({
        value: agency.public_id,
        label: `${agency.code} — ${agency.name}`,
      })),
    [agencies],
  );


  const natureOptions: Array<{ value: AccountNature; label: string }> = [
    { value: "postable", label: t("ledgerAccounts.nature.postable") },
    { value: "grouping", label: t("ledgerAccounts.nature.grouping") },
  ];

  const statusOptions: Array<{
    value: "active" | "inactive" | "suspended";
    label: string;
  }> = [
    { value: "active", label: t("ledgerAccounts.status.active") },
    { value: "inactive", label: t("ledgerAccounts.status.inactive") },
    { value: "suspended", label: t("ledgerAccounts.status.suspended") },
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    let payload: LedgerAccountCreatePayload | LedgerAccountUpdatePayload;
    if (isEdit) {
      payload = {
        name: form.name.trim(),
        // Only send the class when it changed. A class picked by mistake must be
        // fixable — PCEMF codes cannot be reinvented, so an uncorrectable class
        // would strand its code. The API accepts the change while the account has
        // no movements and refuses it afterwards, because reclassifying would
        // restate figures already reported.
        account_class:
          initial && form.account_class && initial.account_class !== form.account_class
            ? (form.account_class as LedgerAccountClass)
            : undefined,
        account_type: nullable(form.account_type),
        // Only send is_postable when it actually changed: an unchanged grouping
        // account would otherwise be re-asserted as postable and rejected.
        is_postable:
          initial && initial.is_postable !== (form.nature === "postable")
            ? form.nature === "postable"
            : undefined,
        parent_account_public_id: nullable(form.parent_account_public_id),
        normal_balance_side: form.normal_balance_side || undefined,
        status: form.status || undefined,
      } satisfies LedgerAccountUpdatePayload;
    } else {
      payload = {
        scope: form.scope,
        // An institution account never carries an agency, and the API refuses
        // the pair outright rather than ignoring it.
        agency_public_id: isInstitutionScope
          ? undefined
          : nullable(form.agency_public_id),
        code: form.code.trim(),
        name: form.name.trim(),
        // No default: a PCEMF class is an accounting decision, not something to
        // guess. Left empty, the API's `required` rule returns a field error
        // that handleSubmit's catch already surfaces on this input.
        account_class: form.account_class as LedgerAccountClass,
        account_type: nullable(form.account_type),
        is_postable: isInstitutionScope ? undefined : form.nature === "postable",
        parent_account_public_id: nullable(form.parent_account_public_id),
        normal_balance_side: (form.normal_balance_side ||
          "debit") as LedgerNormalBalanceSide,
        status: form.status || undefined,
      } satisfies LedgerAccountCreatePayload;
    }

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        code: t("ledgerAccounts.fields.code"),
        name: t("ledgerAccounts.fields.name"),
        account_class: t("ledgerAccounts.fields.class"),
        account_type: t("ledgerAccounts.fields.type"),
        agency_public_id: t("ledgerAccounts.fields.agency"),
        scope: t("ledgerAccounts.fields.scope"),
        is_postable: t("ledgerAccounts.fields.nature"),
        parent_account_public_id: t("ledgerAccounts.fields.parent"),
        normal_balance_side: t("ledgerAccounts.fields.normalSide"),
        status: t("ledgerAccounts.fields.status"),
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
          ? t("ledgerAccounts.drawer.titleEdit", {
              name: initial?.name ?? initial?.code ?? "",
            })
          : t("ledgerAccounts.drawer.titleCreate")
      }
      description={
        isEdit
          ? t("ledgerAccounts.drawer.editHint")
          : t("ledgerAccounts.drawer.createHint")
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
            form="ledger-account-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("ledgerAccounts.drawer.create")}
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
        id="ledger-account-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <Section title={t("ledgerAccounts.drawer.sectionIdentity")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("ledgerAccounts.fields.code")}
              value={form.code}
              onChange={(event) => onCodeChange(event.target.value)}
              error={errors.code}
              disabled={isEdit}
              required={!isEdit}
              hint={isEdit ? t("ledgerAccounts.fields.codeEditHint") : undefined}
            />
            <Select
              label={t("ledgerAccounts.fields.class")}
              value={form.account_class}
              options={CLASSES.map((c) => ({
                value: c,
                label: t(`ledgerAccounts.class.${c}`),
              }))}
              placeholder={t("ledgerAccounts.fields.classPlaceholder")}
              onChange={(next) => onClassChange(next as LedgerAccountClass | "")}
              error={errors.account_class}
              required
              hint={
                isEdit
                  ? t("ledgerAccounts.fields.classEditHint")
                  : t("ledgerAccounts.fields.classDerivedHint")
              }
            />
            <TextField
              label={t("ledgerAccounts.fields.name")}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              error={errors.name}
              required
              className="sm:col-span-2"
            />
          </div>
        </Section>

        <Section title={t("ledgerAccounts.drawer.sectionStructure")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!isEdit && canManageInstitutionScope ? (
              <Select
                label={t("ledgerAccounts.fields.scope")}
                value={form.scope}
                options={[
                  { value: "agency", label: t("ledgerAccounts.scope.agency") },
                  {
                    value: "institution",
                    label: t("ledgerAccounts.scope.institution"),
                  },
                ]}
                isSearchable={false}
                onChange={(next) => onScopeChange(next as LedgerAccountScope)}
                error={errors.scope}
                hint={t("ledgerAccounts.fields.scopeHint")}
              />
            ) : null}
            {!isEdit && !isInstitutionScope ? (
              <Select
                label={t("ledgerAccounts.fields.agency")}
                value={form.agency_public_id}
                options={agencyOptions}
                placeholder={t("ledgerAccounts.fields.agencyPlaceholder")}
                isClearable
                onChange={(next) => set("agency_public_id", next)}
                error={errors.agency_public_id}
                hint={t("ledgerAccounts.fields.agencyHint")}
              />
            ) : null}
            {isInstitutionScope ? (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t("ledgerAccounts.drawer.institutionGroupingNote")}
              </p>
            ) : (
              <Select
                label={t("ledgerAccounts.fields.nature")}
                value={form.nature}
                options={natureOptions}
                isSearchable={false}
                onChange={(next) => set("nature", next as AccountNature)}
                error={errors.is_postable}
                hint={t("ledgerAccounts.fields.natureHint")}
              />
            )}
            <LedgerAccountPicker
              label={t("ledgerAccounts.fields.parent")}
              value={parent}
              onChange={(option) => {
                setParent(option);
                set("parent_account_public_id", option?.value ?? "");
              }}
              initialValuePublicId={initial?.parent_account_public_id ?? null}
              placeholder={t("ledgerAccounts.fields.parentPlaceholder")}
              error={errors.parent_account_public_id}
              hint={t("ledgerAccounts.fields.parentHint")}
              resetKey={`${form.scope}:${form.agency_public_id}`}
              /*
               * A consolidated chart flows one way: agency detail accounts roll up
               * into institution grouping accounts. So an institution account may
               * only sit under another institution account, and an agency account
               * under an institution account or one of its own agency — never
               * under another agency's. Offering an illegal parent would only
               * produce a 422 on save.
               */
              filter={(account) => {
                if (account.public_id === initial?.public_id) return false;
                if (isInstitutionScope) return account.scope === "institution";
                return (
                  account.scope === "institution" ||
                  (form.agency_public_id !== "" &&
                    account.agency_public_id === form.agency_public_id)
                );
              }}
            />
            <TextField
              label={t("ledgerAccounts.fields.type")}
              value={form.account_type}
              onChange={(event) => set("account_type", event.target.value)}
              error={errors.account_type}
              hint={t("ledgerAccounts.fields.typeHint")}
              className={isEdit ? undefined : "sm:col-span-2"}
            />
          </div>
        </Section>

        <Section title={t("ledgerAccounts.drawer.sectionAccounting")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("ledgerAccounts.fields.normalSide")}
              value={form.normal_balance_side}
              options={[
                { value: "debit", label: t("ledgerAccounts.side.debit") },
                { value: "credit", label: t("ledgerAccounts.side.credit") },
              ]}
              placeholder={t("ledgerAccounts.fields.normalSidePlaceholder")}
              onChange={(next) =>
                set("normal_balance_side", next as LedgerNormalBalanceSide | "")
              }
              error={errors.normal_balance_side}
              required
              hint={t("ledgerAccounts.fields.normalSideHint")}
            />
            <Select
              label={t("ledgerAccounts.fields.status")}
              value={form.status}
              options={statusOptions}
              placeholder={t("ledgerAccounts.fields.statusPlaceholder")}
              isClearable
              onChange={(next) =>
                set("status", next as FormState["status"])
              }
              error={errors.status}
              hint={t("ledgerAccounts.fields.statusHint")}
            />
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
