"use client";

import { useCallback, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  fetchExerciseClosings,
  type ExerciseClosing,
} from "@/lib/api/exercise-closings";
import {
  createResultAppropriation,
  fetchResultAppropriations,
  type ResultAppropriation,
} from "@/lib/api/result-appropriations";
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
import {
  LedgerAccountPicker,
  type LedgerAccountOption,
} from "../../_components/LedgerAccountPicker";

type Line = { key: number; account: LedgerAccountOption | null; amount: string };

/**
 * P16c — Comptabilité › Affectation du résultat.
 *
 * L'assemblée générale décide ce que devient le résultat porté au 131 (ou au 132)
 * par la clôture : réserve légale, autres réserves, report à nouveau, dividendes.
 * L'écran n'invente aucune répartition — c'est la décision de l'assemblée — mais
 * il rappelle le montant à répartir et affiche le reste à affecter, parce que
 * l'API refuse une répartition qui ne tombe pas juste.
 */
export default function ResultAppropriationsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  // Hooks called unconditionally, then combined. `isPlatformAdmin || useCanAny()`
  // short-circuits, so the hook goes uncalled whenever the first operand is true
  // and the hook order changes between renders.
  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canAllocatePerm = useCanAny(["accounting.exercise.appropriate"]);
  const canViewPerm = useCanAny(["accounting.audit.view"]);
  const canAllocate = isPlatformAdmin || canAllocatePerm;
  const canView = isPlatformAdmin || canViewPerm;

  const token = session.token;

  const appropriations = useApi<ResultAppropriation[]>(
    useCallback(async () => {
      if (!token || !canView) return [];
      return fetchResultAppropriations(token);
    }, [token, canView]),
    [token, canView],
  );

  // The closings are what says how much there is to allocate, and for which
  // exercises. Only a posted one has actually put anything in 131.
  const closings = useApi<ExerciseClosing[]>(
    useCallback(async () => {
      if (!token || !canView) return [];
      return fetchExerciseClosings(token);
    }, [token, canView]),
    [token, canView],
  );

  const agencies = useApi<Agency[]>(
    useCallback(async () => {
      if (!token || !canAllocate) return [];
      return (await fetchAgencies(token, { perPage: 100 })).data;
    }, [token, canAllocate]),
    [token, canAllocate],
  );

  const [agencyPublicId, setAgencyPublicId] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [decidedOn, setDecidedOn] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { key: 1, account: null, amount: "" },
  ]);
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

  function money(minor: number, currency = "XAF"): string {
    return `${(minor / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }

  /** Minor units from a typed major amount, tolerating a comma decimal mark. */
  function toMinor(value: string): number {
    const normalised = value.trim().replace(/\s/g, "").replace(",", ".");
    if (normalised === "") return 0;
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
  }

  const allocated = useMemo(
    () => lines.reduce((sum, line) => sum + (toMinor(line.amount) || 0), 0),
    [lines],
  );

  // The exercise being allocated, matched on the year and agency the form names.
  // Unposted closings are ignored: nothing has reached 131 yet.
  const target = useMemo(() => {
    const year = Number(fiscalYear.trim());
    if (!Number.isInteger(year)) return null;
    return (
      (closings.data ?? []).find(
        (closing) =>
          closing.fiscal_year === year &&
          closing.posted &&
          (agencyPublicId === "" ||
            closing.agency_public_id === agencyPublicId),
      ) ?? null
    );
  }, [closings.data, fiscalYear, agencyPublicId]);

  const toAllocate = target ? Math.abs(target.net_result_minor) : null;
  const remaining = toAllocate === null ? null : toAllocate - allocated;

  function setLine(key: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    const year = Number(fiscalYear.trim());
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      setFormError(t("resultAppropriations.errors.year"));
      return;
    }
    if (decidedOn.trim() === "") {
      setFormError(t("resultAppropriations.errors.decidedOn"));
      return;
    }

    const allocations = lines
      .filter((line) => line.account !== null && line.amount.trim() !== "")
      .map((line) => ({
        ledger_account_public_id: line.account?.value ?? "",
        amount_minor: toMinor(line.amount),
      }));

    if (allocations.length === 0) {
      setFormError(t("resultAppropriations.errors.noAllocations"));
      return;
    }
    if (allocations.some((a) => !Number.isFinite(a.amount_minor) || a.amount_minor <= 0)) {
      setFormError(t("resultAppropriations.errors.amount"));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await createResultAppropriation(token, {
        ...(agencyPublicId ? { agency_public_id: agencyPublicId } : {}),
        fiscal_year: year,
        decided_on: decidedOn,
        allocations,
      });
      toast.success(t("resultAppropriations.created"));
      setLines([{ key: 1, account: null, amount: "" }]);
      appropriations.refetch();
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
      toast.success(t("resultAppropriations.finished"));
    } catch (cause) {
      toast.error(t("resultAppropriations.finishFailed"), localizeApiError(cause).generalMessage);
    } finally {
      setActing(null);
      appropriations.refetch();
    }
  }

  if (!canView) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("resultAppropriations.title")} />
        <Alert variant="warning">{t("resultAppropriations.forbidden")}</Alert>
      </div>
    );
  }

  const rows = appropriations.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("resultAppropriations.title")}
        description={t("resultAppropriations.description")}
      />

      {canAllocate ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {agencyOptions.length > 0 ? (
              <div className="sm:w-72">
                <Select
                  label={t("resultAppropriations.fields.agency")}
                  value={agencyPublicId}
                  options={agencyOptions}
                  placeholder={t("resultAppropriations.ownAgency")}
                  onChange={(next) => setAgencyPublicId(next)}
                />
              </div>
            ) : null}
            <div className="sm:w-36">
              <TextField
                label={t("resultAppropriations.fields.fiscalYear")}
                value={fiscalYear}
                inputMode="numeric"
                placeholder="2026"
                onChange={(event) => setFiscalYear(event.target.value)}
              />
            </div>
            <div className="sm:w-48">
              <TextField
                label={t("resultAppropriations.fields.decidedOn")}
                type="date"
                value={decidedOn}
                onChange={(event) => setDecidedOn(event.target.value)}
                hint={t("resultAppropriations.decidedOnHint")}
              />
            </div>
          </div>

          {/* What there is to allocate, taken from the posted clôture rather than
              from anything typed here. Without it the amount has to be looked up
              on another page and copied by hand, and the API's "must add up"
              refusal arrives with no way to see by how much. */}
          {toAllocate !== null && target ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-[var(--radius-field)] border border-border bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {t("resultAppropriations.toAllocate")}{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {money(toAllocate, target.currency)}
                </span>
                <span className="ml-2 text-xs">
                  ({target.result_account_code})
                </span>
              </span>
              <span className="text-muted-foreground">
                {t("resultAppropriations.remaining")}{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    remaining === 0 ? "text-foreground" : "text-amber-600"
                  }`}
                >
                  {money(remaining ?? 0, target.currency)}
                </span>
              </span>
            </div>
          ) : fiscalYear.trim() !== "" ? (
            <Alert variant="warning">
              {t("resultAppropriations.noPostedClosing")}
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <LedgerAccountPicker
                    label={t("resultAppropriations.fields.account")}
                    value={line.account}
                    resetKey={agencyPublicId}
                    onChange={(option) => setLine(line.key, { account: option })}
                  />
                </div>
                <div className="sm:w-48">
                  <TextField
                    label={t("resultAppropriations.fields.amount")}
                    value={line.amount}
                    inputMode="decimal"
                    onChange={(event) =>
                      setLine(line.key, { amount: event.target.value })
                    }
                  />
                </div>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((l) => l.key !== line.key),
                      )
                    }
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    key: Math.max(...current.map((l) => l.key)) + 1,
                    account: null,
                    amount: "",
                  },
                ])
              }
            >
              {t("resultAppropriations.addLine")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t("resultAppropriations.allocating")
                : t("resultAppropriations.allocate")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("resultAppropriations.preconditions")}
          </p>

          {formError ? <Alert variant="warning">{formError}</Alert> : null}
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">
                {t("resultAppropriations.columns.fiscalYear")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("resultAppropriations.columns.agency")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("resultAppropriations.columns.decidedOn")}
              </th>
              <th className="px-4 py-2 text-right font-semibold">
                {t("resultAppropriations.columns.amount")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("resultAppropriations.columns.source")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("resultAppropriations.columns.status")}
              </th>
              <th className="px-4 py-2 text-right font-semibold">
                {t("resultAppropriations.columns.action")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {appropriations.loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {t("resultAppropriations.empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.public_id}>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-foreground">
                    {row.fiscal_year}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {agencyLabelOf(row.agency_public_id)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {row.decided_on}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                    {money(row.amount_minor, row.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {row.source_account_code}
                  </td>
                  <td className="px-4 py-2.5">
                    {/* Same rule as the clôture: only `posted` means the réserves
                        have actually been credited. */}
                    <Badge tone={row.posted ? "success" : "warning"}>
                      {row.posted
                        ? t("resultAppropriations.status.posted")
                        : t("resultAppropriations.status.awaitingReview")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.posted ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => finish(row.journal_entry_public_id)}
                        disabled={acting !== null}
                      >
                        {acting === row.journal_entry_public_id
                          ? t("resultAppropriations.finishing")
                          : t("resultAppropriations.finish")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.some((row) => !row.posted) ? (
        <Alert variant="warning">
          {t("resultAppropriations.awaitingNotice")}
        </Alert>
      ) : null}
    </div>
  );
}
