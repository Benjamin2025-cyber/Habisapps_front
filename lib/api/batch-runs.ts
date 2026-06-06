import { apiRequest, notifyAuthExpired } from "./client";
import type { Pagination } from "./batch-procedures";

/**
 * P26 — Paramétrage › Batch (exécutions). Une exécution (`batch-run`) applique
 * une procédure pour une `business_date` (et une agence optionnelle). Cycle de
 * vie : `pending` → `running` → `succeeded` | `failed`, ou `cancelled` avant
 * démarrage. Actions : `execute` (depuis pending), `retry` (depuis failed /
 * cancelled → repasse pending), `cancel` (pending non démarré).
 *
 * Les procédures de **contrôle de clôture** (accounting/cash close verification)
 * sont pilotées par la clôture de journée comptable et requièrent un lien
 * `accounting_day` — elles ne se lancent pas manuellement ici. Ce runner sert
 * surtout aux procédures opérationnelles (arriérés, pénalités, hooks portefeuille).
 *
 * Le résultat est porté par `summary_payload` (en cas de succès) et
 * `failure_reason` (en cas d'échec). Permissions `batch.runs.*` ; sans
 * `batch.runs.manage`, l'index est auto-scopé à l'agence de l'acteur.
 */
export type BatchRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type BatchRun = {
  public_id: string;
  batch_procedure_public_id: string | null;
  batch_procedure_code: string | null;
  agency_public_id: string | null;
  agency_code: string | null;
  accounting_day_public_id: string | null;
  accounting_day_status: string | null;
  business_date: string;
  status: BatchRunStatus;
  started_at: string | null;
  finished_at: string | null;
  operator_public_id: string | null;
  summary_payload: Record<string, unknown> | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedBatchRuns = {
  data: BatchRun[];
  meta: { pagination: Pagination };
};

export type BatchRunFilters = {
  page?: number;
  perPage?: number;
  procedurePublicId?: string;
  status?: BatchRunStatus;
  businessDate?: string;
  businessDateFrom?: string;
  businessDateTo?: string;
  accountingDayPublicId?: string;
  agencyCode?: string;
  search?: string;
};

export type BatchRunCreatePayload = {
  batch_procedure_public_id: string;
  business_date: string;
  agency_code?: string | null;
  accounting_day_public_id?: string | null;
  idempotency_key?: string | null;
};

export async function fetchBatchRuns(
  token: string,
  filters: BatchRunFilters = {},
): Promise<PaginatedBatchRuns> {
  const query = new URLSearchParams();
  query.set("per_page", String(filters.perPage ?? 25));
  if (filters.page && filters.page > 0) query.set("page", String(filters.page));
  if (filters.procedurePublicId) {
    query.set("filter[batch_procedure_public_id]", filters.procedurePublicId);
  }
  if (filters.status) query.set("filter[status]", filters.status);
  if (filters.businessDate) {
    query.set("filter[business_date]", filters.businessDate);
  }
  if (filters.businessDateFrom) {
    query.set("filter[business_date_from]", filters.businessDateFrom);
  }
  if (filters.businessDateTo) {
    query.set("filter[business_date_to]", filters.businessDateTo);
  }
  if (filters.accountingDayPublicId) {
    query.set("filter[accounting_day_public_id]", filters.accountingDayPublicId);
  }
  if (filters.agencyCode) query.set("filter[agency_code]", filters.agencyCode);
  if (filters.search && filters.search.trim().length > 0) {
    query.set("filter[search]", filters.search.trim());
  }

  const response = await fetch(`/api/v1/batch-runs?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch batch runs (HTTP ${response.status})`);
  }
  // The collection wraps rows under `data.runs` (BatchRunCollection).
  const envelope = JSON.parse(text) as {
    data?: { runs?: BatchRun[] } | BatchRun[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: BatchRun[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.runs)
      ? envelope.data!.runs!
      : [];
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};
  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? filters.perPage ?? 25,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

export async function createBatchRun(
  token: string,
  payload: BatchRunCreatePayload,
): Promise<BatchRun> {
  const body: Record<string, unknown> = {
    batch_procedure_public_id: payload.batch_procedure_public_id,
    business_date: payload.business_date,
  };
  if (payload.agency_code) body.agency_code = payload.agency_code;
  if (payload.accounting_day_public_id) {
    body.accounting_day_public_id = payload.accounting_day_public_id;
  }
  if (payload.idempotency_key) body.idempotency_key = payload.idempotency_key;
  return apiRequest<BatchRun>("batch-runs", { method: "POST", token, body });
}

export async function executeBatchRun(
  token: string,
  publicId: string,
): Promise<BatchRun> {
  return apiRequest<BatchRun>(`batch-runs/${publicId}/execute`, {
    method: "POST",
    token,
  });
}

export async function retryBatchRun(
  token: string,
  publicId: string,
): Promise<BatchRun> {
  return apiRequest<BatchRun>(`batch-runs/${publicId}/retry`, {
    method: "POST",
    token,
  });
}

export async function cancelBatchRun(
  token: string,
  publicId: string,
  reason?: string,
): Promise<BatchRun> {
  return apiRequest<BatchRun>(`batch-runs/${publicId}/cancel`, {
    method: "POST",
    token,
    body: reason ? { failure_reason: reason } : undefined,
  });
}
