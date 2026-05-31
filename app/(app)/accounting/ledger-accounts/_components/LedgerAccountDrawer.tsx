"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Agency } from "@/lib/api/agencies";
import type {
  LedgerAccount,
  LedgerAccountClass,
  LedgerAccountCreatePayload,
  LedgerAccountUpdatePayload,
  LedgerNormalBalanceSide,
} from "@/lib/api/ledger-accounts";

export type LedgerAccountDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: LedgerAccountDrawerMode;
  initial?: LedgerAccount | null;
  agencies: ReadonlyArray<Agency>;
  /** Existing accounts offered as parent (the current one is excluded). */
  parentChoices: ReadonlyArray<LedgerAccount>;
  onClose: () => void;
  onSubmit: (
    payload: LedgerAccountCreatePayload | LedgerAccountUpdatePayload,
  ) => Promise<void>;
};

type FormState = {
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
  code: "",
  name: "",
  account_class: "",
  account_type: "",
  agency_public_id: "",
  parent_account_public_id: "",
  normal_balance_side: "",
  status: "",
};

const CLASSES: LedgerAccountClass[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

/** Conventional normal balance side for each class (suggested, overridable). */
const SIDE_BY_CLASS: Record<LedgerAccountClass, LedgerNormalBalanceSide> = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  equity: "credit",
  revenue: "credit",
};

export function LedgerAccountDrawer({
  open,
  mode,
  initial,
  agencies,
  parentChoices,
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
  }, [open, isEdit, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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

  const agencyOptions = useMemo(
    () =>
      agencies.map((agency) => ({
        value: agency.public_id,
        label: `${agency.code} — ${agency.name}`,
      })),
    [agencies],
  );

  const parentOptions = useMemo(
    () =>
      parentChoices
        .filter((account) => account.public_id !== initial?.public_id)
        .map((account) => ({
          value: account.public_id,
          label: `${account.code} — ${account.name}`,
        })),
    [parentChoices, initial?.public_id],
  );

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
        account_type: nullable(form.account_type),
        parent_account_public_id: nullable(form.parent_account_public_id),
        normal_balance_side: form.normal_balance_side || undefined,
        status: form.status || undefined,
      } satisfies LedgerAccountUpdatePayload;
    } else {
      payload = {
        agency_public_id: nullable(form.agency_public_id),
        code: form.code.trim(),
        name: form.name.trim(),
        account_class: (form.account_class || "asset") as LedgerAccountClass,
        account_type: nullable(form.account_type),
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
              onChange={(event) => set("code", event.target.value)}
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
              disabled={isEdit}
              hint={isEdit ? t("ledgerAccounts.fields.classEditHint") : undefined}
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
            {!isEdit ? (
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
            <Select
              label={t("ledgerAccounts.fields.parent")}
              value={form.parent_account_public_id}
              options={parentOptions}
              placeholder={t("ledgerAccounts.fields.parentPlaceholder")}
              isClearable
              onChange={(next) => set("parent_account_public_id", next)}
              error={errors.parent_account_public_id}
              hint={t("ledgerAccounts.fields.parentHint")}
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
