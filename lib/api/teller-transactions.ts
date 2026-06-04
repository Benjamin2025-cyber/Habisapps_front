import { apiRequest, notifyAuthExpired } from "./client";

/**
 * P21 — Caisse › Retrait/Versement (teller transactions). Mouvements d'espèces
 * passés sur une **session de caisse ouverte** : versement (dépôt) et retrait.
 *
 * La comptabilisation se fait directement entre le **compte comptable de la
 * caisse** (till.ledger_account) et le **compte comptable du compte client** —
 * les deux doivent exister et être actifs dans l'agence de la session.
 *
 * Particularités API :
 *  - Un **retrait exige une signature vérifiée** du compte (`signature_public_id`)
 *    + une méthode de vérification.
 *  - Liste : `GET /teller-transactions` (filtres serveur, cf `fetchTellerTransactions`) ;
 *    chaque transaction peut être **extournée**.
 *  - CREATE / reverse renvoient la transaction directement sous `data`.
 */
export type TellerTransactionType = "deposit" | "withdrawal" | string;
export type TellerTransactionStatus = "posted" | "reversed" | string;

export type InitiatorType = "holder" | "proxy" | "staff_on_behalf" | "system";

export type SignatureVerificationMethod =
  | "visual_match"
  | "thumbprint_match"
  | "verified_proxy_mandate"
  | "exception_override";

export type TellerTransaction = {
  public_id: string;
  teller_session_public_id: string | null;
  till_public_id: string | null;
  customer_account_public_id: string | null;
  journal_entry_public_id: string | null;
  transaction_date: string | null;
  transaction_type: TellerTransactionType;
  amount_minor: number;
  currency: string | null;
  status: TellerTransactionStatus;
  reference: string | null;
  event_number: number | null;
  operation_code: string | null;
  depositor_name: string | null;
  depositor_address: string | null;
  initiator_type: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedTellerTransactions = {
  data: TellerTransaction[];
  meta: { pagination: Pagination };
};

/** Server-side filters for `GET /teller-transactions` (#24a). */
export type TellerTransactionFilters = {
  page?: number;
  perPage?: number;
  tellerSessionPublicId?: string;
  tillPublicId?: string;
  tellerUserPublicId?: string;
  transactionType?: string;
  status?: string;
  transactionDate?: string;
  transactionDateFrom?: string;
  transactionDateTo?: string;
  customerAccountPublicId?: string;
  search?: string;
};

/** Paginated cash-transaction history (data.teller_transactions + meta.pagination). */
export async function fetchTellerTransactions(
  token: string,
  options: TellerTransactionFilters = {},
): Promise<PaginatedTellerTransactions> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.search) query.set("search", options.search);
  const filters: Array<[string, string | undefined]> = [
    ["teller_session_public_id", options.tellerSessionPublicId],
    ["till_public_id", options.tillPublicId],
    ["teller_user_public_id", options.tellerUserPublicId],
    ["transaction_type", options.transactionType],
    ["status", options.status],
    ["transaction_date", options.transactionDate],
    ["transaction_date_from", options.transactionDateFrom],
    ["transaction_date_to", options.transactionDateTo],
    ["customer_account_public_id", options.customerAccountPublicId],
  ];
  for (const [key, value] of filters) {
    if (value) query.set(`filter[${key}]`, value);
  }

  const response = await fetch(`/api/v1/teller-transactions?${query.toString()}`, {
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
    throw new Error(`Failed to fetch teller transactions (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { teller_transactions?: TellerTransaction[] } | TellerTransaction[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: TellerTransaction[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.teller_transactions)
      ? envelope.data!.teller_transactions!
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

/**
 * One denomination line of a cash count. Required by the deposit/withdrawal
 * endpoints when the till has `requires_denominations` and there is a cash
 * component — the backend checks that Σ(value × count) equals the cash amount.
 */
export type DenominationCount = {
  denomination_public_id: string;
  count: number;
};

export type CashDepositPayload = {
  customer_account_public_id: string;
  amount_minor: number;
  currency?: string;
  operation_code?: string | null;
  depositor_name?: string | null;
  depositor_address?: string | null;
  initiator_type?: InitiatorType;
  initiator_proxy_public_id?: string | null;
  description?: string | null;
  denomination_counts?: DenominationCount[];
};

export type CashWithdrawalPayload = {
  customer_account_public_id: string;
  amount_minor: number;
  currency?: string;
  operation_code?: string | null;
  initiator_type?: InitiatorType;
  initiator_proxy_public_id?: string | null;
  signature_public_id: string;
  signature_verification_method: SignatureVerificationMethod;
  description?: string | null;
  denomination_counts?: DenominationCount[];
};

/**
 * deposits / withdrawals / reverse all return the transaction nested under
 * `data.teller_transaction` (alongside `data.journal_entry`), so unwrap it.
 */
type TransactionEnvelope = {
  teller_transaction: TellerTransaction;
  journal_entry?: unknown;
};

export async function storeCashDeposit(
  token: string,
  sessionPublicId: string,
  payload: CashDepositPayload,
): Promise<TellerTransaction> {
  const data = await apiRequest<TransactionEnvelope>(
    `teller-sessions/${sessionPublicId}/deposits`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
  return data.teller_transaction;
}

export async function storeCashWithdrawal(
  token: string,
  sessionPublicId: string,
  payload: CashWithdrawalPayload,
): Promise<TellerTransaction> {
  const data = await apiRequest<TransactionEnvelope>(
    `teller-sessions/${sessionPublicId}/withdrawals`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
  return data.teller_transaction;
}

export async function reverseTellerTransaction(
  token: string,
  transactionPublicId: string,
): Promise<TellerTransaction> {
  const data = await apiRequest<TransactionEnvelope>(
    `teller-transactions/${transactionPublicId}/reverse`,
    { method: "POST", token },
  );
  return data.teller_transaction;
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
