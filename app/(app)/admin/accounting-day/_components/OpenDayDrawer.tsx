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
  /** Platform admins choose scope (institution / a specific agency). */
  isPlatformAdmin: boolean;
  agencies: Agency[];
};

/**
 * Opens a new accounting day. Agency staff open their own agency's day (no
 * scope fields — the backend resolves it). Platform admins may instead open an
 * institution-wide day or pick a specific agency. The business date is optional;
 * left empty, the backend derives the next business date from the calendar.
 */
export function OpenDayDrawer({
  open,
  onClose,
  onSubmit,
  isPlatformAdmin,
  agencies,
}: Props) {
  const t = useTranslations();
  const [scope, setScope] = useState<AccountingDayScope>("agency");
  const [agencyPublicId, setAgencyPublicId] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setScope("agency");
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
    if (businessDate) payload.business_date = businessDate;
    if (isPlatformAdmin) {
      payload.scope = scope;
      if (scope === "agency" && agencyPublicId) {
        payload.agency_public_id = agencyPublicId;
      }
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
            disabled={submitting}
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

        {isPlatformAdmin ? (
          <Select
            id="accounting-day-scope"
            label={t("accountingDay.open.scopeLabel")}
            value={scope}
            onChange={(value) => setScope(value as AccountingDayScope)}
            isSearchable={false}
            hint={t("accountingDay.open.scopeHint")}
            options={[
              { value: "agency", label: t("accountingDay.scope.agency") },
              { value: "institution", label: t("accountingDay.scope.institution") },
            ]}
          />
        ) : null}

        {isPlatformAdmin && scope === "agency" ? (
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

        <TextField
          id="accounting-day-business-date"
          name="business_date"
          type="date"
          label={t("accountingDay.open.dateLabel")}
          value={businessDate}
          onChange={(event) => setBusinessDate(event.target.value)}
          hint={t("accountingDay.open.dateHint")}
        />
      </div>
    </Drawer>
  );
}
