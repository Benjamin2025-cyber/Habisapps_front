"use client";

import { useCallback, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import {
  getInstitutionProfile,
  isInstitutionConfigured,
  updateInstitutionProfile,
  type InstitutionProfile,
  type InstitutionProfileUpdatePayload,
} from "@/lib/api/institution";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";

/** Text fields, in render order, grouped by the section they belong to. */
const IDENTITY_FIELDS = [
  "legal_name",
  "trade_name",
  "legal_form",
  "emf_category",
] as const;

/**
 * Identity fields that carry an explanatory hint. The legal name and the trade
 * name are routinely confused, and picking the wrong one puts the brand instead
 * of the legal person on a supervisory filing.
 */
const IDENTITY_HINTS = new Set<string>(["legal_name", "trade_name"]);

const REGULATORY_FIELDS = [
  "supervisory_authority",
  "approval_number",
  "registration_number",
  "tax_identification_number",
] as const;

const ADDRESS_FIELDS = [
  "address_line_1",
  "address_line_2",
  "po_box",
  "city",
  "region",
  "country",
] as const;

const CONTACT_FIELDS = [
  "phone_number",
  "fax_number",
  "email",
  "website",
] as const;

type TextFieldName =
  | (typeof IDENTITY_FIELDS)[number]
  | (typeof REGULATORY_FIELDS)[number]
  | (typeof ADDRESS_FIELDS)[number]
  | (typeof CONTACT_FIELDS)[number];

type FormState = Record<TextFieldName, string> & {
  approval_date: string;
  declared_reporting_currency: string;
  fiscal_year_start_month: string;
};

const EMPTY: FormState = {
  legal_name: "",
  trade_name: "",
  legal_form: "",
  emf_category: "",
  supervisory_authority: "",
  approval_number: "",
  registration_number: "",
  tax_identification_number: "",
  address_line_1: "",
  address_line_2: "",
  po_box: "",
  city: "",
  region: "",
  country: "",
  phone_number: "",
  fax_number: "",
  email: "",
  website: "",
  approval_date: "",
  declared_reporting_currency: "",
  fiscal_year_start_month: "",
};

function toForm(profile: InstitutionProfile): FormState {
  const next: FormState = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as Array<keyof FormState>) {
    if (key === "fiscal_year_start_month") continue;
    next[key] = (profile[key] as string | null) ?? "";
  }
  next.fiscal_year_start_month =
    profile.fiscal_year_start_month === null
      ? ""
      : String(profile.fiscal_year_start_month);
  return next;
}

/**
 * P — Paramétrage › Institution. The EMF's declared legal identity, used to
 * stamp supervisory filings (EMF/COBAC returns, attestations de mainlevée).
 *
 * A singleton, so there is no list and no create: the page reads and patches one
 * resource. Permissions `institution.profile.view` / `institution.profile.manage`.
 */
