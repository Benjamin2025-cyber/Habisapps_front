import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P7 — Référentiel Comptes clients.
 *
 * Two distinct concepts live on a customer account, same split as the KYC
 * sub-resources: `status` is the account lifecycle, while balances/holds are
 * computed server-side and returned as `*_minor` integers (render with
 * `format.currencyMinor`).
 *
 * API shape notes:
 * - LIST wraps rows under `data.customer_accounts` + `meta.pagination`.
 * - SHOW / CREATE / UPDATE return the account directly under `data`.
 * - SHOW + balance + statement require the `view` policy (platform-admin).
 */
export type CustomerAccountStatus =
  | "active"
  | "suspended"
  | "closed"
  | "archived";

export type CustomerAccount = {
  public_id: string;
  client_public_id: string | null;
  agency_public_id: string | null;
  ledger_account_public_id: string | null;
  account_product_public_id: string | null;
  account_number: string;
  account_title: string | null;
  account_type: string | null;
  currency: string | null;
  unavailable_amount_minor: number | null;
  opened_on: string | null;
  closed_on: string | null;
  status: CustomerAccountStatus;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedCustomerAccounts = {
  data: CustomerAccount[];
  meta: { pagination: Pagination };
};

export type CustomerAccountWritePayload = {
  client_public_id?: string;
  agency_public_id?: string | null;
  ledger_account_public_id?: string | null;
  account_product_public_id?: string | null;
  account_number?: string;
  account_title?: string | null;
  account_type?: string | null;
  currency?: string | null;
  opened_on?: string;
  closed_on?: string | null;
  status?: CustomerAccountStatus;
};

/** Accounting balance over a (optional) date range. */
export type AccountBalance = {
  scope: string;
  public_id: string;
  currency: string;
  from: string | null;
  to: string | null;
  debit_total_minor: number;
  credit_total_minor: number;
  balance_minor: number;
  normal_balance_side: string;
};

/** Available balance breakdown: accounting balance minus floors and holds. */
export type AccountAvailableBalance = {
  scope: string;
  public_id: string;
  currency: string;
  accounting_balance_minor: number;
  minimum_balance_minor: number;
  unavailable_amount_minor: number;
  active_hold_amount_minor: number;
  available_balance_minor: number;
};

export type AccountStatementSummary = {
  scope: string;
  public_id: string;
  currency: string;
  from: string | null;
  to: string | null;
  opening_balance_minor: number;
  debit_total_minor: number;
  credit_total_minor: number;
  closing_balance_minor: number;
  normal_balance_side: string;
};

export type AccountMovement = {
  public_id: string;
  journal_entry_public_id: string | null;
  ledger_account_public_id: string | null;
  reference: string | null;
  business_date: string | null;
  currency: string;
  debit_minor: number;
  credit_minor: number;
  signed_amount_minor: number;
  line_memo: string | null;
};

export type AccountStatement = {
  statement: AccountStatementSummary;
  movements: AccountMovement[];
  pagination: Pagination;
};

/**
 * Paginated list. Filters are plain query params (`status`,
 * `client_public_id`) — the index does NOT use spatie `filter[...]` syntax.
 */
export async function fetchCustomerAccounts(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    status?: CustomerAccountStatus;
    clientPublicId?: string;
  } = {},
): Promise<PaginatedCustomerAccounts> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);
  if (options.clientPublicId) query.set("client_public_id", options.clientPublicId);

  const response = await fetch(`/api/v1/customer-accounts?${query.toString()}`, {
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
    throw new Error(`Failed to fetch customer accounts (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { customer_accounts?: CustomerAccount[] } | CustomerAccount[];
    meta?: PaginatedCustomerAccounts["meta"];
  };

  const rows: CustomerAccount[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.customer_accounts)
      ? envelope.data!.customer_accounts!
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

export async function getCustomerAccount(
  token: string,
  publicId: string,
): Promise<CustomerAccount> {
  return apiRequest<CustomerAccount>(`customer-accounts/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function createCustomerAccount(
  token: string,
  payload: CustomerAccountWritePayload,
): Promise<CustomerAccount> {
  return apiRequest<CustomerAccount>("customer-accounts", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateCustomerAccount(
  token: string,
  publicId: string,
  payload: CustomerAccountWritePayload,
): Promise<CustomerAccount> {
  return apiRequest<CustomerAccount>(`customer-accounts/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

/** Archive (soft-delete) an account. */
export async function deleteCustomerAccount(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`customer-accounts/${publicId}`, {
    method: "DELETE",
    token,
  });
}

export async function fetchAccountBalance(
  token: string,
  publicId: string,
  options: { currency?: string } = {},
): Promise<AccountBalance> {
  return apiRequest<AccountBalance>(`customer-accounts/${publicId}/balance`, {
    method: "GET",
    token,
    query: { currency: options.currency },
  });
}

export async function fetchAccountAvailableBalance(
  token: string,
  publicId: string,
  options: { currency?: string } = {},
): Promise<AccountAvailableBalance> {
  return apiRequest<AccountAvailableBalance>(
    `customer-accounts/${publicId}/available-balance`,
    { method: "GET", token, query: { currency: options.currency } },
  );
}

export async function fetchAccountStatement(
  token: string,
  publicId: string,
  options: {
    currency?: string;
    from?: string;
    to?: string;
    page?: number;
    perPage?: number;
  } = {},
): Promise<AccountStatement> {
  return apiRequest<AccountStatement>(
    `customer-accounts/${publicId}/statement`,
    {
      method: "GET",
      token,
      query: {
        currency: options.currency,
        from: options.from,
        to: options.to,
        page: options.page,
        per_page: options.perPage,
      },
    },
  );
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
