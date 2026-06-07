import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * Audit event (Spatie activity log).
 *
 * NOTE: `AuditEventResource` only returns `log_name`, `event`, `description`,
 * `subject_type`, `causer_type`, `properties`, `created_at`. The extra fields
 * below (`id`, `causer`, `causer_id`, `subject_id`) are NOT emitted by the API
 * today — they are absent at runtime. They are kept optional for the legacy
 * dashboard feed; the audit page binds only to the fields the API actually
 * returns. (Causer identity / a stable id are requested from the backend —
 * back-issues-round3.md §H.)
 */
export type AuditEvent = {
  id?: number;
  log_name: string | null;
  event: string | null;
  description: string;
  causer_type: string | null;
  causer_id?: number | null;
  causer?: {
    public_id?: string | null;
    name?: string | null;
  } | null;
  subject_type: string | null;
  subject_id?: number | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

export type AuditPagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedAuditEvents = {
  data: AuditEvent[];
  meta: { pagination: AuditPagination };
};

export type AuditEventFilters = {
  page?: number;
  perPage?: number;
  event?: string;
  logName?: string;
  search?: string;
};

/**
 * Paginated audit feed for the audit journal page. Unlike `listAuditEvents`
 * (which drops `meta`), this reads the `meta.pagination` block. The collection
 * wraps rows under `data.events` (AuditEventCollection). Server filters:
 * `event`, `log_name`, `search` (the index exposes no date-range filter).
 */
export async function fetchAuditEvents(
  token: string,
  filters: AuditEventFilters = {},
): Promise<PaginatedAuditEvents> {
  const query = new URLSearchParams();
  query.set("per_page", String(filters.perPage ?? 25));
  if (filters.page && filters.page > 0) query.set("page", String(filters.page));
  if (filters.event) query.set("event", filters.event);
  if (filters.logName) query.set("log_name", filters.logName);
  if (filters.search && filters.search.trim().length > 0) {
    query.set("search", filters.search.trim());
  }

  const response = await fetch(`/api/v1/audit-events?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      "X-Locale": getRequestLocale(),
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch audit events (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { events?: AuditEvent[] } | AuditEvent[];
    meta?: { pagination?: Partial<AuditPagination> } & Partial<AuditPagination>;
  };
  const rows: AuditEvent[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.events)
      ? envelope.data!.events!
      : [];
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};
  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? filters.perPage ?? 25,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

export type AuditEventsResponse = {
  data: AuditEvent[];
  meta: {
    pagination?: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
};

export async function listAuditEvents(
  token: string,
  params: { perPage?: number; event?: string; logName?: string } = {},
): Promise<AuditEventsResponse> {
  const raw = await apiRequest<unknown>("audit-events", {
    method: "GET",
    token,
    query: {
      per_page: params.perPage ?? 10,
      event: params.event,
      log_name: params.logName,
    },
  });

  // The endpoint may return either { data: [...] } or a bare array depending on
  // how the resource collection is registered. Normalize.
  if (Array.isArray(raw)) {
    return { data: raw as AuditEvent[], meta: {} };
  }
  if (raw && typeof raw === "object") {
    const cast = raw as { data?: unknown; meta?: AuditEventsResponse["meta"] };
    const data = Array.isArray(cast.data) ? (cast.data as AuditEvent[]) : [];
    return { data, meta: cast.meta ?? {} };
  }
  return { data: [], meta: {} };
}
