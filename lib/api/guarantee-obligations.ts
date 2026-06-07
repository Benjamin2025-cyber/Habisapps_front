import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P12 — Garants d'un prêt (guarantee obligations).
 *
 * Loan-scoped : `loans/{loan}/guarantee-obligations` (CRUD + `/release`).
 * Le garant est référencé via `client_guarantor_public_id` (un garant du client
 * du prêt, qui doit être actif + vérifié). À la création l'API fige un
 * `guarantor_identity_snapshot`. La libération n'est possible qu'après clôture
 * du prêt ; pour annuler avant clôture on passe par `status: cancelled`.
 *
 * Envelopes : LIST → `data.guarantee_obligations` ; CREATE/UPDATE/RELEASE →
 * l'entité directement sous `data`.
 */
export type GuaranteeObligationStatus = "active" | "released" | "cancelled";

export type GuarantorIdentitySnapshot = {
  client_guarantor_public_id?: string | null;
  guarantor_full_name?: string | null;
  guarantor_phone_number?: string | null;
  relationship_type?: string | null;
  verification_status?: string | null;
  [key: string]: unknown;
};

export type GuaranteeObligation = {
  public_id: string;
  agency_public_id: string | null;
  loan_public_id: string | null;
  client_guarantor_public_id: string | null;
  document_public_id: string | null;
  obligation_type: string;
  obligation_amount_minor: number | null;
  obligation_percentage: string | null;
  currency: string | null;
  status: GuaranteeObligationStatus;
  starts_on: string | null;
  ends_on: string | null;
  release_condition: string | null;
  released_at: string | null;
  released_by_user_public_id: string | null;
  guarantor_identity_snapshot: GuarantorIdentitySnapshot | null;
  created_at: string;
  updated_at: string;
};

export type GuaranteeObligationWritePayload = {
  client_guarantor_public_id?: string;
  document_public_id?: string | null;
  obligation_type?: string;
  obligation_amount_minor?: number | null;
  obligation_percentage?: number | null;
  currency?: string | null;
  /** active | cancelled on write — release goes through the dedicated endpoint. */
  status?: "active" | "cancelled";
  starts_on?: string | null;
  ends_on?: string | null;
  release_condition?: string | null;
};

export async function fetchGuaranteeObligations(
  token: string,
  loanPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<GuaranteeObligation[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/loans/${loanPublicId}/guarantee-obligations?${query.toString()}`,
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
      `Failed to fetch guarantee obligations (HTTP ${response.status})`,
    );
  }

  const envelope = JSON.parse(text) as {
    data?: { guarantee_obligations?: GuaranteeObligation[] } | GuaranteeObligation[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.guarantee_obligations ?? [];
}

export async function createGuaranteeObligation(
  token: string,
  loanPublicId: string,
  payload: GuaranteeObligationWritePayload,
): Promise<GuaranteeObligation> {
  return apiRequest<GuaranteeObligation>(
    `loans/${loanPublicId}/guarantee-obligations`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
}

export async function updateGuaranteeObligation(
  token: string,
  loanPublicId: string,
  obligationPublicId: string,
  payload: GuaranteeObligationWritePayload,
): Promise<GuaranteeObligation> {
  return apiRequest<GuaranteeObligation>(
    `loans/${loanPublicId}/guarantee-obligations/${obligationPublicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

/** Release an obligation. Requires the loan to be closed (else 422). */
export async function releaseGuaranteeObligation(
  token: string,
  loanPublicId: string,
  obligationPublicId: string,
): Promise<GuaranteeObligation> {
  return apiRequest<GuaranteeObligation>(
    `loans/${loanPublicId}/guarantee-obligations/${obligationPublicId}/release`,
    { method: "POST", token, body: {} },
  );
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
