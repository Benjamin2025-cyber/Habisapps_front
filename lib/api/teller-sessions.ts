import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P20 — Caisse › Sessions de caisse (teller-sessions). Une session ouvre une
 * caisse pour une journée : le caissier déclare son fonds d'ouverture, opère
 * (dépôts/retraits — P21), puis clôture en déclarant son fonds de clôture.
 *
 * Règles API : on ouvre une session sur une caisse **active et fermée**
 * (`daily_state=closed`). On ne peut clôturer qu'une session **ouverte**.
 *
 * Shape liste : `data.teller_sessions` + `meta.pagination`.
 * SHOW / OPEN / CLOSE renvoient la session directement sous `data`.
 */
export type TellerSessionStatus = "open" | "closed";

/**
 * Per-session aggregates exposed on `TellerSessionResource.summary` (#24b).
 * Totals are in minor units; counts are integers.
 */
export type TellerSessionSummary = {
  deposits_total_minor: number;
  withdrawals_total_minor: number;
  manual_journals_total_minor: number;
  reversals_total_minor: number;
  /** Sum of applied fees on posted transactions. */
  commissions_total_minor: number;
  /** Distinct clients served by posted transactions. */
  distinct_clients_served_count: number;
  transaction_count: number;
  posted_transaction_count: number;
  pending_transaction_count: number;
  expected_cash_balance_minor: number;
  last_transaction_at: string | null;
};

export type TellerSession = {
  public_id: string;
  agency_public_id: string | null;
  till_public_id: string | null;
  teller_user_public_id: string | null;
  business_date: string | null;
  opened_at: string | null;
  closed_at: string | null;
  opening_declaration_minor: number | null;
  closing_declaration_minor: number | null;
  currency: string | null;
  status: TellerSessionStatus;
  summary?: TellerSessionSummary | null;
  created_at: string;
  updated_at: string;
};

/**
 * Server-side filters for the teller-sessions index (#29). Mirrors the backend
 * `filter[...]` params + `sort`. All optional; omit/empty = no constraint.
 */
export type TellerSessionFilters = {
  page?: number;
  perPage?: number;
  status?: string;
  businessDate?: string;
  businessDateFrom?: string;
  businessDateTo?: string;
  tillPublicId?: string;
  tellerUserPublicId?: string;
  /** Platform-admin only — scope to one agency. */
  agencyPublicId?: string;
  /** e.g. "-opened_at" (default), "business_date", "-business_date", "status". */
  sort?: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedTellerSessions = {
  data: TellerSession[];
  meta: { pagination: Pagination };
};

export type DenominationCount = {
  denomination_public_id: string;
  count: number;
};

export type OpenTellerSessionPayload = {
  till_public_id: string;
  teller_user_public_id?: string | null;
  business_date: string;
  opening_declaration_minor: number;
  currency?: string;
  /** Required when the till has `requires_denominations` (P25 cash counting). */
  denomination_counts?: DenominationCount[];
};

export type CloseTellerSessionPayload = {
  closing_declaration_minor: number;
  currency?: string;
  denomination_counts?: DenominationCount[];
};

export async function fetchTellerSessions(
  token: string,
  options: TellerSessionFilters = {},
): Promise<PaginatedTellerSessions> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.sort) query.set("sort", options.sort);
  const filters: Array<[string, string | undefined]> = [
    ["status", options.status],
    ["business_date", options.businessDate],
    ["business_date_from", options.businessDateFrom],
    ["business_date_to", options.businessDateTo],
    ["till_public_id", options.tillPublicId],
    ["teller_user_public_id", options.tellerUserPublicId],
    ["agency_public_id", options.agencyPublicId],
  ];
  for (const [key, value] of filters) {
    if (value) query.set(`filter[${key}]`, value);
  }

  const response = await fetch(`/api/v1/teller-sessions?${query.toString()}`, {
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
    throw new Error(`Failed to fetch teller sessions (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { teller_sessions?: TellerSession[] } | TellerSession[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: TellerSession[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.teller_sessions)
      ? envelope.data!.teller_sessions!
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

export async function getTellerSession(
  token: string,
  publicId: string,
): Promise<TellerSession> {
  return apiRequest<TellerSession>(`teller-sessions/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function openTellerSession(
  token: string,
  payload: OpenTellerSessionPayload,
): Promise<TellerSession> {
  return apiRequest<TellerSession>("teller-sessions", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function closeTellerSession(
  token: string,
  publicId: string,
  payload: CloseTellerSessionPayload,
): Promise<TellerSession> {
  return apiRequest<TellerSession>(`teller-sessions/${publicId}/close`, {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