export default function InstitutionProfilePage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["institution.profile.view"]);
  const managePerm = useCanAny(["institution.profile.manage"]);
  const canView = isPlatformAdmin || viewPerm;
  const canManage = isPlatformAdmin || managePerm;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<InstitutionProfile> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return getInstitutionProfile(token);
    },
    [token],
  );

  const { data: profile, loading, error, refetch, setData } = useApi(fetcher, [
    token,
  ]);

  // Seed the form from whatever the server last returned. Adjusted during render
  // rather than in an effect: React re-runs the component immediately without
  // committing the intermediate state, so there is no cascading render and no
  // frame where the inputs show stale values.
  const [syncedFrom, setSyncedFrom] = useState<InstitutionProfile | null>(null);
  if (profile && profile !== syncedFrom) {
    setSyncedFrom(profile);
    setForm(toForm(profile));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !canManage) return;
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const month = form.fiscal_year_start_month.trim();
    const payload: InstitutionProfileUpdatePayload = {
      ...(Object.fromEntries(
        (Object.keys(EMPTY) as Array<keyof FormState>)
          .filter(
            (key) =>
              key !== "fiscal_year_start_month" &&
              key !== "declared_reporting_currency",
          )
          .map((key) => [key, nullable(form[key])]),
      ) as InstitutionProfileUpdatePayload),
      // Uppercased API-side too, but sending it normalised keeps the optimistic
      // value and the stored one identical.
      declared_reporting_currency: nullable(
        form.declared_reporting_currency.toUpperCase(),
      ),
      fiscal_year_start_month: month === "" ? null : Number(month),
    };

    try {
      const updated = await updateInstitutionProfile(token, payload);
      setData(updated);
      toast.success(
        t("institution.toast.savedTitle"),
        t("institution.toast.savedBody"),
      );
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        legal_name: t("institution.fields.legal_name"),
        trade_name: t("institution.fields.trade_name"),
        legal_form: t("institution.fields.legal_form"),
        emf_category: t("institution.fields.emf_category"),
        supervisory_authority: t("institution.fields.supervisory_authority"),
        approval_number: t("institution.fields.approval_number"),
        approval_date: t("institution.fields.approval_date"),
        registration_number: t("institution.fields.registration_number"),
        tax_identification_number: t(
          "institution.fields.tax_identification_number",
        ),
        address_line_1: t("institution.fields.address_line_1"),
        address_line_2: t("institution.fields.address_line_2"),
        po_box: t("institution.fields.po_box"),
        city: t("institution.fields.city"),
        region: t("institution.fields.region"),
        country: t("institution.fields.country"),
        phone_number: t("institution.fields.phone_number"),
        fax_number: t("institution.fields.fax_number"),
        email: t("institution.fields.email"),
        website: t("institution.fields.website"),
        declared_reporting_currency: t(
          "institution.fields.declared_reporting_currency",
        ),
        fiscal_year_start_month: t(
          "institution.fields.fiscal_year_start_month",
        ),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  if (session.status !== "authenticated" || !canView) return null;

  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: t(`institution.months.${index + 1}`),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("institution.pageTitle")}
        description={t("institution.pageDescription")}
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("institution.errorTitle")}
          action={
            <Button variant="ghost" size="sm" onClick={refetch}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      {/*
        The row is created by the first read, so its existence proves nothing:
        an unnamed institution still needs filling in before any filing goes out.
      */}
      {!loading && !error && !isInstitutionConfigured(profile) ? (
        <Alert variant="warning" title={t("institution.unconfiguredTitle")}>
          {t("institution.unconfiguredBody")}
        </Alert>
      ) : null}

      {generalError ? (
        <Alert variant="danger" title={t("institution.saveErrorTitle")}>
          {generalError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <Section title={t("institution.sections.identity")}>
          {IDENTITY_FIELDS.map((name) => (
            <TextField
              key={name}
              id={`institution-${name}`}
              name={name}
              label={t(`institution.fields.${name}`)}
              value={form[name]}
              onChange={(event) => set(name, event.target.value)}
              error={errors[name]}
              disabled={!canManage || loading}
              hint={
                IDENTITY_HINTS.has(name)
                  ? t(`institution.fields.${name}Hint`)
                  : undefined
              }
            />
          ))}
        </Section>

        <Section title={t("institution.sections.regulatory")}>
          {REGULATORY_FIELDS.map((name) => (
            <TextField
              key={name}
              id={`institution-${name}`}
              name={name}
              label={t(`institution.fields.${name}`)}
              value={form[name]}
              onChange={(event) => set(name, event.target.value)}
              error={errors[name]}
              disabled={!canManage || loading}
            />
          ))}
          <TextField
            id="institution-approval_date"
            name="approval_date"
            type="date"
            label={t("institution.fields.approval_date")}
            value={form.approval_date}
            onChange={(event) => set("approval_date", event.target.value)}
            error={errors.approval_date}
            disabled={!canManage || loading}
          />
        </Section>

        <Section title={t("institution.sections.address")}>
          {ADDRESS_FIELDS.map((name) => (
            <TextField
              key={name}
              id={`institution-${name}`}
              name={name}
              label={t(`institution.fields.${name}`)}
              value={form[name]}
              onChange={(event) => set(name, event.target.value)}
              error={errors[name]}
              disabled={!canManage || loading}
            />
          ))}
        </Section>

        <Section title={t("institution.sections.contact")}>
          {CONTACT_FIELDS.map((name) => (
            <TextField
              key={name}
              id={`institution-${name}`}
              name={name}
              type={name === "email" ? "email" : "text"}
              label={t(`institution.fields.${name}`)}
              value={form[name]}
              onChange={(event) => set(name, event.target.value)}
              error={errors[name]}
              disabled={!canManage || loading}
            />
          ))}
        </Section>

        <Section title={t("institution.sections.declared")}>
          <TextField
            id="institution-declared_reporting_currency"
            name="declared_reporting_currency"
            label={t("institution.fields.declared_reporting_currency")}
            value={form.declared_reporting_currency}
            onChange={(event) =>
              set("declared_reporting_currency", event.target.value)
            }
            error={errors.declared_reporting_currency}
            disabled={!canManage || loading}
            maxLength={3}
            hint={t("institution.fields.declaredCurrencyHint")}
          />
          <Select
            id="institution-fiscal_year_start_month"
            label={t("institution.fields.fiscal_year_start_month")}
            value={form.fiscal_year_start_month}
            options={monthOptions}
            placeholder={t("institution.fields.fiscalMonthPlaceholder")}
            isClearable
            isSearchable={false}
            onChange={(next) => set("fiscal_year_start_month", next)}
            error={errors.fiscal_year_start_month}
            disabled={!canManage || loading}
            hint={t("institution.fields.fiscalMonthHint")}
          />
        </Section>

        {canManage ? (
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={submitting || loading}
            >
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
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
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** An emptied field clears the stored value rather than leaving it behind. */
function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
