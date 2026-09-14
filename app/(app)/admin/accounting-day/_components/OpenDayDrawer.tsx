"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import type { Agency } from "@/lib/api/agencies";
import type {
  AccountingDayScope,
  OpenAccountingDayPayload,
} from "@/lib/api/accounting-days";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: OpenAccountingDayPayload) => Promise<void>;
  /**
   * May open the institution's own period — the arrêté comptable. This is the
   * `accounting.scope.institution.manage` permission, not a role: head-office
   * accounting (chief-accountant) holds it as well as platform-admin.
   */
  canOpenInstitutionScope: boolean;
  /** Only platform admins may open *another* agency's day. */
  canOpenAnyAgency: boolean;
  /**
   * The institution's current business date, or null when it has no day open.
   *
   * An agency day runs inside the institution's date, so for agency scope this is
   * the only date it can open on — the field is shown as that date rather than as
   * a free choice, and the absence of one is said here instead of coming back as a
   * refusal.
   */
  institutionBusinessDate?: string | null;
  /** False for head-office actors, who carry no agency assignment. */
  hasOwnAgency: boolean;
  agencies: Agency[];
};

/**
 * Opens a new accounting day. Agency staff open their own agency's day (no
 * scope fields — the backend resolves it from their assignment). Actors who may
 * manage the institution period choose the scope instead; only platform admins
 * can additionally target a specific agency. The business date is optional;
 * left empty, the backend derives the next business date from the calendar.
 */
export function OpenDayDrawer({
  open,
  onClose,
  onSubmit,
  canOpenInstitutionScope,
  canOpenAnyAgency,
  hasOwnAgency,
  agencies,
  institutionBusinessDate = null,
}: Props) {
  const t = useTranslations();
  // Agency scope needs an agency the backend can resolve: the actor's own, or
  // an explicit one that only a platform admin may choose. Without either it
  // would be rejected, so head office defaults straight to institution scope.
  const canUseAgencyScope = canOpenAnyAgency || hasOwnAgency;
  const defaultScope: AccountingDayScope = canUseAgencyScope
    ? "agency"
    : "institution";
  const [scope, setScope] = useState<AccountingDayScope>(defaultScope);
  const [agencyPublicId, setAgencyPublicId] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setScope(defaultScope);
    setAgencyPublicId("");
    setBusinessDate("");
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const payload: OpenAccountingDayPayload = {};
    // Agency scope follows the institution; only the institution's own day takes a
    // date chosen here.
    const effectiveDate =
      scope === "agency" ? institutionBusinessDate ?? "" : businessDate;
    if (effectiveDate) payload.business_date = effectiveDate;
    if (canOpenInstitutionScope) {
      payload.scope = scope;
    }
    if (canOpenAnyAgency && scope === "agency" && agencyPublicId) {
      payload.agency_public_id = agencyPublicId;
    }
    try {
      await onSubmit(payload);
      reset();
    } catch (cause) {
      setError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const agencyOptions = agencies.map((agency) => ({
    value: agency.public_id,
    label: agency.code ? `${agency.code} — ${agency.name}` : agency.name,
  }));

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t("accountingDay.open.title")}
      description={t("accountingDay.open.description")}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={
              submitting || (scope === "agency" && !institutionBusinessDate)
            }
          >
            {submitting ? t("accountingDay.open.submitting") : t("accountingDay.open.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <Alert variant="danger" title={t("accountingDay.open.errorTitle")}>
            {error}
          </Alert>
        ) : null}

        {canOpenInstitutionScope ? (
          <Select
            id="accounting-day-scope"
            label={t("accountingDay.open.scopeLabel")}
            value={scope}
            onChange={(value) => setScope(value as AccountingDayScope)}
            isSearchable={false}
            hint={t("accountingDay.open.scopeHint")}
            options={[
              ...(canUseAgencyScope
                ? [{ value: "agency", label: t("accountingDay.scope.agency") }]
                : []),
              { value: "institution", label: t("accountingDay.scope.institution") },
            ]}
          />
        ) : null}

        {canOpenAnyAgency && scope === "agency" ? (
          <Select
            id="accounting-day-agency"
            label={t("accountingDay.open.agencyLabel")}
            value={agencyPublicId}
            onChange={setAgencyPublicId}
            placeholder={t("accountingDay.open.agencyPlaceholder")}
            isClearable
            hint={t("accountingDay.open.agencyHint")}
            options={agencyOptions}
          />
        ) : null}

        {scope === "agency" ? (
          institutionBusinessDate ? (
            <TextField
              id="accounting-day-business-date"
              name="business_date"
              type="date"
              label={t("accountingDay.open.dateLabel")}
              value={institutionBusinessDate}
              readOnly
              hint={t("accountingDay.open.dateFollowsInstitution")}
            />
          ) : (
            <Alert variant="warning">
              {t("accountingDay.open.institutionNotOpen")}
            </Alert>
          )
        ) : (
          <TextField
            id="accounting-day-business-date"
            name="business_date"
            type="date"
            label={t("accountingDay.open.dateLabel")}
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
            hint={t("accountingDay.open.dateHint")}
          />
        )}
      </div>
    </Drawer>
  );
}
