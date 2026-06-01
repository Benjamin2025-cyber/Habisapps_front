import { ApiError, notifyAuthExpired } from "./client";

/**
 * Documents (Spatie media). Upload via multipart `POST /documents`; file
 * content is served back (inline bytes) by `GET /documents/{id}/file`
 * (back-issues #10/#11). The file endpoint is Bearer-authenticated, so it
 * can't be used directly as an `<img src>` — fetch it as a blob and wrap it in
 * an object URL (see `fetchDocumentObjectUrl` / the `AuthenticatedImage`
 * component).
 */
export type DocumentRecord = {
  public_id: string;
  category: string;
  title: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  verified_at: string | null;
  archived_at: string | null;
  created_at: string;
};

/**
 * Upload a file (pdf/jpg/jpeg/png, ≤10 MB). Multipart — we must NOT set the
 * Content-Type header so the browser adds the multipart boundary itself.
 *
 * `agencyPublicId` targets a specific agency: required for platform/institution
 * actors without a current agency (back-issue #11), and the linked record's
 * agency must match the client's agency.
 */
export async function uploadDocument(
  token: string,
  file: File,
  options: { category: string; title: string; agencyPublicId?: string | null },
): Promise<DocumentRecord> {
  const body = new FormData();
  body.append("file", file);
  body.append("category", options.category.slice(0, 64));
  body.append("title", options.title.slice(0, 255));
  if (options.agencyPublicId) {
    body.append("agency_public_id", options.agencyPublicId);
  }

  let response: Response;
  try {
    response = await fetch("/api/v1/documents", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
        Authorization: `Bearer ${token}`,
      },
      body,
      credentials: "omit",
    });
  } catch (cause) {
    throw new Error(
      cause instanceof Error ? `Network error: ${cause.message}` : "Network error",
    );
  }

  const text = await response.text();
  const envelope =
    text.length > 0
      ? (JSON.parse(text) as {
          success?: boolean;
          message?: string;
          data?: DocumentRecord;
          errors?: Record<string, string[]> | null;
        })
      : null;

  if (!response.ok || envelope?.success === false) {
    if (response.status === 401) notifyAuthExpired();
    throw new ApiError(
      envelope?.message ?? `Upload failed (HTTP ${response.status})`,
      response.status,
      envelope?.errors ?? null,
    );
  }

  return envelope?.data as DocumentRecord;
}

/**
 * Fetch a document's bytes (`GET /documents/{id}/file`) and wrap them in an
 * object URL usable as an `<img src>`. The caller MUST `URL.revokeObjectURL`
 * the result when it's no longer displayed to avoid leaking blob memory.
 * Throws `ApiError` (404 when the file is absent, 403 cross-agency).
 */
export async function fetchDocumentObjectUrl(
  token: string,
  publicId: string,
): Promise<string> {
  const response = await fetch(`/api/v1/documents/${publicId}/file`, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });

  if (!response.ok) {
    if (response.status === 401) notifyAuthExpired();
    throw new ApiError(
      `Failed to load document file (HTTP ${response.status})`,
      response.status,
      null,
    );
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
