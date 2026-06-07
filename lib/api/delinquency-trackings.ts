import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P14 — Suivis des exigibles (delinquency trackings).
 *
 * Loan-scoped : `loans/{loan}/delinquency-trackings` (GET liste, POST, PATCH).
 * Chaque suivi consigne un contact/relance : date, motif, type & date de
 * rendez-vous, montant promis, commentaires. `reason_code` / `appointment_type`
 * sont des chaînes libres côté API (max 64) — le FE propose des selects curés.
 *
 * Envelopes : LIST → `data.delinquency_trackings` + `meta.pagination` ;
 * CREATE/UPDATE → l'entité directement sous `data`.
 */
export type DelinquencyTracking = {
  public_id: string;
  client_public_id: string | null;
  loan_public_id: string | null;
  agency_public_id: string | null;
  tracking_date: string | null;
  reason_code: string | null;
  appointment_type: string | null;
  appointment_date: string | null;
  promised_amount_minor: number | null;
  currency: string | null;
  comments: string | null;
  created_by_user_public_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DelinquencyTrackingWritePayload = {
  tracking_date?: string | null;
  reason_code?: string | null;
  appointment_type?: string | null;
  appointment_date?: string | null;
  promised_amount_minor?: number | null;
  currency?: string | null;
  comments?: string | null;
};

export async function fetchDelinquencyTrackings(
  token: string,
  loanPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<DelinquencyTracking[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/loans/${loanPublicId}/delinquency-trackings?${query.toString()}`,
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
    throw new Error(
      `Failed to fetch delinquency trackings (HTTP ${response.status})`,
    );
  }

  const envelope = JSON.parse(text) as {
    data?:
      | { delinquency_trackings?: DelinquencyTracking[] }
      | DelinquencyTracking[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.delinquency_trackings ?? [];
}

export async function createDelinquencyTracking(
  token: string,
  loanPublicId: string,
  payload: DelinquencyTrackingWritePayload,
): Promise<DelinquencyTracking> {
  return apiRequest<DelinquencyTracking>(
    `loans/${loanPublicId}/delinquency-trackings`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
}

export async function updateDelinquencyTracking(
  token: string,
  loanPublicId: string,
  trackingPublicId: string,
  payload: DelinquencyTrackingWritePayload,
): Promise<DelinquencyTracking> {
  return apiRequest<DelinquencyTracking>(
    `loans/${loanPublicId}/delinquency-trackings/${trackingPublicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
