import { apiRequest } from "./client";

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
 *  - Pas d'endpoint de liste : les transactions s'accumulent côté client le temps
 *    de la session de travail ; chaque transaction peut être **extournée**.
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
};

export async function storeCashDeposit(
  token: string,
  sessionPublicId: string,
  payload: CashDepositPayload,
): Promise<TellerTransaction> {
  return apiRequest<TellerTransaction>(
    `teller-sessions/${sessionPublicId}/deposits`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
}

export async function storeCashWithdrawal(
  token: string,
  sessionPublicId: string,
  payload: CashWithdrawalPayload,
): Promise<TellerTransaction> {
  return apiRequest<TellerTransaction>(
    `teller-sessions/${sessionPublicId}/withdrawals`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
}

export async function reverseTellerTransaction(
  token: string,
  transactionPublicId: string,
): Promise<TellerTransaction> {
  return apiRequest<TellerTransaction>(
    `teller-transactions/${transactionPublicId}/reverse`,
    { method: "POST", token },
  );
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
