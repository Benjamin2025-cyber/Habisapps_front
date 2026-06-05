import { apiRequest, notifyAuthExpired } from "./client";

/**
 * Record lifecycle. `active` on creation, `inactive` via the `deactivate`
 * action, `archived` via `archive`. NOT the KYC review state — that lives on
 * `verification_status`.
 */
export type GuarantorStatus = "active" | "inactive" | "archived";

/**
 * KYC review workflow. `pending` on creation, then driven by the
 * submit/verify/reject actions. This is the state surfaced in the "Statut"
 * column and the one that gates the row actions.
 */
export type GuarantorVerificationStatus =
  | "pending"
  | "pending_review"
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
  /** Identity-document type key from the backend catalog (issue #4). */
  document_type: string | null;
  document_public_id: string | null;
  /** Verso/back face of the guarantor's ID document (issue #4). */
  back_document_public_id: string | null;
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
  document_type?: string | null;
  document_public_id?: string | null;
  back_document_public_id?: string | null;
};

export type GuarantorStatusPayload = {
  action: GuarantorAction;
  reason?: string | null;
  comment?: string | null;
  /** Maker-checker self-verification override (back-issue #6). */
  allow_self_verify?: boolean;
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

export type PaginatedGuarantors = {
  data: ClientGuarantor[];
  meta: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
};

/**
 * Institution-wide guarantor directory — `GET /guarantors` (back-issue #13).
 * Transversal read-only view across clients. `scope: "all"` broadens beyond the
 * current agency (needs `crm.scope.institution.read`); otherwise agency-scoped.
 * Each row carries `client_public_id` to link back to the owning client.
 */
export async function fetchGuarantorsDirectory(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    scope?: "all";
    status?: GuarantorStatus;
    verificationStatus?: GuarantorVerificationStatus;
    agencyPublicId?: string;
    search?: string;
  } = {},
): Promise<PaginatedGuarantors> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.scope) query.set("scope", options.scope);
  if (options.status) query.set("filter[status]", options.status);
  if (options.verificationStatus) {
    query.set("filter[verification_status]", options.verificationStatus);
  }
  if (options.agencyPublicId) {
    query.set("filter[agency_public_id]", options.agencyPublicId);
  }
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }

  const response = await fetch(`/api/v1/guarantors?${query.toString()}`, {
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
    throw new Error(`Failed to fetch guarantors (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { guarantors?: ClientGuarantor[] } | ClientGuarantor[];
    meta?: PaginatedGuarantors["meta"];
  };
  const rows = Array.isArray(envelope.data)
    ? envelope.data
    : (envelope.data?.guarantors ?? []);
  return {
    data: rows,
    meta: envelope.meta ?? {
      pagination: {
        current_page: 1,
        per_page: rows.length || 25,
        total: rows.length,
        last_page: 1,
      },
    },
  };
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
