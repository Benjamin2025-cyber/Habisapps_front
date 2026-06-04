"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import {
  fetchTellerSessions,
  type TellerSession,
} from "@/lib/api/teller-sessions";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { fetchTills, type Till } from "@/lib/api/tills";
import {
  createSessionReconciliation,
  fetchSessionReconciliations,
  type TillReconciliation,
} from "@/lib/api/till-reconciliations";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";
import {
  DenominationCounter,
  type DenominationLine,
} from "../../_components/DenominationCounter";

/**
 * P22 — Caisse › Consultation caisse. Inspecte une session de caisse : détails,
 * soldes théorique/réel et écart via les réconciliations, impression de
 * l'arrêté. Câblé sur `teller-sessions` + `/reconciliations`. La SAISIE d'un
 * arrêté (comptage des coupures) nécessite le référentiel Type monnaie (P25).
 */
export default function CashInspectionPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const toast = useToast();
  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.sessions.view"]);
  const reconManagePerm = useCanAny(["cash.reconciliations.manage"]);
  const canView = isPlatformAdmin || viewPerm;
  const canReconcile = isPlatformAdmin || reconManagePerm;

  const [reconOpen, setReconOpen] = useState(false);
  const [reconLines, setReconLines] = useState<DenominationLine[]>([]);
  const [reconNotes, setReconNotes] = useState("");
  const [reconSubmitting, setReconSubmitting] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<TellerSession[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [tills, setTills] = useState<Till[]>([]);
  const [tellers, setTellers] = useState<StaffUser[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [recons, setRecons] = useState<TillReconciliation[]>([]);
  const [loadingRecons, setLoadingRecons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server-side filters (#29) — the index now exposes filter[...] params.
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fTill, setFTill] = useState("");
  const [fTeller, setFTeller] = useState("");
  const [fStatus, setFStatus] = useState("");
  const debFrom = useDebouncedValue(fFrom, 400);
  const debTo = useDebouncedValue(fTo, 400);

  // Bounded referentials for labels + filter dropdowns (loaded once).
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchTills(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchStaffUsers(token, { perPage: 100 }).catch(() => ({ data: [] })),
    ]).then(([tl, st]) => {
      if (cancelled) return;
      setTills(tl.data as Till[]);
      setTellers(st.data as StaffUser[]);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Sessions are fetched server-side from the current filters (#29) — no more
  // load-all. Re-runs whenever a filter changes (dates debounced).
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setSessionsLoading(true);
    fetchTellerSessions(token, {
      perPage: 100,
      sort: "-business_date",
      status: fStatus || undefined,
      businessDateFrom: debFrom || undefined,
      businessDateTo: debTo || undefined,
      tillPublicId: fTill || undefined,
      tellerUserPublicId: fTeller || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setSessions(res.data);
        setSessionsTotal(res.meta.pagination.total);
      })
      .catch(() => {
        if (cancelled) return;
        setSessions([]);
        setSessionsTotal(0);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, fStatus, debFrom, debTo, fTill, fTeller]);

  const tillLabelOf = useCallback(
    (id: string | null) => {
      const till = tills.find((x) => x.public_id === id);
      return till ? `${till.code} — ${till.name}` : (id ?? "—");
    },
    [tills],
  );
  const tellerNameOf = useCallback(
    (id: string | null) =>
      id ? (tellers.find((u) => u.public_id === id)?.name ?? id) : "—",
    [tellers],
  );

  const selected = sessions.find((s) => s.public_id === sessionId) ?? null;
  const currency = selected?.currency ?? "XAF";

  useEffect(() => {
    if (!token || !sessionId) {
      setRecons([]);
      return;
    }
    let cancelled = false;
    setLoadingRecons(true);
    setError(null);
    fetchSessionReconciliations(token, sessionId)
      .then((r) => {
        if (!cancelled) setRecons(r);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  const sessionOptions = useMemo(
    () =>
      sessions.map((s) => ({
        value: s.public_id,
        label: `${tillLabelOf(s.till_public_id)} · ${s.business_date ?? "—"} · ${t(`cashInspection.status.${s.status}`)}`,
      })),
    [sessions, tillLabelOf, t],
  );

  // Filter dropdowns come from the bounded tills/tellers referentials.
  const tillFilterOptions = useMemo(
    () => tills.map((x) => ({ value: x.public_id, label: `${x.code} — ${x.name}` })),
    [tills],
  );

  const tellerFilterOptions = useMemo(
    () => tellers.map((u) => ({ value: u.public_id, label: u.name })),
    [tellers],
  );

  const filtersActive = !!(fFrom || fTo || fTill || fTeller || fStatus);

  function resetFilters() {
    setFFrom("");
    setFTo("");
    setFTill("");
    setFTeller("");
    setFStatus("");
  }

  function money(minor: number | null | undefined): string {
    if (minor === null || minor === undefined) return "—";
    return format.currencyMinor(minor, { currency });
  }

  if (session.status !== "authenticated" || !canView) return null;

  function handlePrint() {
    if (!selected) return;
    openBrandedReport({
      documentTitle: `${t("cashInspection.print.fileName")}-${tillLabelOf(selected.till_public_id)}`,
      heading: t("cashInspection.print.heading"),
      subheading: `${tillLabelOf(selected.till_public_id)} · ${selected.business_date ?? ""}`,
      meta: [
        { label: t("cashInspection.fields.teller"), value: tellerNameOf(selected.teller_user_public_id) },
        { label: t("cashInspection.fields.status"), value: selected.status },
        { label: t("cashInspection.fields.opening"), value: money(selected.opening_declaration_minor) },
        { label: t("cashInspection.fields.closing"), value: money(selected.closing_declaration_minor) },
      ],
      columns: [
        t("cashInspection.recon.countedAt"),
        t("cashInspection.recon.theoretical"),
        t("cashInspection.recon.actual"),
        t("cashInspection.recon.difference"),
        t("cashInspection.recon.status"),
      ],
      rows: recons.map((r) => [
        r.counted_at ? r.counted_at.slice(0, 16).replace("T", " ") : "—",
        money(r.theoretical_balance_minor),
        money(r.actual_balance_minor),
        money(r.difference_minor),
        r.status,
      ]),
      numericColumns: [1, 2, 3],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("cashInspection.recon.empty"),
    });
  }

  async function submitRecon() {
    if (!token || !sessionId) return;
    setReconSubmitting(true);
    setReconError(null);
    try {
      await createSessionReconciliation(token, sessionId, {
        currency,
        notes: reconNotes.trim() || null,
        denomination_counts: reconLines,
      });
      toast.success(t("cashInspection.recon.createdTitle"));
      setReconOpen(false);
      setReconLines([]);
      setReconNotes("");
      const fresh = await fetchSessionReconciliations(token, sessionId);
      setRecons(fresh);
    } catch (cause) {
      setReconError(localizeApiError(cause).generalMessage);
    } finally {
      setReconSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("cashInspection.pageTitle")}
        description={t("cashInspection.pageDescription")}
        actions={
          selected ? (
            <div className="flex gap-2">
              {canReconcile && selected.status === "open" ? (
                <Button variant="primary" size="md" onClick={() => { setReconLines([]); setReconNotes(""); setReconError(null); setReconOpen(true); }}>
                  {t("cashInspection.recon.create")}
                </Button>
              ) : null}
              <Button variant="outline" size="md" onClick={handlePrint}>
                {t("cashInspection.print.action")}
              </Button>
            </div>
          ) : null
        }
      />

      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-4">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("cashInspection.filters.title")}
            </span>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                {t("cashInspection.filters.reset")}
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TextField
              label={t("cashInspection.filters.from")}
              type="date"
              value={fFrom}
              onChange={(e) => setFFrom(e.target.value)}
            />
            <TextField
              label={t("cashInspection.filters.to")}
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
            />
            <Select
              label={t("cashInspection.filters.till")}
              value={fTill}
              options={tillFilterOptions}
              placeholder={t("cashInspection.filters.tillAll")}
              isClearable
              onChange={setFTill}
            />
            <Select
              label={t("cashInspection.filters.teller")}
              value={fTeller}
              options={tellerFilterOptions}
              placeholder={t("cashInspection.filters.tellerAll")}
              isClearable
              onChange={setFTeller}
            />
            <Select
              label={t("cashInspection.filters.status")}
              value={fStatus}
              options={[
                { value: "open", label: t("cashInspection.status.open") },
                { value: "closed", label: t("cashInspection.status.closed") },
              ]}
              placeholder={t("cashInspection.filters.statusAll")}
              isClearable
              onChange={setFStatus}
            />
          </div>
          {sessionsTotal > sessions.length ? (
            <p className="text-xs text-warning">
              {t("cashInspection.filters.tooMany", {
                shown: sessions.length,
                total: sessionsTotal,
              })}
            </p>
          ) : null}
        </div>

        {/* Narrowed session picker */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="inspect-session"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t("cashInspection.sessionLabel")}
            </label>
            <span className="text-xs text-muted-foreground">
              {t("cashInspection.filters.match", { count: sessions.length })}
            </span>
          </div>
          <Select
            id="inspect-session"
            value={sessionId}
            options={sessionOptions}
            placeholder={
              sessionsLoading
                ? t("common.loading")
                : sessions.length === 0
                  ? t("cashInspection.filters.none")
                  : t("cashInspection.sessionPlaceholder")
            }
            onChange={setSessionId}
          />
        </div>
      </section>

      {selected ? (
        <>
          {/* Session detail */}
          <section className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[var(--radius-card)] border border-border bg-background p-5 sm:grid-cols-4">
            <Field label={t("cashInspection.fields.till")} value={tillLabelOf(selected.till_public_id)} />
            <Field label={t("cashInspection.fields.teller")} value={tellerNameOf(selected.teller_user_public_id)} />
            <Field label={t("cashInspection.fields.businessDate")} value={selected.business_date ?? "—"} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                {t("cashInspection.fields.status")}
              </span>
              <Badge tone={selected.status === "open" ? "success" : "neutral"}>
                {t(`cashInspection.status.${selected.status}`)}
              </Badge>
            </div>
            <Field label={t("cashInspection.fields.opening")} value={money(selected.opening_declaration_minor)} strong />
            <Field label={t("cashInspection.fields.closing")} value={money(selected.closing_declaration_minor)} strong />
            <Field label={t("cashInspection.fields.openedAt")} value={selected.opened_at ? selected.opened_at.slice(0, 16).replace("T", " ") : "—"} />
            <Field label={t("cashInspection.fields.closedAt")} value={selected.closed_at ? selected.closed_at.slice(0, 16).replace("T", " ") : "—"} />
          </section>

          {error ? (
            <Alert variant="danger" title={t("cashInspection.recon.errorTitle")}>
              {localizeApiMessage(error)}
            </Alert>
          ) : null}

          {/* Arrêté-before-close hint: the session is open and no balanced
              cash-up has been recorded yet. Closing won't save one. */}
          {selected.status === "open" &&
          !recons.some((r) => r.difference_minor === 0) ? (
            <Alert
              variant="info"
              title={t("cashInspection.recon.beforeCloseTitle")}
              action={
                canReconcile ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReconLines([]);
                      setReconNotes("");
                      setReconError(null);
                      setReconOpen(true);
                    }}
                  >
                    {t("cashInspection.recon.create")}
                  </Button>
                ) : undefined
              }
            >
              {t("cashInspection.recon.beforeCloseBody")}
            </Alert>
          ) : null}

          {/* Reconciliations */}
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
            <header className="flex items-center justify-between border-b border-border border-l-4 border-l-accent bg-accent/5 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("cashInspection.recon.title")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("cashInspection.recon.count", { count: recons.length })}
              </span>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-accent/5 text-xs">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold">{t("cashInspection.recon.countedAt")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t("cashInspection.recon.theoretical")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t("cashInspection.recon.actual")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t("cashInspection.recon.difference")}</th>
                  <th className="px-4 py-2 font-semibold">{t("cashInspection.recon.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingRecons && recons.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                ) : recons.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">{t("cashInspection.recon.empty")}</td></tr>
                ) : (
                  recons.map((r) => (
                    <tr key={r.public_id}>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {r.counted_at ? r.counted_at.slice(0, 16).replace("T", " ") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{money(r.theoretical_balance_minor)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{money(r.actual_balance_minor)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${r.difference_minor === 0 ? "text-success" : "text-danger"}`}>
                        {money(r.difference_minor)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={r.difference_minor === 0 ? "success" : "warning"}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-muted-foreground">
            {t("cashInspection.createNote")}
          </p>
        </>
      ) : null}

      {/* New cash-up / reconciliation (P25 denomination counting) */}
      <Drawer
        open={reconOpen}
        onClose={reconSubmitting ? () => undefined : () => setReconOpen(false)}
        title={t("cashInspection.recon.create")}
        description={t("cashInspection.recon.createHint")}
        widthClassName="sm:w-[34rem]"
        footer={
          <>
            <Button variant="ghost" size="md" type="button" onClick={() => setReconOpen(false)} disabled={reconSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="md" type="button" onClick={submitRecon} disabled={reconSubmitting || reconLines.length === 0}>
              {reconSubmitting ? t("common.loading") : t("cashInspection.recon.submit")}
            </Button>
          </>
        }
      >
        {reconError ? (
          <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {reconError}
          </p>
        ) : null}
        <div className="flex flex-col gap-4">
          <DenominationCounter
            currency={currency}
            onChange={(lines) => setReconLines(lines)}
          />
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("cashInspection.recon.notes")}
            </span>
            <textarea
              value={reconNotes}
              onChange={(e) => setReconNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>
      </Drawer>
    </>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={strong ? "font-semibold tabular-nums text-foreground" : "text-foreground"}>
        {value}
      </span>
    </div>
  );
}
