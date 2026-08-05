import { apiRequest } from "./client";

/**
 * Institution identity — the EMF's own legal identity (raison sociale, agrément,
 * RCCM, NIU, siège social).
 *
 * A **singleton**: an EMF is one legal entity, so the resource carries no
 * identifier in the path (`/institution`, not `/institution/{id}`) and nothing
 * references it by id.
 *
 * These fields are what supervisory filings and issued attestations are stamped
 * with, so an unset field is rendered as empty rather than guessed — never
 * substitute the application name for the legal name.
 *
 * Two behaviours worth knowing:
 *  - `GET` never 404s. On a fresh install it returns 200 with every field null,
 *    so "is it configured?" is `legal_name != null`, not the status code.
 *  - `declared_reporting_currency` and `fiscal_year_start_month` are
 *    **declarative**: the accounting configuration remains authoritative for the
 *    actual currency and calendar. They record what the institution declares.
 */
export type InstitutionProfile = {
  public_id: string;
  legal_name: string | null;
  trade_name: string | null;
  legal_form: string | null;
  emf_category: string | null;
  supervisory_authority: string | null;
  approval_number: string | null;
  /** ISO date (YYYY-MM-DD). */
  approval_date: string | null;
  registration_number: string | null;
  tax_identification_number: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  po_box: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  phone_number: string | null;
  fax_number: string | null;
  email: string | null;
  website: string | null;
  /** ISO 4217, uppercased API-side. */
  declared_reporting_currency: string | null;
  /** 1–12. */
  fiscal_year_start_month: number | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Every field is optional: the endpoint accepts a partial patch. */
export type InstitutionProfileUpdatePayload = Partial<
  Omit<InstitutionProfile, "public_id" | "created_at" | "updated_at">
>;

/** Requires `institution.profile.view`. */
export async function getInstitutionProfile(
  token: string,
): Promise<InstitutionProfile> {
  return apiRequest<InstitutionProfile>("institution", {
    method: "GET",
    token,
  });
}

/** Requires `institution.profile.manage`. */
export async function updateInstitutionProfile(
  token: string,
  payload: InstitutionProfileUpdatePayload,
): Promise<InstitutionProfile> {
  return apiRequest<InstitutionProfile>("institution", {
    method: "PATCH",
    token,
    body: payload,
  });
}

/**
 * Whether the institution has been identified at all. The row exists from the
 * first read, so its presence proves nothing — the legal name is what a filing
 * cannot go out without.
 */
export function isInstitutionConfigured(
  profile: InstitutionProfile | null,
): boolean {
  return profile?.legal_name != null && profile.legal_name.trim() !== "";
}
