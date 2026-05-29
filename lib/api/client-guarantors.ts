import { apiRequest, notifyAuthExpired } from "./client";

export type GuarantorStatus =
  | "draft"
  | "pending_review"
  | "verified"
  | "rejected"
  | "deactivated"
  | "archived";

export type GuarantorVerificationStatus =
  | "not_submitted"
  | "submitted"
  | "verified"
  | "rejected";

export type GuarantorAction =
  | "submit"
  | "verify"
  | "reject"
  | "archive"
  | "deactivate";

export type ClientGuarantor = {
  public_id: string;
  client_public_id: string | null;
  guarantor_client_public_id: string | null;
  document_public_id: string | null;
  guarantor_full_name: string | null;
  guarantor_phone_number: string | null;
  relationship_type: string | null;
  status: GuarantorStatus;
  verification_status: GuarantorVerificationStatus;
  starts_on: string | null;
  ends_on: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GuarantorWritePayload = {
  guarantor_client_public_id?: string | null;
  guarantor_full_name?: string | null;
  guarantor_phone_number?: string | null;
  relationship_type?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  document_public_id?: string | null;
};

export type GuarantorStatusPayload = {
  action: GuarantorAction;
  reason?: string | null;
  comment?: string | null;
};

export async function fetchGuarantors(
  token: string,
  clientPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<ClientGuarantor[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 50));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/clients/${clientPublicId}/guarantors?${query.toString()}`,
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
    throw new Error(`Failed to fetch guarantors (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { guarantors?: ClientGuarantor[] } | ClientGuarantor[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.guarantors ?? [];
}

export async function createGuarantor(
  token: string,
  clientPublicId: string,
  payload: GuarantorWritePayload,
): Promise<ClientGuarantor> {
  return apiRequest<ClientGuarantor>(`clients/${clientPublicId}/guarantors`, {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateGuarantor(
  token: string,
  clientPublicId: string,
  publicId: string,
  payload: GuarantorWritePayload,
): Promise<ClientGuarantor> {
  return apiRequest<ClientGuarantor>(
    `clients/${clientPublicId}/guarantors/${publicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

export async function updateGuarantorStatus(
  token: string,
  clientPublicId: string,
  publicId: string,
  payload: GuarantorStatusPayload,
): Promise<ClientGuarantor> {
  return apiRequest<ClientGuarantor>(
    `clients/${clientPublicId}/guarantors/${publicId}/status`,
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
