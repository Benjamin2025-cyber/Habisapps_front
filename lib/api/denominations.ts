import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P25 — Paramétrage › Type monnaie (denominations). Référentiel des coupures
 * (billets/pièces) et de leur valeur. `value_minor` est en unité **minor**
 * (franc × 100). Sert au comptage des espèces : ouverture/clôture de session
 * (P20), arrêtés de caisse (P22), et détail des versements (P21).
 *
 * Shape liste : `data.denominations` + `meta.pagination`. Pas de suppression
 * (désactivation via `status`). Permissions `cash.denominations.*`.
 */
export type DenominationType = "banknote" | "coin";
export type DenominationStatus = "active" | "inactive";

export type Denomination = {
  public_id: string;
  code: string;
  label: string;
  value_minor: number;
  currency: string;
  type: DenominationType;
  status: DenominationStatus;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedDenominations = {
  data: Denomination[];
  meta: { pagination: Pagination };
};

export type DenominationWritePayload = {
  code?: string;
  label?: string;
  value_minor?: number;
  currency?: string;
  type?: DenominationType;
  status?: DenominationStatus;
};

export async function fetchDenominations(
  token: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PaginatedDenominations> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(`/api/v1/denominations?${query.toString()}`, {
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
    throw new Error(`Failed to fetch denominations (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { denominations?: Denomination[] } | Denomination[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: Denomination[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.denominations)
      ? envelope.data!.denominations!
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

export async function createDenomination(
  token: string,
  payload: DenominationWritePayload,
): Promise<Denomination> {
  return apiRequest<Denomination>("denominations", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateDenomination(
  token: string,
  publicId: string,
  payload: DenominationWritePayload,
): Promise<Denomination> {
  return apiRequest<Denomination>(`denominations/${publicId}`, {
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
