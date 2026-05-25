import type { ApiEnvelope, ApiErrorBag } from "./types";

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION ?? "1";

/**
 * Domain error raised when the API returned an envelope with `success: false`,
 * or when the HTTP status was non-2xx. Carries the validation `errors` bag so
 * forms can map field-level messages back to inputs, plus `retryAfter` seconds
 * when the server rate-limited the request.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly errors: ApiErrorBag | null;
  public readonly retryAfter: number | null;

  constructor(
    message: string,
    status: number,
    errors: ApiErrorBag | null,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.retryAfter = retryAfter;
  }

  /** Pull the first message for a given field, if any. */
  fieldError(field: string): string | null {
    if (!this.errors) return null;
    const bag = this.errors as Record<string, string[] | undefined>;
    const list = bag[field];
    return list && list.length > 0 ? list[0] : null;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Bearer token. When omitted, no Authorization header is sent. */
  token?: string | null;
  /** Idempotency-Key value for safe retries on POST/PATCH. */
  idempotencyKey?: string;
  /** Query string params, serialized as `?key=value`. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = path.startsWith("/") ? path : `/${path}`;
  if (!query) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Parse a `Retry-After` header value. Returns seconds when the value is a
 * delta-seconds number or an HTTP-date in the future, otherwise null.
 */
function parseRetryAfterHeader(raw: string | null): number | null {
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    const delta = Math.ceil((asDate - Date.now()) / 1000);
    return delta > 0 ? delta : 0;
  }
  return null;
}

/**
 * Fallback: extract "X seconds" / "X secondes" / "Xs" from a server message.
 * Used when the API response body carries the wait time but no header.
 */
function extractRetryAfterFromMessage(message: string | undefined): number | null {
  if (!message) return null;
  const match = message.match(/(\d+)\s*(?:s|seconds?|secondes?)/i);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Single entry point for every HabisApi call. Returns the unwrapped `data` on
 * success, throws `ApiError` on validation/auth/server failures, throws a
 * plain `Error` on network failure.
 *
 * Path is relative to `/api/v1/` — pass e.g. `"login"` or `"clients"`.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(`/api/v1/${path.replace(/^\/+/, "")}`, options.query);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Version": API_VERSION,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "omit",
    });
  } catch (cause) {
    throw new Error(
      cause instanceof Error ? `Network error: ${cause.message}` : "Network error",
    );
  }

  let envelope: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      envelope = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(
        `Unexpected response (HTTP ${response.status})`,
        response.status,
        null,
      );
    }
  }

  if (!response.ok || (envelope && envelope.success === false)) {
    const retryAfter =
      parseRetryAfterHeader(response.headers.get("Retry-After")) ??
      extractRetryAfterFromMessage(envelope?.message);

    throw new ApiError(
      envelope?.message ?? `Request failed (HTTP ${response.status})`,
      response.status,
      envelope?.errors ?? null,
      retryAfter,
    );
  }

  return (envelope?.data ?? null) as T;
}
