"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import { fetchClients, type Client } from "@/lib/api/clients";
import { fetchLoans, type Loan } from "@/lib/api/loans";
import { fetchCollaterals, type Collateral } from "@/lib/api/collaterals";
import {
  fetchGuaranteeObligations,
  type GuaranteeObligation,
} from "@/lib/api/guarantee-obligations";
import {
  fetchReportDefinitions,
  type ReportDefinition,
} from "@/lib/api/report-definitions";
import {
  createReportRun,
  fetchReportRuns,
  type ReportRun,
} from "@/lib/api/report-runs";
import { localizeApiError } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";

/**
 * P24 — Édition › Main levée. Génère une **attestation de mainlevée de garantie**
 * (report_type `credit_guarantee_release`, module `credit`) pour une garantie
 * DÉJÀ LIBÉRÉE d'un prêt clôturé.
 *
 * Contrat backend (bad1987/habis-finance-api#1) :
 *   POST /report-runs { report_definition_public_id, agency_public_id,
 *     parameters: { loan_public_id, (collateral_public_id | guarantee_obligation_public_id) } }
 * Exactement UN des deux identifiants d'élément, et l'élément doit être libéré
 * ET rattaché au prêt — sinon l'API renvoie 422. On pré-filtre donc aux éléments
 * `status = released` pour ne proposer que des sélections valides.
 */
const REPORT_TYPE = "credit_guarantee_release";

/** Motifs de libération connus (le reste est affiché tel quel). */
const KNOWN_REASONS = new Set(["loan_closed"]);

/** Shape of the guarantee-release `summary` returned by the report run. */
type ReleaseSummary = {
  report_type?: string;
  loan_number?: string | null;
  agency_name?: string | null;
  client_name?: string | null;
  client_reference?: string | null;
  released_item_type?: "collateral" | "guarantee_obligation" | string;
  released_item_description?: string | null;
  released_item_category?: string | null;
  owner_full_name?: string | null;
  guarantor_name?: string | null;
  released_by?: string | null;
  released_amount_minor?: number | null;
  currency?: string | null;
  release_date?: string | null;
  release_reason?: string | null;
  items?: Array<{
    description?: string | null;
    quantity?: number | null;
    reference?: string | null;
    amount_minor?: number | null;
    currency?: string | null;
  }>;
};

/** A released collateral or obligation, normalised for the picker. */
type ReleasedItem = {
  /** `col:<public_id>` | `obl:<public_id>` */
  key: string;
  kind: "collateral" | "obligation";
  publicId: string;
  label: string;
};

