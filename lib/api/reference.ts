import { apiRequest } from "./client";

/**
 * Reference catalogs exposed by the API (back-issues #3/#20). These drive
 * data-validated selects on the frontend instead of hardcoded lists.
 */

/** One accepted identity-document type. `key` is the stored value. */
export type IdentityDocumentType = {
  key: string;
  label: string;
  /** 1 = front only; 2 = front + back (recto/verso) required for verification. */
  required_faces: number;
  /** When true, `expires_on` is required before the document can be verified. */
  requires_expiry: boolean;
};

/**
 * `GET /reference/identity-document-types`. The backend validates
 * `document_type` against these keys (`Rule::in`), so the create/edit form
 * MUST source its options here rather than from a local catalog.
 */
export async function fetchIdentityDocumentTypes(
  token: string,
): Promise<IdentityDocumentType[]> {
  const data = await apiRequest<{
    identity_document_types?: IdentityDocumentType[];
  }>(`reference/identity-document-types`, {
    method: "GET",
    token,
    query: { per_page: 100 },
  });
  return data.identity_document_types ?? [];
}
