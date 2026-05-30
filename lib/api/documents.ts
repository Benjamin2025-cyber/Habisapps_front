import { ApiError, notifyAuthExpired } from "./client";

/**
 * Documents (Spatie media). Upload is supported via multipart `POST /documents`;
 * the API returns metadata only — file content / a download URL is NOT exposed
 * yet, so uploaded files can be linked but not displayed back.
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
 */
export async function uploadDocument(
  token: string,
  file: File,
  options: { category: string; title: string },
): Promise<DocumentRecord> {
  const body = new FormData();
  body.append("file", file);
  body.append("category", options.category.slice(0, 64));
  body.append("title", options.title.slice(0, 255));

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