export default function ReportsReleasePage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["accounting.audit.view"]);
  const canView = isPlatformAdmin || viewPerm;

  // undefined = loading, null = not available on this instance, else the def.
  const [definition, setDefinition] = useState<ReportDefinition | null | undefined>(
    undefined,
  );
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, Client>>(new Map());

  const [agencyId, setAgencyId] = useState("");
  const [loanSearch, setLoanSearch] = useState("");
  const debLoanSearch = useDebouncedValue(loanSearch, 400);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanId, setLoanId] = useState("");

  const [items, setItems] = useState<ReleasedItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemKey, setItemKey] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [preview, setPreview] = useState<ReportRun | null>(null);

  // Report definition + reference data (agencies, client names) — once.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchReportDefinitions(token, { module: "credit", status: "active" })
      .then((defs) => {
        if (cancelled) return;
        setDefinition(defs.find((d) => d.report_type === REPORT_TYPE) ?? null);
      })
      .catch(() => {
        if (!cancelled) setDefinition(null);
      });
    Promise.all([
      fetchAgencies(token, { perPage: 100 }).catch(() => ({ data: [] as Agency[] })),
      fetchClients(token, { scope: "all", perPage: 100 }).catch(() => ({
        data: [] as Client[],
      })),
    ]).then(([ag, cl]) => {
      if (cancelled) return;
      setAgencies(ag.data as Agency[]);
      setClientMap(
        new Map((cl.data as Client[]).map((c) => [c.public_id, c])),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Existing mainlevée attestations (history).
  const loadRuns = useCallback(async () => {
    if (!token) return;
    setRunsLoading(true);
    try {
      const res = await fetchReportRuns(token, { perPage: 100 });
      setRuns(
        res.data.filter((r) => r.summary?.report_type === REPORT_TYPE),
      );
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  // Closed loans for the chosen agency. The loans index has no agency filter,
  // so we fetch closed loans (optionally searched) and narrow client-side.
  useEffect(() => {
    if (!token || !agencyId) {
      setLoans([]);
      return;
    }
    let cancelled = false;
    setLoansLoading(true);
    fetchLoans(token, {
      status: "closed",
      perPage: 100,
      search: debLoanSearch || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setLoans(res.data.filter((l) => l.agency_public_id === agencyId));
      })
      .catch(() => {
        if (!cancelled) setLoans([]);
      })
      .finally(() => {
        if (!cancelled) setLoansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, agencyId, debLoanSearch]);

  // Released collaterals + obligations for the chosen loan.
  useEffect(() => {
    if (!token || !loanId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    Promise.all([
      fetchCollaterals(token, loanId).catch(() => [] as Collateral[]),
      fetchGuaranteeObligations(token, loanId).catch(
        () => [] as GuaranteeObligation[],
      ),
    ])
      .then(([cols, obls]) => {
        if (cancelled) return;
        const released: ReleasedItem[] = [
          ...cols
            .filter((c) => c.status === "released")
            .map((c) => ({
              key: `col:${c.public_id}`,
              kind: "collateral" as const,
              publicId: c.public_id,
              label: `${t("reports.release.itemCollateral")} · ${
                c.description || c.collateral_type
              }`,
            })),
          ...obls
            .filter((o) => o.status === "released")
            .map((o) => ({
              key: `obl:${o.public_id}`,
              kind: "obligation" as const,
              publicId: o.public_id,
              label: `${t("reports.release.itemObligation")} · ${o.obligation_type}`,
            })),
        ];
        setItems(released);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, loanId, t]);

  // Reset dependent selections when a parent selection changes.
  function handleAgencyChange(next: string) {
    setAgencyId(next);
    setLoanId("");
    setItemKey("");
    setError(null);
  }
  function handleLoanChange(next: string) {
    setLoanId(next);
    setItemKey("");
    setError(null);
  }

  const loanLabelOf = useCallback(
    (loan: Loan): string => {
      const number = loan.loan_number || loan.public_id.slice(-6);
      const client = loan.client_public_id
        ? clientMap.get(loan.client_public_id)
        : undefined;
      const name = client
        ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
        : null;
      return name ? `${number} · ${name}` : number;
    },
    [clientMap],
  );

  const loanOptions = useMemo(
    () => loans.map((l) => ({ value: l.public_id, label: loanLabelOf(l) })),
    [loans, loanLabelOf],
  );
  const itemOptions = useMemo(
    () => items.map((i) => ({ value: i.key, label: i.label })),
    [items],
  );

  const selectedItem = items.find((i) => i.key === itemKey) ?? null;
  const canGenerate =
    !!definition && !!agencyId && !!loanId && !!selectedItem && !submitting;

  async function handleGenerate() {
    if (!token || !definition || !loanId || !selectedItem) return;
    setSubmitting(true);
    setError(null);
    try {
      const parameters: Record<string, unknown> = { loan_public_id: loanId };
      if (selectedItem.kind === "collateral") {
        parameters.collateral_public_id = selectedItem.publicId;
      } else {
        parameters.guarantee_obligation_public_id = selectedItem.publicId;
      }
      const run = await createReportRun(token, {
        report_definition_public_id: definition.public_id,
        agency_public_id: agencyId,
        parameters,
      });
      toast.success(
        t("reports.release.successTitle"),
        t("reports.release.successBody"),
      );
      setItemKey("");
      setPreview(run);
      void loadRuns();
    } catch (cause) {
      setError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function reasonLabel(code: string | null | undefined): string {
    if (!code) return "—";
    return KNOWN_REASONS.has(code)
      ? t(`reports.release.reasons.${code}`)
      : code;
  }

  function money(minor: number | null | undefined, currency = "XAF"): string {
    if (minor === null || minor === undefined) return "—";
    return format.currencyMinor(minor, { currency });
  }

  const runLabel = useCallback(
    (run: ReportRun): { loan: string; client: string; item: string } => {
      const s = (run.summary ?? {}) as ReleaseSummary;
      return {
        loan: s.loan_number || "—",
        client: s.client_name || "—",
        item: s.released_item_description || s.released_item_category || "—",
      };
    },
    [],
  );

  function handlePrint(run: ReportRun) {
    const s = (run.summary ?? {}) as ReleaseSummary;
    const currency = s.currency ?? "XAF";
    const isCollateral = s.released_item_type === "collateral";
    const itemType = isCollateral
      ? t("reports.release.itemCollateral")
      : t("reports.release.itemObligation");
    const meta = [
      { label: t("reports.release.fields.agency"), value: s.agency_name ?? "—" },
      {
        label: t("reports.release.fields.client"),
        value: s.client_reference
          ? `${s.client_name ?? "—"} (${s.client_reference})`
          : s.client_name ?? "—",
      },
      { label: t("reports.release.fields.loanNumber"), value: s.loan_number ?? "—" },
      { label: t("reports.release.fields.itemType"), value: itemType },
      {
        label: t("reports.release.fields.itemDescription"),
        value: s.released_item_description ?? "—",
      },
      {
        label: t("reports.release.fields.category"),
        value: s.released_item_category ?? "—",
      },
      {
        label: isCollateral
          ? t("reports.release.fields.owner")
          : t("reports.release.fields.guarantor"),
        value: (isCollateral ? s.owner_full_name : s.guarantor_name) ?? "—",
      },
      {
        label: t("reports.release.fields.releaseDate"),
        value: s.release_date ?? "—",
      },
      {
        label: t("reports.release.fields.reason"),
        value: reasonLabel(s.release_reason),
      },
      {
        label: t("reports.release.fields.amount"),
        value: money(s.released_amount_minor, currency),
      },
    ];
    if (!isCollateral && s.released_by) {
      meta.push({
        label: t("reports.release.fields.releasedBy"),
        value: s.released_by,
      });
    }
    const printItems = Array.isArray(s.items) ? s.items : [];
    openBrandedReport({
      documentTitle: `${t("reports.release.preview.fileName")}-${s.loan_number ?? "mainlevee"}`,
      heading: t("reports.release.preview.heading"),
      subheading: [s.agency_name, s.loan_number].filter(Boolean).join(" · "),
      meta,
      columns: [
        t("reports.release.itemColumns.description"),
        t("reports.release.itemColumns.quantity"),
        t("reports.release.itemColumns.reference"),
        t("reports.release.itemColumns.amount"),
      ],
      rows: printItems.map((it) => [
        it.description ?? "—",
        it.quantity ?? "—",
        it.reference ?? "—",
        money(it.amount_minor, it.currency ?? currency),
      ]),
      numericColumns: [3],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("reports.release.preview.noItems"),
    });
  }

  if (session.status !== "authenticated" || !canView) return null;

  return (
    <>
      <PageHeader
        title={t("reports.scopes.release.title")}
        description={t("reports.scopes.release.description")}
      />

      {definition === null ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {t("reports.release.unavailableBody")}
        </div>
      ) : (
        <>
          {/* Generation form */}
          <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-border bg-background p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">
                {t("reports.release.generateTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("reports.release.generateHint")}
              </p>
            </div>

            {error ? (
              <Alert variant="danger" title={t("reports.release.errorTitle")}>
                {error}
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                id="release-agency"
                label={t("reports.release.agency")}
                value={agencyId}
                onChange={handleAgencyChange}
                placeholder={t("reports.release.agencyPlaceholder")}
                options={agencies.map((a) => ({
                  value: a.public_id,
                  label: a.code ? `${a.code} — ${a.name}` : a.name,
                }))}
              />

              <TextField
                id="release-loan-search"
                label={t("reports.release.loanSearch")}
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
                placeholder={t("reports.release.loanSearchPlaceholder")}
                disabled={!agencyId}
              />
            </div>

            <Select
              id="release-loan"
              label={t("reports.release.loan")}
              value={loanId}
              onChange={handleLoanChange}
              options={loanOptions}
              placeholder={
                !agencyId
                  ? t("reports.release.loanPickAgency")
                  : loansLoading
                    ? t("reports.release.loanLoading")
                    : loanOptions.length === 0
                      ? t("reports.release.loanEmpty")
                      : t("reports.release.loanPlaceholder")
              }
            />

            {loanId ? (
              itemsLoading ? (
                <p className="text-xs text-muted-foreground">
                  {t("reports.release.itemLoading")}
                </p>
              ) : itemOptions.length === 0 ? (
                <Alert variant="info" title={t("reports.release.itemEmptyTitle")}>
                  {t("reports.release.itemEmpty")}
                </Alert>
              ) : (
                <Select
                  id="release-item"
                  label={t("reports.release.item")}
                  value={itemKey}
                  onChange={(v) => {
                    setItemKey(v);
                    setError(null);
                  }}
                  options={itemOptions}
                  placeholder={t("reports.release.itemPlaceholder")}
                />
              )
            ) : null}

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="md"
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                {submitting
                  ? t("reports.release.generating")
                  : t("reports.release.generate")}
              </Button>
            </div>
          </section>

          {/* History */}
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
            <header className="flex items-center justify-between border-b border-border border-l-4 border-l-accent bg-accent/5 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("reports.release.historyTitle")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("reports.release.historyCount", { count: runs.length })}
              </span>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-accent/5 text-xs">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold">
                    {t("reports.release.columns.loan")}
                  </th>
                  <th className="px-4 py-2 font-semibold">
                    {t("reports.release.columns.client")}
                  </th>
                  <th className="px-4 py-2 font-semibold">
                    {t("reports.release.columns.item")}
                  </th>
                  <th className="px-4 py-2 font-semibold">
                    {t("reports.release.columns.generatedAt")}
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    {t("reports.release.columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsLoading && runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t("common.loading")}
                    </td>
                  </tr>
                ) : runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t("reports.release.historyEmpty")}
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => {
                    const l = runLabel(r);
                    return (
                      <tr key={r.public_id}>
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {l.loan}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.client}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.item}</td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {r.generated_at
                            ? r.generated_at.slice(0, 16).replace("T", " ")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreview(r)}
                          >
                            {t("reports.preview.open")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Attestation preview */}
      <Drawer
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={t("reports.release.preview.title")}
        description={
          preview
            ? [
                (preview.summary as ReleaseSummary | null)?.agency_name,
                (preview.summary as ReleaseSummary | null)?.loan_number,
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        widthClassName="sm:w-[46rem]"
        footer={
          <>
            <Button variant="ghost" size="md" type="button" onClick={() => setPreview(null)}>
              {t("common.close")}
            </Button>
            {preview ? (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={() => handlePrint(preview)}
              >
                {t("reports.release.preview.print")}
              </Button>
            ) : null}
          </>
        }
      >
        {preview ? (
          <AttestationView
            summary={(preview.summary ?? {}) as ReleaseSummary}
            t={t}
            money={money}
            reasonLabel={reasonLabel}
          />
        ) : null}
      </Drawer>
    </>
  );
}

function AttestationView({
  summary,
  t,
  money,
  reasonLabel,
}: {
  summary: ReleaseSummary;
  t: (key: string, values?: Record<string, string | number>) => string;
  money: (minor: number | null | undefined, currency?: string) => string;
  reasonLabel: (code: string | null | undefined) => string;
}) {
  const currency = summary.currency ?? "XAF";
  const isCollateral = summary.released_item_type === "collateral";
  const items = Array.isArray(summary.items) ? summary.items : [];

  const fields: Array<[string, string]> = [
    [t("reports.release.fields.agency"), summary.agency_name ?? "—"],
    [
      t("reports.release.fields.client"),
      summary.client_reference
        ? `${summary.client_name ?? "—"} (${summary.client_reference})`
        : summary.client_name ?? "—",
    ],
    [t("reports.release.fields.loanNumber"), summary.loan_number ?? "—"],
    [
      t("reports.release.fields.itemType"),
      isCollateral
        ? t("reports.release.itemCollateral")
        : t("reports.release.itemObligation"),
    ],
    [
      t("reports.release.fields.itemDescription"),
      summary.released_item_description ?? "—",
    ],
    [t("reports.release.fields.category"), summary.released_item_category ?? "—"],
    [
      isCollateral
        ? t("reports.release.fields.owner")
        : t("reports.release.fields.guarantor"),
      (isCollateral ? summary.owner_full_name : summary.guarantor_name) ?? "—",
    ],
    [t("reports.release.fields.releaseDate"), summary.release_date ?? "—"],
    [t("reports.release.fields.reason"), reasonLabel(summary.release_reason)],
    [
      t("reports.release.fields.amount"),
      money(summary.released_amount_minor, currency),
    ],
  ];
  if (!isCollateral && summary.released_by) {
    fields.push([t("reports.release.fields.releasedBy"), summary.released_by]);
  }

  return (
    <div className="flex flex-col gap-5">
      <Badge tone="success">{t("reports.release.preview.released")}</Badge>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-[var(--radius-field)] border border-border bg-muted/20 px-3 py-2"
          >
            <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className="text-sm font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {isCollateral ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("reports.release.preview.itemsTitle")}
          </h3>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">
                    {t("reports.release.itemColumns.description")}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {t("reports.release.itemColumns.quantity")}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {t("reports.release.itemColumns.reference")}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    {t("reports.release.itemColumns.amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      {t("reports.release.preview.noItems")}
                    </td>
                  </tr>
                ) : (
                  items.map((it, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-1.5 text-foreground">
                        {it.description ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-foreground">
                        {it.quantity ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-foreground">
                        {it.reference ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                        {money(it.amount_minor, it.currency ?? currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
