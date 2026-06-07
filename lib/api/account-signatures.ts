import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P7 — Spécimens de signature d'un compte client.
 *
 * Lecture + vérification + révocation. La création nécessite un document de
 * signature téléversé (gestion documentaire non encore disponible côté FE) et
 * est donc différée.
 *
 * API: la liste est imbriquée sous `data.signatures` ; verify/revoke renvoient
 * la signature directement sous `data`.
 */
export type SignatureType =
  | "primary_holder"
  | "joint_holder"
  | "proxy"
  | "mandate"
  | "thumbprint";

export type SignatureStatus = "active" | "superseded" | "revoked" | "archived";

export type CustomerAccountSignature = {
  public_id: string;
  agency_public_id: string | null;
  customer_account_public_id: string | null;
  client_public_id: string | null;
  document_public_id: string | null;
  client_proxy_public_id: string | null;
  signature_type: SignatureType;
  signer_name: string | null;
  signer_role: string | null;
  status: SignatureStatus;
  captured_on: string | null;
  verified_at: string | null;
  verified_by_user_public_id: string | null;
  revoked_at: string | null;
  revoked_by_user_public_id: string | null;
  revocation_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/** Nested list under a customer account. */
export async function fetchAccountSignatures(
  token: string,
  accountPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<CustomerAccountSignature[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 50));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/customer-accounts/${accountPublicId}/signatures?${query.toString()}`,
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
    throw new Error(`Failed to fetch signatures (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { signatures?: CustomerAccountSignature[] } | CustomerAccountSignature[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.signatures ?? [];
}

export type SignatureCreatePayload = {
  /** public_id of an uploaded signature document (category signature/thumbprint…). */
  document_public_id: string;
  signature_type: SignatureType;
  signer_name?: string | null;
  signer_role?: string | null;
  captured_on?: string | null;
  /** Required for proxy/mandate signature types. */
  client_proxy_public_id?: string | null;
};

/**
 * Register a signature specimen on an account. Backed by an uploaded signature
 * document. Created `active` immediately (usable for withdrawal verification).
 */
export async function createAccountSignature(
  token: string,
  accountPublicId: string,
  payload: SignatureCreatePayload,
): Promise<CustomerAccountSignature> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && value !== "") body[key] = value;
  }
  return apiRequest<CustomerAccountSignature>(
    `customer-accounts/${accountPublicId}/signatures`,
    { method: "POST", token, body },
  );
}

export async function verifyAccountSignature(
  token: string,
  accountPublicId: string,
  signaturePublicId: string,
): Promise<CustomerAccountSignature> {
  return apiRequest<CustomerAccountSignature>(
    `customer-accounts/${accountPublicId}/signatures/${signaturePublicId}/verify`,
    { method: "POST", token, body: {} },
  );
}

export async function revokeAccountSignature(
  token: string,
  accountPublicId: string,
  signaturePublicId: string,
  reason: string,
): Promise<CustomerAccountSignature> {
  return apiRequest<CustomerAccountSignature>(
    `customer-accounts/${accountPublicId}/signatures/${signaturePublicId}/revoke`,
    { method: "POST", token, body: { reason } },
  );
}
