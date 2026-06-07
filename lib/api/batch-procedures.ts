import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P26 — Paramétrage › Batch (procédures). Référentiel des procédures batch que
 * le moteur sait exécuter (vérifications de clôture comptable/caisse, évaluation
 * des arriérés, pénalités, hooks de portefeuille). Une procédure est identifiée
 * par un `code` immuable ; seul son `status` (active/inactive) la rend
 * exécutable. Les exécutions concrètes vivent dans `batch-runs.ts`.
 *
 * Shape liste : `data.batch_procedures` (ou tableau direct) + `meta.pagination`.
 * Pas de suppression (désactivation via `status`). Permissions `batch.procedures.*`.
 */
export type BatchProcedureStatus = "active" | "inactive";

export type BatchProcedure = {
  public_id: string;
  code: string;
  name: string;
  description: string | null;
  schedule_type: string | null;
  schedule_metadata: Record<string, unknown> | null;
  status: BatchProcedureStatus;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedBatchProcedures = {
  data: BatchProcedure[];
  meta: { pagination: Pagination };
};

export type BatchProcedureWritePayload = {
  code?: string;
  name?: string;
  description?: string | null;
  schedule_type?: string | null;
  schedule_metadata?: Record<string, unknown> | null;
  status?: BatchProcedureStatus;
};

export async function fetchBatchProcedures(
  token: string,
  options: { page?: number; perPage?: number; search?: string } = {},
): Promise<PaginatedBatchProcedures> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }

  const response = await fetch(`/api/v1/batch-procedures?${query.toString()}`, {
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
    throw new Error(`Failed to fetch batch procedures (HTTP ${response.status})`);
  }
  // The collection wraps rows under `data.procedures` (BatchProcedureCollection).
  const envelope = JSON.parse(text) as {
    data?: { procedures?: BatchProcedure[] } | BatchProcedure[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: BatchProcedure[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.procedures)
      ? envelope.data!.procedures!
      : [];
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};
  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? options.perPage ?? 25,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

export async function createBatchProcedure(
  token: string,
  payload: BatchProcedureWritePayload,
): Promise<BatchProcedure> {
  return apiRequest<BatchProcedure>("batch-procedures", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateBatchProcedure(
  token: string,
  publicId: string,
  payload: BatchProcedureWritePayload,
): Promise<BatchProcedure> {
  return apiRequest<BatchProcedure>(`batch-procedures/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateBatchProcedureStatus(
  token: string,
  publicId: string,
  status: BatchProcedureStatus,
): Promise<BatchProcedure> {
  return apiRequest<BatchProcedure>(`batch-procedures/${publicId}/status`, {
    method: "PATCH",
    token,
    body: { status },
  });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
