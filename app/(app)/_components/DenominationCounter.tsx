"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchDenominations,
  type Denomination,
} from "@/lib/api/denominations";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

export type DenominationLine = {
  denomination_public_id: string;
  count: number;
};

type Props = {
  currency?: string;
  /** When set, the counted total is compared against it (match/diff indicator). */
  targetMinor?: number | null;
  /** Reports the non-zero count lines + the counted total (minor) on every change. */
  onChange: (lines: DenominationLine[], totalMinor: number) => void;
};

/**
 * Cash-counting grid built on the denominations referential (P25). Used by
 * session open/close (P20) and cash-up reconciliation (P22). Reports the
 * `denomination_counts` payload + the counted total to the parent.
 */
export function DenominationCounter({ currency = "XAF", targetMinor, onChange }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetchDenominations(token, { perPage: 100 })
      .then((res) => {
        if (cancelled) return;
        setDenoms(
          res.data
            .filter((d) => d.status === "active" && d.currency === currency)
            .sort((a, b) => b.value_minor - a.value_minor),
        );
      })
      .catch(() => {
        if (!cancelled) setDenoms([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, currency]);

  const { lines, totalMinor } = useMemo(() => {
    const l: DenominationLine[] = [];
    let total = 0;
    for (const d of denoms) {
      const n = Number(counts[d.public_id] ?? "0");
      const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      if (count > 0) {
        l.push({ denomination_public_id: d.public_id, count });
        total += d.value_minor * count;
      }
    }
    return { lines: l, totalMinor: total };
  }, [denoms, counts]);

  // Report to parent. Serialized dep keeps it stable across renders.
  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    onChange(lines, totalMinor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, totalMinor]);

  const matchesTarget =
    targetMinor !== null && targetMinor !== undefined
      ? totalMinor === targetMinor
      : null;

  if (loading) {
    return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  }
  if (denoms.length === 0) {
    return (
      <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
        {t("denominationCounter.none")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("denominationCounter.title")}
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {denoms.map((d) => {
          const n = Number(counts[d.public_id] ?? "0");
          const lineTotal = Number.isFinite(n) && n > 0 ? d.value_minor * Math.floor(n) : 0;
          return (
            <div key={d.public_id} className="flex flex-col gap-1 rounded-[var(--radius-field)] border border-border px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium tabular-nums text-foreground">{d.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">×</span>
                <input
                  type="number"
                  min={0}
                  value={counts[d.public_id] ?? ""}
                  onChange={(e) => setCounts((c) => ({ ...c, [d.public_id]: e.target.value }))}
                  placeholder="0"
                  className="h-8 w-16 shrink-0 rounded-[var(--radius-field)] border border-input bg-background px-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <span className="truncate text-right text-xs tabular-nums text-muted-foreground">
                {lineTotal > 0 ? format.currencyMinor(lineTotal, { currency }) : "—"}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className={`flex items-center justify-between rounded-[var(--radius-field)] px-3 py-2 text-sm ${
          matchesTarget === false
            ? "border border-warning/30 bg-warning/10 text-warning"
            : matchesTarget === true
              ? "border border-success/30 bg-success/10 text-success"
              : "border border-border bg-muted/30 text-foreground"
        }`}
      >
        <span className="font-semibold">{t("denominationCounter.total")}</span>
        <span className="font-semibold tabular-nums">
          {format.currencyMinor(totalMinor, { currency })}
          {matchesTarget === false && targetMinor != null
            ? ` · ${t("denominationCounter.target", { target: format.currencyMinor(targetMinor, { currency }) })}`
            : ""}
        </span>
      </div>
    </div>
  );
}
