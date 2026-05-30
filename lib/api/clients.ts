import { apiRequest, notifyAuthExpired } from "./client";

export type ClientStatus = "active" | "inactive" | "suspended" | "archived";

export type ClientKycStatus =
  | "draft"
  | "pending_review"
  | "verified"
  | "rejected"
  | "suspended"
  | "archived";

export type ClientCollectionFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export type Client = {
  public_id: string;
  agency_public_id: string | null;
  profile_photo_document_public_id: string | null;
  prospector_public_id: string | null;
  collection_agent_public_id: string | null;
  sector_public_id: string | null;
  sub_sector_public_id: string | null;
  client_reference: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: string | null;
  phone_number: string | null;
  home_phone_number: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  occupation: string | null;
  employer_name: string | null;
  business_started_on: string | null;
  business_activity_started_on: string | null;
  business_address_line_1: string | null;
  business_address_line_2: string | null;
  business_city: string | null;
  business_region: string | null;
  collection_type: string | null;
  collection_frequency: ClientCollectionFrequency | null;
  collection_target_amount: number | null;
  status: ClientStatus;
  kyc_status: ClientKycStatus;
  onboarded_on: string | null;
  kyc_submitted_at: string | null;
  kyc_verified_at: string | null;
  kyc_rejected_at: string | null;
  kyc_rejection_reason: string | null;
  kyc_suspended_at: string | null;
  kyc_archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedClients = {
  data: Client[];
  meta: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
};

export type ClientWritePayload = {
  agency_public_id?: string | null;
  profile_photo_document_public_id?: string | null;
  prospector_public_id?: string | null;
  collection_agent_public_id?: string | null;
  sector_public_id?: string | null;
  sub_sector_public_id?: string | null;
  first_name?: string;
  last_name?: string;
  middle_name?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
  phone_number?: string | null;
  home_phone_number?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  region?: string | null;
  occupation?: string | null;
  employer_name?: string | null;
  business_started_on?: string | null;
  business_activity_started_on?: string | null;
  business_address_line_1?: string | null;
  business_address_line_2?: string | null;
  business_city?: string | null;
  business_region?: string | null;
  collection_type?: string | null;
  collection_frequency?: ClientCollectionFrequency | null;
  collection_target_amount?: number | null;
  status?: ClientStatus;
  onboarded_on?: string | null;
};

export type KycAction = "submit" | "verify" | "reject" | "suspend" | "archive";

export type KycActionPayload = {
  action: KycAction;
  reason?: string | null;
  comment?: string | null;
  force_override_expired_identity?: boolean;
  allow_self_verify?: boolean;
};

/**
 * Paginated list. The endpoint defaults to agency-scoped — pass `scope=all`
 * to broaden to institution level (requires `crm.scope.institution.read`).
 */
export async function fetchClients(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    scope?: "all";
    status?: ClientStatus;
    kycStatus?: ClientKycStatus;
    /** Free-text search (ilike on reference / names / phone / email). */
    search?: string;
  } = {},
): Promise<PaginatedClients> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.scope) query.set("scope", options.scope);
  if (options.status) query.set("filter[status]", options.status);
  if (options.kycStatus) query.set("filter[kyc_status]", options.kycStatus);
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }

  const response = await fetch(`/api/v1/clients?${query.toString()}`, {
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
    throw new Error(`Failed to fetch clients (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { clients?: Client[] } | Client[];
    meta?: PaginatedClients["meta"];
  };

  const rows: Client[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.clients)
      ? envelope.data!.clients!
      : [];

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

export async function getClient(
  token: string,
  publicId: string,
): Promise<Client> {
  return apiRequest<Client>(`clients/${publicId}`, { method: "GET", token });
}

export async function createClient(
  token: string,
  payload: ClientWritePayload,
): Promise<Client> {
  return apiRequest<Client>("clients", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateClient(
  token: string,
  publicId: string,
  payload: ClientWritePayload,
): Promise<Client> {
  return apiRequest<Client>(`clients/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateClientStatus(
  token: string,
  publicId: string,
  status: ClientStatus,
): Promise<Client> {
  // Regular status changes go through the generic update endpoint.
  return updateClient(token, publicId, { status });
}

export async function updateClientKycStatus(
  token: string,
  publicId: string,
  payload: KycActionPayload,
): Promise<Client> {
  return apiRequest<Client>(`clients/${publicId}/kyc-status`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
