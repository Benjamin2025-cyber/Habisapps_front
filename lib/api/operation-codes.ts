import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P16b — Comptabilité › Codes opération. Référentiel des codes d'opération
 * (déblocage, remboursement, frais de dossier, taxe…) qui servent de clé aux
 * imputations comptables automatiques (voir operation-account-mappings.ts).
 * Un code est identifié par un `code` immuable ; son `status` le rend
 * utilisable. Permissions `operation.codes.*`.
 *
 * Liste : `data.operation_codes` + `meta.pagination`. Pas de suppression dure —
 * `DELETE` archive (status → archived).
 */
export type OperationCodeStatus = "active" | "inactive" | "archived";

export const OPERATION_MODULES = [
  "accounting",
  "cash",
  "loan",
  "insurance",
  "hr",
  "fx",
  "islamic_finance",
  "sms",
  "reporting",
  "alert",
] as const;

export type OperationModule = (typeof OPERATION_MODULES)[number];

/** Free string on the API, but these are the meaningful values. */
export const OPERATION_DIRECTIONS = ["debit", "credit", "debit_credit"] as const;

export type OperationCode = {
  public_id: string;
  code: string;
  label: string;
  module: string;
  operation_type: string | null;
  direction: string | null;
  status: OperationCodeStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedOperationCodes = {
  data: OperationCode[];
  meta: { pagination: Pagination };
};

export type OperationCodeWritePayload = {
  code?: string;
  label?: string;
  module?: string;
  operation_type?: string | null;
  direction?: string | null;
  status?: OperationCodeStatus;
  metadata?: Record<string, unknown> | null;
};

export async function fetchOperationCodes(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    module?: string;
    status?: string;
    search?: string;
  } = {},
): Promise<PaginatedOperationCodes> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.module) query.set("module", options.module);
  if (options.status) query.set("status", options.status);
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }

  const response = await fetch(`/api/v1/operation-codes?${query.toString()}`, {
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
    throw new Error(`Failed to fetch operation codes (HTTP ${response.status})`);
  }
  // The collection wraps rows under `data.operation_codes`.
  const envelope = JSON.parse(text) as {
    data?: { operation_codes?: OperationCode[] } | OperationCode[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: OperationCode[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.operation_codes)
      ? envelope.data!.operation_codes!
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

export async function createOperationCode(
  token: string,
  payload: OperationCodeWritePayload,
): Promise<OperationCode> {
  return apiRequest<OperationCode>("operation-codes", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateOperationCode(
  token: string,
  publicId: string,
  payload: OperationCodeWritePayload,
): Promise<OperationCode> {
  return apiRequest<OperationCode>(`operation-codes/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

/** Archives the code (status → archived). */
export async function archiveOperationCode(
  token: string,
  publicId: string,
): Promise<void> {
  await apiRequest<unknown>(`operation-codes/${publicId}`, {
    method: "DELETE",
    token,
  });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
