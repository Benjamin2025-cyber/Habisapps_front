"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { fetchTellerSessions, type TellerSession } from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * "Ma caisse" — the teller's cash-drawer / session summary, wired to the real
 * teller-sessions data (P20). Shows the open session's till, declared opening
 * fund and business date, or a shortcut to open one.
 *
 * Live current-balance / écart are intentionally not shown: they require the
 * cash-ledger movements which tellers can't read, and there is no teller-
 * transactions list endpoint yet (see back-issue #24). They surface at closing.
 */
export function DashboardCashDrawerCard() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const myPublicId =
    session.status === "authenticated" ? session.user.public_id : null;

  const [mySession, setMySession] = useState<TellerSession | null>(null);
  const [tills, setTills] = useState<Till[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchTellerSessions(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchTills(token, { perPage: 100 }).catch(() => ({ data: [] })),
    ]).then(([s, tl]) => {
      if (cancelled) return;
      const open = (s.data as TellerSession[]).filter(
        (x) => x.status === "open" && x.teller_user_public_id === myPublicId,
      );
      setMySession(open[0] ?? null);
      setTills(tl.data as Till[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, myPublicId]);

  const till = mySession
    ? tills.find((x) => x.public_id === mySession.till_public_id)
    : null;
  const currency = mySession?.currency ?? "XAF";

  return (
    <section className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("dashboard.teller.drawer.title")}
        </h2>
        {!loading ? (
          <Badge tone={mySession ? "success" : "neutral"}>
            {mySession
              ? t("dashboard.teller.drawer.open")
              : t("dashboard.teller.drawer.closed")}
          </Badge>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : mySession ? (
          <>
            <Row
              label={t("dashboard.teller.drawer.till")}
              value={till ? `${till.code} — ${till.name}` : (mySession.till_public_id ?? "—")}
            />
            <Row
              label={t("dashboard.teller.drawer.date")}
              value={mySession.business_date ?? "—"}
            />
            <Row
              label={t("dashboard.teller.drawer.opening")}
              value={
                mySession.opening_declaration_minor != null
                  ? format.currencyMinor(mySession.opening_declaration_minor, {
                      currency,
                    })
                  : "—"
              }
              strong
            />
            <p className="text-xs text-muted-foreground">
              {t("dashboard.teller.drawer.liveNote")}
            </p>
            <Link
              href="/operations/sessions"
              className="mt-1 inline-flex h-10 items-center justify-center rounded-[var(--radius-field)] bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
            >
              {t("dashboard.teller.drawer.closeCta")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.teller.drawer.noneBody")}
            </p>
            <Link
              href="/operations/sessions"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-field)] bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
            >
              {t("dashboard.teller.drawer.openCta")}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-semibold tabular-nums text-foreground"
            : "tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
