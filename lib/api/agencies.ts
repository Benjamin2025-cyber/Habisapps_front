import { apiRequest, notifyAuthExpired } from "./client";

export type AgencyStatus = "active" | "inactive" | "suspended" | "archived";

export type Agency = {
  public_id: string;
  code: string;
  name: string;
  region: string | null;
  city: string | null;
  branch_name: string | null;
  branch_type: string | null;
  phone_number: string | null;
  fax_number: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  po_box: string | null;
  geographic_description: string | null;
  creation_date: string | null;
  status: AgencyStatus;
  manager_public_id: string | null;
  manager_name: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedAgencies = {
  data: Agency[];
  meta: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
};

export type AgencyWritePayload = {
  code?: string;
  name?: string;
  region?: string | null;
  city?: string | null;
  branch_name?: string | null;
  branch_type?: string | null;
  phone_number?: string | null;
  fax_number?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  po_box?: string | null;
  geographic_description?: string | null;
  creation_date?: string | null;
  status?: AgencyStatus | null;
  manager_public_id?: string | null;
};

/**
 * Paginated list. The API wraps the rows under `data.agencies` (with
 * pagination meta as a sibling of `data`), so we read the raw envelope here
 * instead of going through `apiRequest` which would only surface `data`.
 *
 * Server-side filtering isn't supported by this endpoint yet, so
 * status/text filtering is applied client-side at the call site.
 */
export async function fetchAgencies(
  token: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PaginatedAgencies> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) {
    query.set("page", String(options.page));
  }

  const response = await fetch(`/api/v1/agencies?${query.toString()}`, {
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
    if (response.status === 401) {
      notifyAuthExpired();
    }
    throw new Error(`Failed to fetch agencies (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { agencies?: Agency[] } | Agency[];
    meta?: PaginatedAgencies["meta"];
  };

  const rows: Agency[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.agencies)
      ? envelope.data!.agencies!
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

/**
 * Compact list used by the dashboard filters. Kept for backwards-compatibility.
 */
export async function listAgencies(
  token: string,
  options: { perPage?: number; status?: AgencyStatus } = {},
): Promise<Agency[]> {
  const response = await fetchAgencies(token, {
    perPage: options.perPage ?? 100,
  });
  if (options.status) {
    return response.data.filter((agency) => agency.status === options.status);
  }
  return response.data;
}

export async function getAgency(token: string, publicId: string): Promise<Agency> {
  return apiRequest<Agency>(`agencies/${publicId}`, { method: "GET", token });
}

export async function createAgency(
  token: string,
  payload: AgencyWritePayload,
): Promise<Agency> {
  return apiRequest<Agency>("agencies", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateAgency(
  token: string,
  publicId: string,
  payload: AgencyWritePayload,
): Promise<Agency> {
  return apiRequest<Agency>(`agencies/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateAgencyStatus(
  token: string,
  publicId: string,
  status: AgencyStatus,
): Promise<Agency> {
  return apiRequest<Agency>(`agencies/${publicId}/status`, {
    method: "PATCH",
    token,
    body: { status },
  });
}

export async function archiveAgency(
  token: string,
  publicId: string,
): Promise<Agency> {
  return apiRequest<Agency>(`agencies/${publicId}`, {
    method: "DELETE",
    token,
  });
}

export async function updateAgencyManager(
  token: string,
  publicId: string,
  payload: { manager_public_id: string | null; role_at_agency?: string | null },
): Promise<Agency> {
  return apiRequest<Agency>(`agencies/${publicId}/manager`, {
    method: "PUT",
    token,
    body: stripUndefined(payload),
  });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
