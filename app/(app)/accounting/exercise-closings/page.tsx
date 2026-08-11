"use client";

import { useCallback, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  createExerciseClosing,
  fetchExerciseClosings,
  type ExerciseClosing,
} from "@/lib/api/exercise-closings";
import {
  approveJournalEntry,
  postJournalEntry,
} from "@/lib/api/journal-entries";
import { localizeApiError } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";

/**
 * P16b — Comptabilité › Clôture de l'exercice.
 *
 * Solde les classes 6 et 7 et porte le résultat au 131 (bénéfice) ou au 132
 * (perte). La clôture crée une écriture **soumise** : rien n'est transféré avant
 * qu'elle ne soit approuvée puis comptabilisée depuis les écritures comptables.
 * L'interface le dit explicitement, parce qu'une clôture créée ressemble
 * exactement à une clôture faite.
 */
export default function ExerciseClosingsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canClosePerm = useCanAny(["accounting.exercise.close"]);
  const canViewPerm = useCanAny(["accounting.audit.view"]);
  const canClose = isPlatformAdmin || canClosePerm;
  const canView = isPlatformAdmin || canViewPerm;

  const token = session.token;

  const closings = useApi<ExerciseClosing[]>(
    useCallback(async () => {
      if (!token || !canView) return [];
      return fetchExerciseClosings(token);
    }, [token, canView]),
    [token, canView],
  );

  const agencies = useApi<Agency[]>(
    useCallback(async () => {
      if (!token || !canClose) return [];
      // Paginated envelope; the closing form only needs the list.
      return (await fetchAgencies(token, { perPage: 100 })).data;
    }, [token, canClose]),
    [token, canClose],
  );

  const [agencyPublicId, setAgencyPublicId] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Which row is mid-action, so only its buttons show a busy state.
  const [acting, setActing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const agencyOptions = useMemo(
    () =>
      (agencies.data ?? []).map((agency) => ({
        value: agency.public_id,
        label: `${agency.code} — ${agency.name}`,
      })),
    [agencies.data],
  );

  const agencyLabelOf = useCallback(
    (publicId: string | null) => {
      if (!publicId) return "—";
      const match = (agencies.data ?? []).find((a) => a.public_id === publicId);
      return match ? `${match.code} — ${match.name}` : publicId;
    },
    [agencies.data],
  );

  function money(minor: number, currency: string): string {
    // Minor units at scale 2, like every other amount in this app.
    return `${(minor / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    const year = Number(fiscalYear.trim());
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      setFormError(t("exerciseClosings.errors.year"));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await createExerciseClosing(token, {
        // Omitted rather than sent empty: the API falls back to the actor's own
        // agency, which is the right answer for agency staff.
        ...(agencyPublicId ? { agency_public_id: agencyPublicId } : {}),
        fiscal_year: year,
      });
      toast.success(t("exerciseClosings.created"));
      setFiscalYear("");
      closings.refetch();
    } catch (cause) {
      setFormError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }


  /**
   * Approve then post the entry that carries out this record, from here.
   *
   * The endpoints are the ordinary journal-entry ones and enforce the same
   * maker-checker: whoever drew this up cannot approve it, and will be refused. It
   * is done in place because the alternative was leaving the page, searching the
   * journal entries for a reference by hand, acting, and coming back to see whether
   * it took — for the one operation of the year that has to go right.
   */
  async function finish(entryPublicId: string | null) {
    if (!token || !entryPublicId) return;

    setActing(entryPublicId);
    try {
      await approveJournalEntry(token, entryPublicId);
      await postJournalEntry(token, entryPublicId);
      toast.success(t("exerciseClosings.finished"));
    } catch (cause) {
      toast.error(t("exerciseClosings.finishFailed"), localizeApiError(cause).generalMessage);
    } finally {
      setActing(null);
      closings.refetch();
    }
  }

  if (!canView) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("exerciseClosings.title")} />
        <Alert variant="warning">{t("exerciseClosings.forbidden")}</Alert>
      </div>
    );
  }

  const rows = closings.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("exerciseClosings.title")}
        description={t("exerciseClosings.description")}
      />

      {canClose ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {agencyOptions.length > 0 ? (
              <div className="sm:w-72">
                <Select
                  label={t("exerciseClosings.fields.agency")}
                  value={agencyPublicId}
                  options={agencyOptions}
                  placeholder={t("exerciseClosings.ownAgency")}
                  onChange={(next) => setAgencyPublicId(next)}
                />
              </div>
            ) : null}
            <div className="sm:w-40">
              <TextField
                label={t("exerciseClosings.fields.fiscalYear")}
                value={fiscalYear}
                inputMode="numeric"
                placeholder="2026"
                onChange={(event) => setFiscalYear(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t("exerciseClosings.closing")
                : t("exerciseClosings.close")}
            </Button>
          </div>

          {/* The two conditions that account for almost every refusal, said
              before the attempt rather than as an error afterwards. */}
          <p className="text-xs text-muted-foreground">
            {t("exerciseClosings.preconditions")}
          </p>

          {/* Every refusal this endpoint returns is a legitimate state of the
              books, not a failure: nothing to close, already closed, an earlier
              exercise still open, the accounting day not open. Red reads as
              "something is broken" and sends someone looking for a fault that is
              not there. */}
          {formError ? <Alert variant="warning">{formError}</Alert> : null}
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">
                {t("exerciseClosings.columns.fiscalYear")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("exerciseClosings.columns.agency")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("exerciseClosings.columns.period")}
              </th>
              <th className="px-4 py-2 text-right font-semibold">
                {t("exerciseClosings.columns.result")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("exerciseClosings.columns.carriedTo")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("exerciseClosings.columns.status")}
              </th>
              <th className="px-4 py-2 text-right font-semibold">
                {t("exerciseClosings.columns.action")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {closings.loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {t("exerciseClosings.empty")}
                </td>
              </tr>
            ) : (
              rows.map((closing) => (
                <tr key={closing.public_id}>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-foreground">
                    {closing.fiscal_year}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {agencyLabelOf(closing.agency_public_id)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {closing.opens_on} → {closing.closes_on}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                    {money(closing.net_result_minor, closing.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {closing.result_account_code}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {closing.net_result_minor < 0
                        ? t("exerciseClosings.perte")
                        : t("exerciseClosings.benefice")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {/* `posted` is the only state in which anything has actually
                        moved. Anything else is a clôture still awaiting review,
                        and must not read as a finished one. */}
                    <Badge tone={closing.posted ? "success" : "warning"}>
                      {closing.posted
                        ? t("exerciseClosings.status.posted")
                        : t("exerciseClosings.status.awaitingReview")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {closing.posted ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => finish(closing.journal_entry_public_id)}
                        disabled={acting !== null}
                      >
                        {acting === closing.journal_entry_public_id
                          ? t("exerciseClosings.finishing")
                          : t("exerciseClosings.finish")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.some((closing) => !closing.posted) ? (
        <Alert variant="warning">{t("exerciseClosings.awaitingNotice")}</Alert>
      ) : null}
    </div>
  );
}
