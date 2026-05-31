"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import {
  fetchTellerSessions,
  type TellerSession,
} from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";

/**
 * P22 — Édition › Brouillard de caisse. Vue jour-par-jour des sessions de
 * caisse (fonds d'ouverture/clôture, statut), filtrable par période, avec
 * impression. Câblé sur `teller-sessions` (+ tills/staff pour les libellés).
 * Le brouillard ligne-à-ligne des mouvements dépend d'un endpoint de liste
 * teller-transactions (back-issue #24).
 */
export default function CashDraftPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.reconciliations.view"]);
  const canView = isPlatformAdmin || viewPerm;

  const [sessions, setSessions] = useState<TellerSession[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [tellers, setTellers] = useState<StaffUser[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  const rows = useMemo(() => {
    return sessions
      .filter((s) => {
        const d = s.business_date ?? "";
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort((a, b) => (b.business_date ?? "").localeCompare(a.business_date ?? ""));
  }, [sessions, from, to]);

  function money(minor: number | null | undefined, currency: string): string {
    if (minor === null || minor === undefined) return "—";
    return format.currencyMinor(minor, { currency });
  }

  if (session.status !== "authenticated" || !canView) return null;

  function handlePrint() {
    openBrandedReport({
      documentTitle: t("cashDraft.print.fileName"),
      heading: t("cashDraft.print.heading"),
      subheading:
        from || to ? `${from || "…"} → ${to || "…"}` : t("cashDraft.print.allPeriods"),
      meta: [{ label: t("cashDraft.print.count"), value: String(rows.length) }],
      columns: [
        t("cashDraft.columns.date"),
        t("cashDraft.columns.till"),
        t("cashDraft.columns.teller"),
        t("cashDraft.columns.opening"),
        t("cashDraft.columns.closing"),
        t("cashDraft.columns.status"),
      ],
      rows: rows.map((s) => [
        s.business_date ?? "—",
        tillLabelOf(s.till_public_id),
        tellerNameOf(s.teller_user_public_id),
        money(s.opening_declaration_minor, s.currency ?? "XAF"),
        money(s.closing_declaration_minor, s.currency ?? "XAF"),
        s.status,
      ]),
      numericColumns: [3, 4],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("cashDraft.empty"),
    });
  }

  return (
    <>
      <PageHeader
        title={t("cashDraft.pageTitle")}
        description={t("cashDraft.pageDescription")}
        actions={
          <Button variant="outline" size="md" onClick={handlePrint} disabled={rows.length === 0}>
            {t("cashDraft.print.action")}
          </Button>
        }
      />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <TextField label={t("cashDraft.filters.from")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="sm:w-44">
          <TextField label={t("cashDraft.filters.to")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {t("cashDraft.count", { count: rows.length })}
        </span>
      </section>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold">{t("cashDraft.columns.date")}</th>
              <th className="px-4 py-2 font-semibold">{t("cashDraft.columns.till")}</th>
              <th className="px-4 py-2 font-semibold">{t("cashDraft.columns.teller")}</th>
              <th className="px-4 py-2 text-right font-semibold">{t("cashDraft.columns.opening")}</th>
              <th className="px-4 py-2 text-right font-semibold">{t("cashDraft.columns.closing")}</th>
              <th className="px-4 py-2 font-semibold">{t("cashDraft.columns.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{t("cashDraft.empty")}</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.public_id}>
                  <td className="px-4 py-2.5 tabular-nums text-foreground">{s.business_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-foreground">{tillLabelOf(s.till_public_id)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{tellerNameOf(s.teller_user_public_id)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{money(s.opening_declaration_minor, s.currency ?? "XAF")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{money(s.closing_declaration_minor, s.currency ?? "XAF")}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={s.status === "open" ? "success" : "neutral"}>
                      {t(`cashDraft.status.${s.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{t("cashDraft.lineLevelNote")}</p>
    </>
  );
}
