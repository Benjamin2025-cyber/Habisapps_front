import { apiRequest, notifyAuthExpired } from "./client";

export type StaffUserStatus =
  | "pending_verification"
  | "active"
  | "suspended"
  | "deactivated";

export type StaffUser = {
  public_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  status: StaffUserStatus;
  matricule: string | null;
  job_title: string | null;
  agency_public_id: string | null;
  agency_code: string | null;
  agency_name: string | null;
  phone_verified_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
  direct_permissions: string[];
  professional_profile?: {
    gender: string | null;
    birth_date: string | null;
    birth_place: string | null;
    job_title: string | null;
    service_name: string | null;
    supervisor_public_id: string | null;
    portfolio_code: string | null;
    source: string | null;
  } | null;
};

/** Full-scope status breakdown returned in `meta.status_counts`. */
export type StaffUserStatusCounts = {
  total: number;
  pending_verification: number;
  active: number;
  suspended: number;
  deactivated: number;
};

export type PaginatedStaffUsers = {
  data: StaffUser[];
  meta: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
    /** Counts across the whole visible scope (not just the page). */
    status_counts?: StaffUserStatusCounts;
  };
};

export type StaffUserWritePayload = {
  name?: string;
  phone_number?: string;
  email?: string | null;
  matricule?: string | null;
  job_title?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  service_name?: string | null;
  portfolio_code?: string | null;
  supervisor_public_id?: string | null;
  agency_code?: string | null;
  agency_name?: string | null;
};

/**
 * Paginated list. Reads the envelope directly so we get `meta.pagination` and
 * `meta.status_counts`. Server-side `search` covers
 * name/phone/email/matricule/job_title/agency; `status` is now a real server
 * filter (`filter[status]`). The response always carries `status_counts` over
 * the whole visible scope, so a `per_page=1` call is enough to read the splits.
 */
export async function fetchStaffUsers(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    search?: string;
    status?: StaffUserStatus;
  } = {},
): Promise<PaginatedStaffUsers> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) {
    query.set("page", String(options.page));
  }
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }
  if (options.status) {
    query.set("filter[status]", options.status);
  }

  const response = await fetch(`/api/v1/staff-users?${query.toString()}`, {
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
    throw new Error(`Failed to fetch staff users (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { users?: StaffUser[] } | StaffUser[];
    meta?: PaginatedStaffUsers["meta"];
  };

  const rows: StaffUser[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.users)
      ? envelope.data!.users!
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

/** Status breakdown across the visible scope (one cheap `per_page=1` call). */
export async function fetchStaffUserStatusCounts(
  token: string,
): Promise<StaffUserStatusCounts | null> {
  const res = await fetchStaffUsers(token, { perPage: 1 });
  return res.meta.status_counts ?? null;
}

export async function getStaffUser(
  token: string,
  publicId: string,
): Promise<StaffUser> {
  return apiRequest<StaffUser>(`staff-users/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function createStaffUser(
  token: string,
  payload: StaffUserWritePayload,
): Promise<StaffUser> {
  return apiRequest<StaffUser>("staff-users", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateStaffUser(
  token: string,
  publicId: string,
  payload: StaffUserWritePayload,
): Promise<StaffUser> {
  return apiRequest<StaffUser>(`staff-users/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateStaffUserStatus(
  token: string,
  publicId: string,
  status: Exclude<StaffUserStatus, "pending_verification">,
): Promise<StaffUser> {
  return apiRequest<StaffUser>(`staff-users/${publicId}/status`, {
    method: "PATCH",
    token,
    body: { status },
  });
}

export async function updateStaffUserRoles(
  token: string,
  publicId: string,
  roles: string[],
): Promise<StaffUser> {
  return apiRequest<StaffUser>(`staff-users/${publicId}/roles`, {
    method: "PUT",
    token,
    body: { roles },
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
