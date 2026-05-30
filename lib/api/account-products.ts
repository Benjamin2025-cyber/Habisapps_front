import { apiRequest, notifyAuthExpired } from "./client";

/**
 * P7+ — Produits de compte (catalogue des « types de compte »).
 *
 * Catalogue géré par le super-admin (`platform-admin` ou `account.products.*`).
 * Un compte client (`customer_accounts.account_product_public_id`) pointe vers
 * un produit, qui porte la famille, le solde minimum, la politique de découvert,
 * etc.
 *
 * API shape: LIST wraps under `data.account_products` + `meta.pagination`;
 * SHOW / CREATE / UPDATE return the product directly under `data`.
 */
export type AccountFamily = "savings" | "current" | "recovery" | "islamic";

export type AccountProductStatus = "active" | "inactive" | "archived";

export type AccountProduct = {
  public_id: string;
  agency_public_id: string | null;
  ledger_account_public_id: string | null;
  code: string;
  name: string;
  account_family: AccountFamily;
  minimum_balance_minor: number | null;
  currency: string | null;
  allows_recovery_debit: boolean | null;
  is_recovery_account: boolean | null;
  is_ordinary_savings: boolean | null;
  allows_overdraft: boolean | null;
  overdraft_limit_minor: number | null;
  status: AccountProductStatus;
  rules: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedAccountProducts = {
  data: AccountProduct[];
  meta: { pagination: Pagination };
};

export type AccountProductWritePayload = {
  agency_public_id?: string | null;
  ledger_account_public_id?: string | null;
  /** Immutable after creation — the update endpoint ignores it. */
  code?: string;
  name?: string;
  account_family?: AccountFamily;
  minimum_balance_minor?: number | null;
  currency?: string | null;
  allows_recovery_debit?: boolean;
  is_recovery_account?: boolean;
  is_ordinary_savings?: boolean;
  allows_overdraft?: boolean;
  overdraft_limit_minor?: number | null;
  /** Create accepts active/inactive; archive happens via DELETE. */
  status?: "active" | "inactive";
};

/**
 * Paginated list. Filters are plain query params (`account_family`, `status`).
 */
export async function fetchAccountProducts(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    accountFamily?: AccountFamily;
    status?: AccountProductStatus;
  } = {},
): Promise<PaginatedAccountProducts> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.accountFamily) query.set("account_family", options.accountFamily);
  if (options.status) query.set("status", options.status);

  const response = await fetch(`/api/v1/account-products?${query.toString()}`, {
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
    throw new Error(`Failed to fetch account products (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { account_products?: AccountProduct[] } | AccountProduct[];
    meta?: PaginatedAccountProducts["meta"];
  };

  const rows: AccountProduct[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.account_products)
      ? envelope.data!.account_products!
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

export async function getAccountProduct(
  token: string,
  publicId: string,
): Promise<AccountProduct> {
  return apiRequest<AccountProduct>(`account-products/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function createAccountProduct(
  token: string,
  payload: AccountProductWritePayload,
): Promise<AccountProduct> {
  return apiRequest<AccountProduct>("account-products", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateAccountProduct(
  token: string,
  publicId: string,
  payload: AccountProductWritePayload,
): Promise<AccountProduct> {
  return apiRequest<AccountProduct>(`account-products/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

/** Archive (soft-delete) a product. */
export async function deleteAccountProduct(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`account-products/${publicId}`, {
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
