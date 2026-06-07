import { ApiError, apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * Journée comptable (accounting day) — the EMF "business day" that dates
 * operations independently of the calendar. While a day is **open** (or
 * **reopened**) the institution can register operations; once **closed** the
 * system drops to consultation-only mode and all financial registration is
 * blocked until the next day is opened (see HabisApi
 * `stakeholderResources/journee-comptable.md`).
 *
 * Lifecycle: planned → open → closing → closed → (reopened). The close runs
 * batch controls; if they fail the day stays `closing` with a
 * `close_failure_reason` and a `close_summary` of blockers.
 *
 * Permissions: `accounting.days.view` / `.open` / `.close` / `.reopen`. Scope is
 * agency by default; institution-wide days are platform-admin only.
 */
export type AccountingDayStatus =
  | "planned"
  | "open"
  | "closing"
  | "closed"
  | "reopened"
  | "cancelled";

export type AccountingDayScope = "agency" | "institution";

export type AccountingDay = {
  public_id: string;
  scope: AccountingDayScope;
  agency_public_id: string | null;
  business_date: string | null;
  status: AccountingDayStatus;
  /** True while ordinary registration writes are accepted (open | reopened). */
  can_register: boolean;
  is_holiday: boolean;
  holiday_name: string | null;
  origin: string;
  calendar_opened_at: string | null;
  calendar_closed_at: string | null;
  opened_by_public_id: string | null;
  closed_by_public_id: string | null;
  reopened_by_public_id: string | null;
  /** Readiness/blocker payload populated during start-close / close. */
  close_summary: Record<string, unknown> | null;
  close_failure_reason: string | null;
  /** Only returned to users who can reopen the day. */
  reopen_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedAccountingDays = {
  data: AccountingDay[];
  meta: { pagination: Pagination };
};

export type OpenAccountingDayPayload = {
  scope?: AccountingDayScope;
  agency_public_id?: string | null;
  /** `Y-m-d`. Omit to let the backend derive the next business date. */
  business_date?: string | null;
};

export type CloseAccountingDayPayload = {
  comment?: string | null;
};

export type ReopenAccountingDayPayload = {
  /** Justification, required by the backend (min 10 chars). */
  reason: string;
};

/**
 * Paginated history of accounting days for the caller's scope (platform-admin
 * sees every scope; agency staff see their agency only). Raw fetch because we
 * need `meta.pagination`, which `apiRequest` discards.
 */
export async function fetchAccountingDays(
  token: string,
  options: { status?: string; page?: number; perPage?: number } = {},
): Promise<PaginatedAccountingDays> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);

  const response = await fetch(`/api/v1/accounting-days?${query.toString()}`, {
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
    throw new Error(`Failed to fetch accounting days (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { accounting_days?: AccountingDay[] } | AccountingDay[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: AccountingDay[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.accounting_days)
      ? envelope.data!.accounting_days!
      : [];
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};
  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? options.perPage ?? 25,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

/**
 * The active (or latest) accounting day for the caller's scope. Returns `null`
 * when none is configured (the backend answers 404 "consultation-only mode"),
 * so callers can render the "no open day" state instead of treating it as an
 * error.
 */
export async function fetchCurrentAccountingDay(
  token: string,
  options: { scope?: AccountingDayScope; agencyPublicId?: string } = {},
): Promise<AccountingDay | null> {
  const query: Record<string, string> = {};
  if (options.scope) query.scope = options.scope;
  if (options.agencyPublicId) query.agency_public_id = options.agencyPublicId;
  try {
    return await apiRequest<AccountingDay>("accounting-days/current", {
      method: "GET",
      token,
      query,
    });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

export async function fetchAccountingDay(
  token: string,
  publicId: string,
): Promise<AccountingDay> {
  return apiRequest<AccountingDay>(`accounting-days/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function openAccountingDay(
  token: string,
  payload: OpenAccountingDayPayload = {},
): Promise<AccountingDay> {
  return apiRequest<AccountingDay>("accounting-days/open", {
    method: "POST",
    token,
    body: payload,
  });
}

/**
 * Begin closing the day: transitions open → closing and runs the close-control
 * batches. The returned day carries `close_summary`; registrations are blocked
 * from this point on.
 */
export async function startCloseAccountingDay(
  token: string,
  publicId: string,
): Promise<AccountingDay> {
  return apiRequest<AccountingDay>(`accounting-days/${publicId}/start-close`, {
    method: "POST",
    token,
  });
}

/**
 * Finalize the close (closing → closed). Throws `ApiError` 422 with
 * `code: accounting_day_close_blocked` (and a `close_summary` in `errors`) when
 * controls are still failing.
 */
export async function closeAccountingDay(
  token: string,
  publicId: string,
  payload: CloseAccountingDayPayload = {},
): Promise<AccountingDay> {
  return apiRequest<AccountingDay>(`accounting-days/${publicId}/close`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function reopenAccountingDay(
  token: string,
  publicId: string,
  payload: ReopenAccountingDayPayload,
): Promise<AccountingDay> {
  return apiRequest<AccountingDay>(`accounting-days/${publicId}/reopen`, {
    method: "POST",
    token,
    body: payload,
  });
}
