import { apiRequest, notifyAuthExpired } from "./client";
import type { Loan } from "./loans";

/**
 * P14 — Recouvrements (loan recovery attempts).
 *
 * Loan-scoped : `loans/{loan}/recovery-attempts` (GET historique, POST tentative).
 * Une tentative balaie les comptes du client liés au prêt pour récupérer le
 * montant demandé (débit + écriture comptable). Le prêt doit être disbursed /
 * active / rescheduled. Chaque tentative est figée avec un statut (succeeded /
 * failed), le montant récupéré et un éventuel motif d'échec.
 *
 * Envelopes : LIST → `data.recovery_attempts` + `meta.pagination` ;
 * CREATE → `data` = { loan, requested/recovered/remaining_amount_minor, attempts[] }.
 */
export type RecoveryAttemptStatus = "succeeded" | "failed";

export type LoanRecoveryAttempt = {
  public_id: string;
  loan_public_id: string | null;
  customer_account_public_id: string | null;
  loan_recovery_account_public_id: string | null;
  journal_entry_public_id: string | null;
  requested_amount_minor: number | null;
  recovered_amount_minor: number | null;
  currency: string | null;
  status: RecoveryAttemptStatus;
  attempted_at: string | null;
  failure_reason: string | null;
};

export type RecoveryResult = {
  loan: Loan;
  requested_amount_minor: number;
  recovered_amount_minor: number;
  remaining_amount_minor: number;
  attempts: LoanRecoveryAttempt[];
};

export async function fetchRecoveryAttempts(
  token: string,
  loanPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<LoanRecoveryAttempt[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/loans/${loanPublicId}/recovery-attempts?${query.toString()}`,
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
    throw new Error(
      `Failed to fetch recovery attempts (HTTP ${response.status})`,
    );
  }

  const envelope = JSON.parse(text) as {
    data?: { recovery_attempts?: LoanRecoveryAttempt[] } | LoanRecoveryAttempt[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.recovery_attempts ?? [];
}

/** Launch a recovery attempt. Loan must be disbursed/active/rescheduled. */
export async function createRecoveryAttempt(
  token: string,
  loanPublicId: string,
  payload: { requested_amount_minor: number; recovered_on?: string | null },
): Promise<RecoveryResult> {
  return apiRequest<RecoveryResult>(
    `loans/${loanPublicId}/recovery-attempts`,
    { method: "POST", token, body: payload },
  );
}
