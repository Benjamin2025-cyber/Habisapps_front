"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import {
  fetchReportRuns,
  type PaginatedReportRuns,
  type ReportRun,
} from "@/lib/api/report-runs";
import {
  fetchReportDefinitions,
  type ReportDefinition,
} from "@/lib/api/report-definitions";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";
import { GenerateReportDrawer } from "./GenerateReportDrawer";

type Props = {
  /** Report types this hub surfaces. Empty = none supported by the API (note). */
  types: ReadonlyArray<string>;
  title: string;
  description: string;
};

/** snake_case API field → human label (dynamic report data isn't i18n'd). */
function humanize(key: string): string {
  return key
    .replace(/_minor$/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function ReportsHub({ types, title, description }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["accounting.audit.view"]);
  const canView = isPlatformAdmin || viewPerm;

  const [preview, setPreview] = useState<ReportRun | null>(null);
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [genOpen, setGenOpen] = useState(false);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedReportRuns> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchReportRuns(token, { perPage: 100 });
    },
    [token],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [token]);

  // Report definitions drive generation: a page can generate any definition
  // whose report_type it surfaces.
  useEffect(() => {
    if (!token || types.length === 0) return;
    let cancelled = false;
    fetchReportDefinitions(token, { status: "active" })
      .then((defs) => {
        if (!cancelled) setDefinitions(defs);
      })
      .catch(() => {
        if (!cancelled) setDefinitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, types]);

  const matchingDefinitions = useMemo(
    () => definitions.filter((d) => types.includes(d.report_type)),
    [definitions, types],
  );
  const canGenerate = matchingDefinitions.length > 0;

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    if (types.length === 0) return [];
    return all.filter((r) => types.includes(r.summary?.report_type ?? ""));
  }, [data, types]);

  if (session.status !== "authenticated" || !canView) return null;

  function money(v: number, currency = "XAF"): string {
    return format.currencyMinor(v, { currency });
  }

  function fmt(key: string, val: unknown, currency: string): string {
    if (typeof val === "number") {
      return key.endsWith("_minor") ? money(val, currency) : format.number(val);
    }
    if (val === null || val === undefined) return "—";
    return String(val);
  }

  function summaryScalars(s: ReportRun["summary"]): Array<[string, unknown]> {
    if (!s) return [];
    return Object.entries(s).filter(
      ([k, v]) =>
        typeof v !== "object" &&
        !["report_type", "currency", "from", "to", "as_of_date"].includes(k),
    );
  }

  function handlePrint(run: ReportRun) {
    const s = run.summary ?? {};
    const currency = s.currency ?? "XAF";
    const rowsData = Array.isArray(s.rows) ? s.rows : [];
    const cols = rowsData.length > 0 ? Object.keys(rowsData[0]) : [];
    openBrandedReport({
      documentTitle: `${t("reports.print.fileName")}-${s.report_type ?? "report"}`,
      heading: t(`reports.types.${s.report_type}`),
      subheading:
        run.period_starts_on || run.period_ends_on
          ? `${run.period_starts_on ?? "…"} → ${run.period_ends_on ?? "…"}`
          : "",
      meta: summaryScalars(run.summary).map(([k, v]) => ({
        label: humanize(k),
        value: fmt(k, v, currency),
      })),
      columns: cols.map(humanize),
      rows: rowsData.map((r) => cols.map((c) => fmt(c, r[c], currency))),
      numericColumns: cols
        .map((c, i) => (c.endsWith("_minor") ? i : -1))
        .filter((i) => i >= 0),
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("reports.preview.noData"),
    });
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            variant="primary"
            size="md"
            disabled={!canGenerate}
            title={canGenerate ? undefined : t("reports.generateDisabled")}
            onClick={() => setGenOpen(true)}
          >
            {t("reports.generate")}
          </Button>
        }
      />

      {!canGenerate && types.length > 0 ? (
        <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t("reports.generateDisabled")}
        </p>
      ) : null}

      {types.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {t("reports.unavailableType")}
        </div>
      ) : error ? (
        <Alert
          variant="danger"
          title={t("reports.errorTitle")}
          action={
            <button type="button" onClick={refetch} className="text-xs font-semibold text-accent hover:underline">
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
          <header className="flex items-center justify-between border-b border-border border-l-4 border-l-accent bg-accent/5 px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t("reports.listTitle")}</h2>
            <span className="text-xs text-muted-foreground">{t("reports.count", { count: rows.length })}</span>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-accent/5 text-xs">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">{t("reports.columns.type")}</th>
                <th className="px-4 py-2 font-semibold">{t("reports.columns.period")}</th>
                <th className="px-4 py-2 font-semibold">{t("reports.columns.generatedAt")}</th>
                <th className="px-4 py-2 font-semibold">{t("reports.columns.status")}</th>
                <th className="px-4 py-2 text-right font-semibold">{t("reports.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("reports.empty")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.public_id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {t(`reports.types.${r.summary?.report_type}`)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {r.period_starts_on || r.period_ends_on
                        ? `${r.period_starts_on ?? "…"} → ${r.period_ends_on ?? "…"}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {r.generated_at ? r.generated_at.slice(0, 16).replace("T", " ") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.status === "completed" ? "success" : "neutral"}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setPreview(r)}>
                        {t("reports.preview.open")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? t(`reports.types.${preview.summary?.report_type}`) : ""}
        description={
          preview && (preview.period_starts_on || preview.period_ends_on)
            ? `${preview.period_starts_on ?? "…"} → ${preview.period_ends_on ?? "…"}`
            : t("reports.preview.title")
        }
        widthClassName="sm:w-[52rem]"
        footer={
          <>
            <Button variant="ghost" size="md" type="button" onClick={() => setPreview(null)}>
              {t("common.close")}
            </Button>
            {preview ? (
              <Button variant="primary" size="md" type="button" onClick={() => handlePrint(preview)}>
                {t("reports.preview.print")}
              </Button>
            ) : null}
          </>
        }
      >
        {preview ? <SummaryView run={preview} fmt={fmt} scalars={summaryScalars} /> : null}
      </Drawer>

      <GenerateReportDrawer
        open={genOpen}
        onClose={() => setGenOpen(false)}
        definitions={matchingDefinitions}
        onGenerated={(run) => {
          toast.success(
            t("reports.generateDrawer.successTitle"),
            t("reports.generateDrawer.successBody"),
          );
          setGenOpen(false);
          refetch();
          setPreview(run);
        }}
      />
    </>
  );
}

function SummaryView({
  run,
  fmt,
  scalars,
}: {
  run: ReportRun;
  fmt: (key: string, val: unknown, currency: string) => string;
  scalars: (s: ReportRun["summary"]) => Array<[string, unknown]>;
}) {
  const s = run.summary ?? {};
  const currency = s.currency ?? "XAF";
  const rowsData = Array.isArray(s.rows) ? s.rows : [];
  const cols = rowsData.length > 0 ? Object.keys(rowsData[0]) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {scalars(run.summary).map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-[var(--radius-field)] border border-border bg-muted/20 px-3 py-2">
            <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{humanize(k)}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(k, v, currency)}</span>
          </div>
        ))}
      </div>

      {rowsData.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
                {cols.map((c) => (
                  <th key={c} className={`px-3 py-2 font-semibold ${c.endsWith("_minor") ? "text-right" : ""}`}>
                    {humanize(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsData.map((r, ri) => (
                <tr key={ri} className="border-b border-border/60 last:border-0">
                  {cols.map((c) => (
                    <td key={c} className={`px-3 py-1.5 ${c.endsWith("_minor") ? "text-right tabular-nums" : ""} text-foreground`}>
                      {fmt(c, r[c], currency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
