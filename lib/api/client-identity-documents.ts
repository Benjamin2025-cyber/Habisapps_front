import { apiRequest, notifyAuthExpired } from "./client";

/**
 * Record lifecycle (soft-delete). A document is `active` on creation and
 * becomes `archived` via the `archive` action. NOT the KYC review state —
 * that lives on `verification_status`.
 */
export type IdentityDocumentStatus = "active" | "archived";

/**
 * KYC review workflow. `pending` on creation, then driven by the
 * submit/verify/reject actions. This is the state surfaced in the "Statut"
 * column and the one that gates the row actions.
 */
export type IdentityDocumentVerificationStatus =
  | "pending"
  | "pending_review"
  | "verified"
  | "rejected";

export type IdentityDocumentAction =
  | "submit"
  | "verify"
  | "reject"
  | "archive";

export type ClientIdentityDocument = {
  public_id: string;
  client_public_id: string | null;
  document_public_id: string | null;
  document_type: string;
  document_number: string;
  issuing_authority: string | null;
  issued_on: string | null;
  expires_on: string | null;
  status: IdentityDocumentStatus;
  verification_status: IdentityDocumentVerificationStatus;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IdentityDocumentWritePayload = {
  document_type?: string;
  document_number?: string;
  issuing_authority?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  document_public_id?: string | null;
};

export type IdentityDocumentStatusPayload = {
  action: IdentityDocumentAction;
  reason?: string | null;
  comment?: string | null;
  allow_self_verify?: boolean;
};

/**
 * Paginated list. The collection wraps under `data.identity_documents`.
 */
export async function fetchIdentityDocuments(
  token: string,
  clientPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<ClientIdentityDocument[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 50));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/clients/${clientPublicId}/identity-documents?${query.toString()}`,
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
      `Failed to fetch identity documents (HTTP ${response.status})`,
    );
  }

  const envelope = JSON.parse(text) as {
    data?:
      | { identity_documents?: ClientIdentityDocument[] }
      | ClientIdentityDocument[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.identity_documents ?? [];
}

export async function createIdentityDocument(
  token: string,
  clientPublicId: string,
  payload: IdentityDocumentWritePayload,
): Promise<ClientIdentityDocument> {
  return apiRequest<ClientIdentityDocument>(
    `clients/${clientPublicId}/identity-documents`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
}

export async function updateIdentityDocument(
  token: string,
  clientPublicId: string,
  publicId: string,
  payload: IdentityDocumentWritePayload,
): Promise<ClientIdentityDocument> {
  return apiRequest<ClientIdentityDocument>(
    `clients/${clientPublicId}/identity-documents/${publicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

export async function updateIdentityDocumentStatus(
  token: string,
  clientPublicId: string,
  publicId: string,
  payload: IdentityDocumentStatusPayload,
): Promise<ClientIdentityDocument> {
  return apiRequest<ClientIdentityDocument>(
    `clients/${clientPublicId}/identity-documents/${publicId}/status`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

function stripUndefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
