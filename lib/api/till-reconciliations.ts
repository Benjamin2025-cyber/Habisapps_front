import { apiRequest, notifyAuthExpired } from "./client";

/**
 * P22 — Réconciliations de caisse (arrêtés de caisse) d'une session.
 * Une réconciliation compare le **solde théorique** (fonds d'ouverture +
 * versements − retraits) au **solde réel compté** (détail des coupures) ; l'écart
 * doit être nul pour être enregistrée.
 *
 * Shape liste : `data.till_reconciliations` (collection, pas de pagination).
 * CREATE : `data.till_reconciliation`. La création EXIGE le détail des coupures
 * (table `denominations` — cf P25) ; en lecture seule tant que P25 n'est pas livré.
 */
export type ReconciliationStatus = "balanced" | "surplus" | "shortage" | string;

export type ReconciliationLine = {
  denomination_public_id: string | null;
  count: number;
  declared_amount_minor: number;
};

export type TillReconciliation = {
  public_id: string;
  teller_session_public_id: string | null;
  counted_by_user_public_id: string | null;
  counted_at: string | null;
  reconciliation_date: string | null;
  theoretical_balance_minor: number;
  actual_balance_minor: number;
  difference_minor: number;
  currency: string | null;
  status: ReconciliationStatus;
  notes: string | null;
  lines: ReconciliationLine[];
  created_at: string;
  updated_at: string;
};

export type ReconciliationCreatePayload = {
  currency?: string;
  notes?: string | null;
  denomination_counts: Array<{ denomination_public_id: string; count: number }>;
};

export async function fetchSessionReconciliations(
  token: string,
  sessionPublicId: string,
): Promise<TillReconciliation[]> {
  const response = await fetch(
    `/api/v1/teller-sessions/${sessionPublicId}/reconciliations`,
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
    throw new Error(`Failed to fetch reconciliations (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { till_reconciliations?: TillReconciliation[] } | TillReconciliation[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.till_reconciliations ?? [];
}

export async function createSessionReconciliation(
  token: string,
  sessionPublicId: string,
  payload: ReconciliationCreatePayload,
): Promise<TillReconciliation> {
  return apiRequest<TillReconciliation>(
    `teller-sessions/${sessionPublicId}/reconciliations`,
    { method: "POST", token, body: payload },
  );
}
