import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";
import type { Pagination } from "./operation-codes";

/**
 * P16b — Comptabilité › Imputations. Pour un code d'opération (+ agence/devise
 * optionnelles), définit le compte du plan comptable à débiter et/ou créditer.
 * C'est le pont qui rend l'auto-comptabilisation possible (déblocage, frais…).
 *
 * Une imputation porte un compte débit ET/OU crédit (au moins l'un des deux).
 * Elle a un cycle d'approbation (`approval_status`) en plus de son `status`.
 * Liste : `data.operation_account_mappings` + `meta.pagination`. `DELETE`
 * archive. Permissions `operation.mappings.*`.
 *
 * ⚠️ Le resource ne renvoie que des `*_public_id` (pas les codes/intitulés du
 * code d'opération ni des comptes) — la page les résout côté client via les
 * listes déjà chargées. (Enrichissement demandé au back-end — §I.)
 */
export type MappingStatus = "active" | "inactive" | "archived";

export type MappingApprovalStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "suspended"
  | "revoked"
  | "expired"
  | "archived";

/** Approval values accepted on create (the full set is allowed on update). */
export const MAPPING_CREATE_APPROVAL_STATUSES = [
  "draft",
  "submitted",
  "approved",
] as const;

export type OperationAccountMapping = {
  public_id: string;
  operation_code_public_id: string | null;
  agency_public_id: string | null;
  debit_ledger_account_public_id: string | null;
  credit_ledger_account_public_id: string | null;
  currency: string | null;
  effective_from: string | null;
  effective_to: string | null;
  status: MappingStatus;
  approval_status: MappingApprovalStatus;
  approved_at: string | null;
  rules: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedOperationAccountMappings = {
  data: OperationAccountMapping[];
  meta: { pagination: Pagination };
};

export type MappingWritePayload = {
  operation_code_public_id?: string;
  agency_public_id?: string | null;
  debit_ledger_account_public_id?: string | null;
  credit_ledger_account_public_id?: string | null;
  currency?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status?: MappingStatus;
  approval_status?: MappingApprovalStatus;
};

export async function fetchOperationAccountMappings(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    status?: string;
    search?: string;
  } = {},
): Promise<PaginatedOperationAccountMappings> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }

  const response = await fetch(
    `/api/v1/operation-account-mappings?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
        "X-Locale": getRequestLocale(),
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    },
  );
  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch operation account mappings (HTTP ${response.status})`);
  }
  // The collection wraps rows under `data.operation_account_mappings`.
  const envelope = JSON.parse(text) as {
    data?:
      | { operation_account_mappings?: OperationAccountMapping[] }
      | OperationAccountMapping[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: OperationAccountMapping[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.operation_account_mappings)
      ? envelope.data!.operation_account_mappings!
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

export async function createOperationAccountMapping(
  token: string,
  payload: MappingWritePayload,
): Promise<OperationAccountMapping> {
  return apiRequest<OperationAccountMapping>("operation-account-mappings", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateOperationAccountMapping(
  token: string,
  publicId: string,
  payload: MappingWritePayload,
): Promise<OperationAccountMapping> {
  return apiRequest<OperationAccountMapping>(
    `operation-account-mappings/${publicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

/** Archives the mapping (status → archived). */
export async function deleteOperationAccountMapping(
  token: string,
  publicId: string,
): Promise<void> {
  await apiRequest<unknown>(`operation-account-mappings/${publicId}`, {
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
