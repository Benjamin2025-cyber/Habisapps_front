import { apiRequest } from "./client";

export type AuditEvent = {
  id: number;
  log_name: string | null;
  event: string | null;
  description: string;
  causer_type: string | null;
  causer_id: number | null;
  causer?: {
    public_id?: string | null;
    name?: string | null;
  } | null;
  subject_type: string | null;
  subject_id: number | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

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
