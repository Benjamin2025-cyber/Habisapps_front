import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P20 — Caisse › Caisses (tills). Référentiel des postes de caisse d'une agence.
 * Une caisse porte un état permanent (`status` active/inactive) et un état
 * journalier (`daily_state` open/closed) piloté par les sessions de caisse.
 *
 * Shape liste : `data.tills` + `meta.pagination` (enveloppe applicative).
 * SHOW / CREATE / UPDATE renvoient la caisse directement sous `data`.
 * Pas de suppression (la policy interdit delete) — désactiver via `status`.
 */
export type TillStatus = "active" | "inactive";
export type TillDailyState = "open" | "closed";

export type Till = {
  public_id: string;
  agency_public_id: string | null;
  code: string;
  name: string;
  type: string;
  status: TillStatus;
  daily_state: TillDailyState;
  opening_balance_minor: number | null;
  last_closing_balance_minor: number | null;
  last_closing_at: string | null;
  requires_denominations: boolean | null;
  nature: string | null;
  is_central_till: boolean | null;
  max_balance_limit_minor: number | null;
  max_withdrawal_limit_minor: number | null;
  currency: string | null;
  assigned_user_public_id: string | null;
  ledger_account_public_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedTills = {
  data: Till[];
  meta: { pagination: Pagination };
};

export type TillWritePayload = {
  agency_public_id?: string | null;
  code?: string;
  name?: string;
  type?: string;
  status?: TillStatus;
  requires_denominations?: boolean;
  nature?: string | null;
  is_central_till?: boolean;
  max_balance_limit_minor?: number | null;
  max_withdrawal_limit_minor?: number | null;
  currency?: string;
  assigned_user_public_id?: string | null;
  ledger_account_public_id?: string | null;
};

export async function fetchTills(
  token: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PaginatedTills> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(`/api/v1/tills?${query.toString()}`, {
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
    throw new Error(`Failed to fetch tills (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { tills?: Till[] } | Till[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: Till[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.tills)
      ? envelope.data!.tills!
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

export async function getTill(token: string, publicId: string): Promise<Till> {
  return apiRequest<Till>(`tills/${publicId}`, { method: "GET", token });
}

export async function createTill(
  token: string,
  payload: TillWritePayload,
): Promise<Till> {
  return apiRequest<Till>("tills", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateTill(
  token: string,
  publicId: string,
  payload: TillWritePayload,
): Promise<Till> {
  return apiRequest<Till>(`tills/${publicId}`, {
    method: "PATCH",
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
