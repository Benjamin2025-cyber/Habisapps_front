/**
 * Canonical identity-document catalog for a Cameroon microfinance.
 *
 * Stored value is the slug (machine-friendly, locale-stable); the FR label
 * comes from i18n under `clientDetail.identityDocs.types.<slug>`. Adding a new
 * type = one entry here + one i18n key.
 *
 * Split into the documents a natural person carries (CNI, passport, …) and the
 * documents that identify a business (RCCM, NIU, …). The full identity-document
 * tab offers both; flows that only concern a natural person (e.g. a proxy's ID
 * piece) offer the personal subset.
 */
export const PERSONAL_IDENTITY_DOCUMENT_SLUGS = [
  "national_id_card",
  "national_id_receipt",
  "passport",
  "residence_permit",
  "driver_license",
  "voter_card",
  "consular_card",
  "professional_card",
  "civil_servant_card",
  "military_id",
  "student_card",
  "pension_card",
  "birth_certificate",
  "marriage_certificate",
] as const;

export const BUSINESS_IDENTITY_DOCUMENT_SLUGS = [
  "business_registry",
  "taxpayer_id",
  "business_license",
  "company_bylaws",
  "tax_clearance",
] as const;

export const IDENTITY_DOCUMENT_TYPE_SLUGS = [
  ...PERSONAL_IDENTITY_DOCUMENT_SLUGS,
  ...BUSINESS_IDENTITY_DOCUMENT_SLUGS,
] as const;

export type IdentityDocumentTypeSlug =
  (typeof IDENTITY_DOCUMENT_TYPE_SLUGS)[number];

export function isKnownIdentityDocumentType(
  value: string,
): value is IdentityDocumentTypeSlug {
  return (IDENTITY_DOCUMENT_TYPE_SLUGS as readonly string[]).includes(value);
}
