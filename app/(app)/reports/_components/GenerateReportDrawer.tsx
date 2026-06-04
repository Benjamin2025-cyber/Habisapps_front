"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import type { ReportDefinition } from "@/lib/api/report-definitions";
import { createReportRun, type ReportRun } from "@/lib/api/report-runs";
import { localizeApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Definitions whose report_type belongs to the current report page. */
  definitions: ReportDefinition[];
  onGenerated: (run: ReportRun) => void;
};

/**
 * Generates a report run from a seeded report definition (#28). Surfaces only
 * the parameters the chosen definition declares it requires
 * (`requires_agency` / `requires_currency` / `requires_period`).
 */
export function GenerateReportDrawer({ open, onClose, definitions, onGenerated }: Props) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [defId, setDefId] = useState("");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => definitions.find((d) => d.public_id === defId) ?? null,
    [definitions, defId],
  );

  // Default the definition when the drawer opens (or when there's only one).
  useEffect(() => {
    if (open && !defId && definitions.length > 0) {
      setDefId(definitions[0].public_id);
    }
  }, [open, defId, definitions]);

  // Load agencies once when any definition requires an agency.
  useEffect(() => {
    if (!token || !open) return;
    if (!definitions.some((d) => d.requires_agency)) return;
    let cancelled = false;
    fetchAgencies(token, { perPage: 100 })
      .then((res) => {
        if (!cancelled) setAgencies(res.data);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, open, definitions]);

  function reset() {
    setDefId("");
    setAgencyId("");
    setCurrency("XAF");
    setPeriodStart("");
    setPeriodEnd("");
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  const needsAgency = selected?.requires_agency ?? false;
  const needsCurrency = selected?.requires_currency ?? false;
  const needsPeriod = selected?.requires_period ?? false;

  const canSubmit =
    !!selected &&
    (!needsAgency || !!agencyId) &&
    (!needsCurrency || currency.trim().length === 3) &&
    (!needsPeriod || (!!periodStart && !!periodEnd)) &&
    !submitting;

  async function handleSubmit() {
    if (!token || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const run = await createReportRun(token, {
        report_definition_public_id: selected.public_id,
        agency_public_id: needsAgency ? agencyId : undefined,
        currency: needsCurrency ? currency.trim().toUpperCase() : undefined,
        period_starts_on: needsPeriod ? periodStart : undefined,
        period_ends_on: needsPeriod ? periodEnd : undefined,
      });
      reset();
      onGenerated(run);
    } catch (cause) {
      setError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t("reports.generateDrawer.title")}
      description={t("reports.generateDrawer.description")}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? t("reports.generateDrawer.submitting") : t("reports.generateDrawer.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <Alert variant="danger" title={t("reports.generateDrawer.errorTitle")}>
            {error}
          </Alert>
        ) : null}

        {definitions.length > 1 ? (
          <Select
            id="report-definition"
            label={t("reports.generateDrawer.definition")}
            value={defId}
            onChange={setDefId}
            options={definitions.map((d) => ({ value: d.public_id, label: d.name }))}
          />
        ) : selected ? (
          <div className="rounded-[var(--radius-field)] border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
            {selected.name}
          </div>
        ) : null}

        {selected?.description ? (
          <p className="text-xs text-muted-foreground">{selected.description}</p>
        ) : null}

        {needsAgency ? (
          <Select
            id="report-agency"
            label={t("reports.generateDrawer.agency")}
            value={agencyId}
            onChange={setAgencyId}
            placeholder={t("reports.generateDrawer.agencyPlaceholder")}
            options={agencies.map((a) => ({
              value: a.public_id,
              label: a.code ? `${a.code} — ${a.name}` : a.name,
            }))}
          />
        ) : null}

        {needsCurrency ? (
          <TextField
            id="report-currency"
            label={t("reports.generateDrawer.currency")}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            hint={t("reports.generateDrawer.currencyHint")}
          />
        ) : null}

        {needsPeriod ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="report-period-start"
              type="date"
              label={t("reports.generateDrawer.periodStart")}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <TextField
              id="report-period-end"
              type="date"
              label={t("reports.generateDrawer.periodEnd")}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
