import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P7 — Mises en attente / blocages d'un compte (account holds).
 *
 * Réservé à `platform-admin` côté API. NB : l'index est global (aucun filtre
 * par compte), donc on filtre côté client par `customer_account_public_id`.
 */
export type AccountHoldStatus = "active" | "released" | "cancelled" | "archived";

export type AccountHold = {
  public_id: string;
  customer_account_public_id: string | null;
  amount_minor: number;
  currency: string;
  reason_type: string;
  source_type: string | null;
  source_public_id: string | null;
  status: AccountHoldStatus;
  placed_at: string | null;
  expires_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  reference: string | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedAccountHolds = {
  data: AccountHold[];
  meta: { pagination: Pagination };
};

export type AccountHoldWritePayload = {
  customer_account_public_id?: string;
  amount_minor?: number;
  currency?: string;
  reason_type?: string;
  source_type?: string | null;
  source_public_id?: string | null;
  expires_at?: string | null;
  reference?: string | null;
};

/**
 * Paginated list — GLOBAL (the index takes no account filter). Callers must
 * narrow to a single account by `customer_account_public_id`.
 */
export async function fetchAccountHolds(
  token: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PaginatedAccountHolds> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(`/api/v1/account-holds?${query.toString()}`, {
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
    throw new Error(`Failed to fetch account holds (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { account_holds?: AccountHold[] } | AccountHold[];
    meta?: PaginatedAccountHolds["meta"];
  };

  const rows: AccountHold[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.account_holds)
      ? envelope.data!.account_holds!
      : [];

  return {
    data: rows,
    meta: envelope.meta ?? {
      pagination: {
        current_page: 1,
        per_page: rows.length || 25,
        total: rows.length,
        last_page: 1,
      },
    },
  };
}

export async function createAccountHold(
  token: string,
  payload: AccountHoldWritePayload,
): Promise<AccountHold> {
  return apiRequest<AccountHold>("account-holds", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

/** Only `reference` is mutable; the endpoint ignores the rest. */
export async function updateAccountHold(
  token: string,
  publicId: string,
  payload: Pick<AccountHoldWritePayload, "reference">,
): Promise<AccountHold> {
  return apiRequest<AccountHold>(`account-holds/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

export async function releaseAccountHold(
  token: string,
  publicId: string,
  releaseReason?: string | null,
): Promise<AccountHold> {
  return apiRequest<AccountHold>(`account-holds/${publicId}/release`, {
    method: "POST",
    token,
    body: releaseReason ? { release_reason: releaseReason } : {},
  });
}

export async function deleteAccountHold(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`account-holds/${publicId}`, {
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
