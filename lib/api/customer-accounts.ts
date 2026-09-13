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
  client_display_name: string | null;
  agency_public_id: string | null;
  agency_name: string | null;
  ledger_account_public_id: string | null;
  ledger_account_code: string | null;
  account_product_public_id: string | null;
  account_product_name: string | null;
  account_product_family: string | null;
  account_number: string;
  account_title: string | null;
  account_type: string | null;
  currency: string | null;
  unavailable_amount_minor: number | null;
  /**
   * « Frais d'ouverture » the next counter operation will sweep to 7611, in
   * minor units — the tariff fixed the day this account was opened, not the
   * product's figure today. 0 once collected, or when the account was opened
   * under a tariff that charged nothing.
   */
  pending_opening_fee_minor: number;
  opening_fee_collected_at: string | null;
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

/**
 * Available balance breakdown: accounting balance minus floors and holds, plus
 * any authorised overdraft.
 *
 * `real_balance_minor` is the « solde réel » — the money the account actually
 * holds — and is served rather than derived on screen: the shorthand
 * `available + minimum` only equals it when the account carries no hold and no
 * overdraft facility.
 */
export type AccountAvailableBalance = {
  scope: string;
  public_id: string;
  currency: string;
  accounting_balance_minor: number;
  real_balance_minor: number;
  minimum_balance_minor: number;
  unavailable_amount_minor: number;
  active_hold_amount_minor: number;
  overdraft_limit_minor: number;
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
  journal_entry_status: string | null;
  /**
   * The entry behind this line has been contre-passée. Both halves of an
   * annulled pair stay on the books and both print on the relevé, so the line
   * has to say which is which.
   */
  reversed: boolean;
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
  /*
   * The statement puts its rows in `data` and its pagination in `meta`, and
   * `apiRequest` hands back `data` alone — so `pagination` arrived undefined
   * on every call. That silently cost two things: the movements pager never
   * rendered, and the print walk, which stops at `last_page`, saw 1 and
   * printed only the first page of a multi-page relevé. Read the envelope
   * here and put the two halves back together.
   */
  const query = new URLSearchParams();
  if (options.currency) query.set("currency", options.currency);
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  if (options.page) query.set("page", String(options.page));
  if (options.perPage) query.set("per_page", String(options.perPage));

  const response = await fetch(
    `/api/v1/customer-accounts/${publicId}/statement?${query.toString()}`,
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
    throw new Error(`Failed to fetch the account statement (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { statement?: AccountStatementSummary; movements?: AccountMovement[] };
    meta?: { pagination?: Partial<Pagination> };
  };
  const m = envelope.meta?.pagination ?? {};

  return {
    statement: envelope.data?.statement as AccountStatementSummary,
    movements: envelope.data?.movements ?? [],
    pagination: {
      current_page: m.current_page ?? 1,
      per_page: m.per_page ?? options.perPage ?? 25,
      total: m.total ?? (envelope.data?.movements?.length ?? 0),
      last_page: m.last_page ?? 1,
    },
  };
}


function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
