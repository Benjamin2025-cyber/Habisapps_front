import { apiRequest, notifyAuthExpired } from "./client";
import type { Loan } from "./loans";

/**
 * P13 — Mutation de prêt (réaffectation du gestionnaire / agent de crédit).
 *
 * Loan-scoped : `loans/{loan}/transfers` (GET historique, POST mutation). Une
 * mutation réassigne le `credit_agent` du prêt de `initial_manager` vers
 * `new_manager`. Le nouveau gestionnaire doit être **actif et rattaché à
 * l'agence du prêt** ; le prêt ne doit pas être clôturé / rejeté / passé en
 * perte et doit avoir un gestionnaire courant.
 *
 * Envelopes : LIST → `data.loan_transfers` ; CREATE → `data.loan` + `data.transfer`.
 */
export type LoanTransfer = {
  public_id: string;
  agency_public_id: string | null;
  loan_public_id: string | null;
  initial_manager_public_id: string | null;
  new_manager_public_id: string | null;
  transfer_reason: string | null;
  transfer_date: string | null;
  approved_by_user_public_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LoanTransferPayload = {
  new_manager_public_id: string;
  transfer_reason: string;
  transfer_date?: string | null;
};

export async function fetchLoanTransfers(
  token: string,
  loanPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<LoanTransfer[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 50));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/loans/${loanPublicId}/transfers?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    },
  );

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch loan transfers (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { loan_transfers?: LoanTransfer[] } | LoanTransfer[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.loan_transfers ?? [];
}

export async function createLoanTransfer(
  token: string,
  loanPublicId: string,
  payload: LoanTransferPayload,
): Promise<{ loan: Loan; transfer: LoanTransfer }> {
  return apiRequest<{ loan: Loan; transfer: LoanTransfer }>(
    `loans/${loanPublicId}/transfers`,
    { method: "POST", token, body: payload },
  );
}
