import { apiRequest } from "./client";

/**
 * Lightweight count helper. Calls `GET /loans` with `per_page=1` and reads
 * `meta.pagination.total` from the envelope. We never need the rows.
 */
export async function countLoans(
  token: string,
  filters: { status?: string } = {},
): Promise<number> {
  return countResource(token, "loans", filters);
}

export async function countClients(
  token: string,
  filters: { status?: string; kyc_status?: string; scope?: "all" } = {},
): Promise<number> {
  // The CRM index defaults to agency-scoped. Users with institution scope
  // (platform-admin, regional-manager…) must explicitly pass `scope=all` to
  // get a cross-agency count.
  return countResource(token, "clients", filters);
}

export async function countStaffUsers(token: string): Promise<number> {
  return countResource(token, "staff-users", {});
}

async function countResource(
  token: string,
  path: string,
  filters: Record<string, string | undefined>,
): Promise<number> {
  // Pull the raw envelope so we can read `meta.pagination.total`.
  const url = `/api/v1/${path}`;
  const query = new URLSearchParams();
  query.set("per_page", "1");
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${url}?${query.toString()}`, {
    method: "GET",
    headers,
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    throw new Error(`Failed to count ${path} (HTTP ${response.status})`);
  }

  try {
    const envelope = JSON.parse(text) as {
      meta?: { pagination?: { total?: number } };
    };
    const total = envelope.meta?.pagination?.total;
    return typeof total === "number" ? total : 0;
  } catch {
    return 0;
  }
}

// Re-export apiRequest for callers that want full payloads.
export { apiRequest };
