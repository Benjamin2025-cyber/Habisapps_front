import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P24 — Édition › Rapports (report-runs). Un rapport est CALCULÉ à la génération
 * (POST) à partir d'une **définition** de rapport (le type), et son résultat est
 * stocké dans `summary` (pas d'endpoint de téléchargement séparé). Types pris en
 * charge : trial_balance, general_ledger, emf_trial_balance,
 * credit_portfolio_outstanding, credit_par_delinquency,
 * credit_collection_performance.
 *
 * ⚠️ Génération bloquée côté UI : pas d'endpoint `GET /report-definitions` pour
 * lister les définitions (cf back-issue #28). On peut LISTER, PRÉVISUALISER et
 * IMPRIMER les rapports générés. Permission `accounting.audit.view`.
 */
export type ReportSummary = {
  report_type?: string;
  currency?: string;
  from?: string | null;
  to?: string | null;
  rows?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type ReportRun = {
  public_id: string;
  report_definition_public_id: string | null;
  agency_public_id: string | null;
  period_starts_on: string | null;
  period_ends_on: string | null;
  status: string;
  generated_at: string | null;
  parameters: Record<string, unknown> | null;
  summary: ReportSummary | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedReportRuns = {
  data: ReportRun[];
  meta: { pagination: Pagination };
};

export type ReportRunCreatePayload = {
  report_definition_public_id: string;
  agency_public_id?: string | null;
  period_starts_on?: string | null;
  period_ends_on?: string | null;
  currency?: string;
  parameters?: Record<string, unknown>;
};

export async function fetchReportRuns(
  token: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PaginatedReportRuns> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(`/api/v1/report-runs?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      "X-Locale": getRequestLocale(),
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch report runs (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { report_runs?: ReportRun[] } | ReportRun[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: ReportRun[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.report_runs)
      ? envelope.data!.report_runs!
      : [];
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};
  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? options.perPage ?? 100,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

export async function getReportRun(
  token: string,
  publicId: string,
): Promise<ReportRun> {
  return apiRequest<ReportRun>(`report-runs/${publicId}`, { method: "GET", token });
}

export async function createReportRun(
  token: string,
  payload: ReportRunCreatePayload,
): Promise<ReportRun> {
  return apiRequest<ReportRun>("report-runs", { method: "POST", token, body: payload });
}
