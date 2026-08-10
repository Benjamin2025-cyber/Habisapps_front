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
import { useCanAny, useHasRole } from "@/lib/auth/permissions";

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
  const [consolidated, setConsolidated] = useState(false);
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
    setConsolidated(false);
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
  /**
   * Driven by what the definition advertises rather than by its code, so a new
   * consolidatable report needs no change here. A consolidated run rolls the
   * chart up through parent accounts and adds scope / parent / postable columns
   * per row; grand totals still count each movement once.
   */
  const supportsConsolidated =
    selected?.supported_parameters?.includes("consolidated") ?? false;

  /**
   * A consolidated run spans every agency, so the API requires institution-wide
   * ledger read — the same grant that gates an institution account's balance.
   * `accounting.audit.view`, which is all this page needs, does not confer it:
   * auditor and compliance-officer hold one and not the other. Offering the
   * choice to them would only produce a 403 on generate.
   */
  // Computed unconditionally, then OR'd: `a() || b()` would skip the second
  // hook whenever the first is true.
  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const hasInstitutionRead = useCanAny(["ledger.scope.institution.read"]);
  const canConsolidate = isPlatformAdmin || hasInstitutionRead;

  /**
   * Consolidation is institution-wide by nature: with no agency the rollup spans
   * every agency, which is the whole point of an institution grouping account
   * (571000 totalling 571001 + 571002…). Naming an agency narrows the run to that
   * agency's own tree — valid, but it is no longer the consolidated institution
   * figure. So the agency stops being required as soon as consolidation is on.
   */
  const agencyRequired = needsAgency && !consolidated;

  const canSubmit =
    !!selected &&
    (!agencyRequired || !!agencyId) &&
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
        // Only send an agency that was actually chosen: an empty string would be
        // rejected, and omitting it is what widens a consolidated run to the
        // whole institution.
        agency_public_id: needsAgency && agencyId !== "" ? agencyId : undefined,
        currency: needsCurrency ? currency.trim().toUpperCase() : undefined,
        period_starts_on: needsPeriod ? periodStart : undefined,
        period_ends_on: needsPeriod ? periodEnd : undefined,
        parameters:
          supportsConsolidated && consolidated
            ? { consolidated: true }
            : undefined,
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
            placeholder={
              agencyRequired
                ? t("reports.generateDrawer.agencyPlaceholder")
                : t("reports.generateDrawer.agencyAllPlaceholder")
            }
            isClearable={!agencyRequired}
            hint={
              agencyRequired
                ? undefined
                : t("reports.generateDrawer.agencyConsolidatedHint")
            }
            options={agencies.map((a) => ({
              value: a.public_id,
              label: a.code ? `${a.code} — ${a.name}` : a.name,
            }))}
          />
        ) : null}

        {supportsConsolidated && canConsolidate ? (
          <Select
            id="report-consolidated"
            label={t("reports.generateDrawer.consolidated")}
            value={consolidated ? "1" : "0"}
            onChange={(next) => setConsolidated(next === "1")}
            isSearchable={false}
            hint={t("reports.generateDrawer.consolidatedHint")}
            options={[
              { value: "0", label: t("reports.generateDrawer.consolidatedOff") },
              { value: "1", label: t("reports.generateDrawer.consolidatedOn") },
            ]}
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
