"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import {
  fetchTellerSessions,
  type TellerSession,
} from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import {
  fetchSessionReconciliations,
  type TillReconciliation,
} from "@/lib/api/till-reconciliations";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";

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

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.sessions.view"]);
  const canView = isPlatformAdmin || viewPerm;

  const [sessions, setSessions] = useState<TellerSession[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [tellers, setTellers] = useState<StaffUser[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [recons, setRecons] = useState<TillReconciliation[]>([]);
  const [loadingRecons, setLoadingRecons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchTellerSessions(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchTills(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchStaffUsers(token, { perPage: 100 }).catch(() => ({ data: [] })),
    ]).then(([s, tl, st]) => {
      if (cancelled) return;
      setSessions(s.data as TellerSession[]);
      setTills(tl.data as Till[]);
      setTellers(st.data as StaffUser[]);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
        label: `${tillLabelOf(s.till_public_id)} · ${s.business_date ?? "—"} · ${s.status}`,
      })),
    [sessions, tillLabelOf],
  );

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

  return (
    <>
      <PageHeader
        title={t("cashInspection.pageTitle")}
        description={t("cashInspection.pageDescription")}
        actions={
          selected ? (
            <Button variant="outline" size="md" onClick={handlePrint}>
              {t("cashInspection.print.action")}
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:max-w-xl">
        <label
          htmlFor="inspect-session"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("cashInspection.sessionLabel")}
        </label>
        <Select
          id="inspect-session"
          value={sessionId}
          options={sessionOptions}
          placeholder={t("cashInspection.sessionPlaceholder")}
          onChange={setSessionId}
        />
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
