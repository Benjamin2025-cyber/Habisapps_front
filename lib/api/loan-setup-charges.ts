import { apiRequest } from "./client";

/**
 * Frais de dossier / setup charges d'un prêt (préalable au déblocage).
 * Le décaissement (DisburseLoan) refuse tant que les charges du produit ne sont
 * pas ASSESSÉES **et** COLLECTÉES : dossier_fee, dossier_fee_tax,
 * guarantee_deposit + prime d'assurance.
 *
 * `assess` est IDEMPOTENT : il crée les charges si absentes, sinon renvoie les
 * existantes — il sert donc aussi à LISTER l'état des charges (le LoanResource
 * n'expose pas ces champs). La collecte d'une charge nécessite les
 * operation-account-mappings (P16b) côté API.
 */
export type SetupChargeType =
  | "dossier_fee"
  | "dossier_fee_tax"
  | "guarantee_deposit"
  | string;

/** assessed → à collecter ; paid/waived_by_direction → réglé. */
export type SetupChargeStatus =
  | "assessed"
  | "paid"
  | "waived_by_direction"
  | string;

export type SetupCharge = {
  public_id: string;
  charge_type: SetupChargeType;
  base_amount_minor: number | null;
  rate: string | null;
  assessed_amount_minor: number;
  currency: string;
  status: SetupChargeStatus;
  metadata?: Record<string, unknown>;
};

export type InsurancePremiumAssessment = {
  public_id: string;
  base_amount_minor: number | null;
  rate: string | null;
  premium_amount_minor: number;
  currency: string;
  status: SetupChargeStatus;
  metadata?: Record<string, unknown>;
};

export type AssessSetupChargesResult = {
  charges: SetupCharge[];
  insurance_premium_assessment: InsurancePremiumAssessment | null;
};

/** Source de paiement d'une charge : compte client ou caisse (session ouverte). */
export type SetupChargePaymentSource = "customer_account" | "teller_cash";

export type CollectSetupChargePayload = {
  payment_source: SetupChargePaymentSource;
  customer_account_public_id?: string | null;
  teller_session_public_id?: string | null;
  paid_on?: string | null;
  notes?: string | null;
};

export type CollectInsurancePremiumPayload = {
  customer_account_public_id: string;
  paid_on?: string | null;
  notes?: string | null;
};

export type SetupChargeDecision = "collect_as_assessed" | "waive";

/** Idempotent : crée les charges si absentes, sinon renvoie l'état courant. */
export async function assessSetupCharges(
  token: string,
  loanPublicId: string,
): Promise<AssessSetupChargesResult> {
  const data = await apiRequest<{
    charges?: SetupCharge[];
    insurance_premium_assessment?: InsurancePremiumAssessment | null;
  }>(`loans/${loanPublicId}/setup-charges/assess`, { method: "POST", token });
  return {
    charges: data.charges ?? [],
    insurance_premium_assessment: data.insurance_premium_assessment ?? null,
  };
}

export async function collectSetupCharge(
  token: string,
  loanPublicId: string,
  chargePublicId: string,
  payload: CollectSetupChargePayload,
): Promise<{ charge: SetupCharge }> {
  return apiRequest<{ charge: SetupCharge }>(
    `loans/${loanPublicId}/setup-charges/${chargePublicId}/collect`,
    { method: "POST", token, body: stripNullish(payload) },
  );
}

export async function collectInsurancePremium(
  token: string,
  loanPublicId: string,
  premiumPublicId: string,
  payload: CollectInsurancePremiumPayload,
): Promise<{ assessment: InsurancePremiumAssessment }> {
  return apiRequest<{ assessment: InsurancePremiumAssessment }>(
    `loans/${loanPublicId}/insurance-premiums/${premiumPublicId}/collect`,
    { method: "POST", token, body: stripNullish(payload) },
  );
}

/** Décision direction (waiver) pour dossier_fee / dossier_fee_tax uniquement. */
export async function decideSetupChargeException(
  token: string,
  loanPublicId: string,
  chargePublicId: string,
  payload: { decision: SetupChargeDecision; comments: string },
): Promise<{ charge: SetupCharge }> {
  return apiRequest<{ charge: SetupCharge }>(
    `loans/${loanPublicId}/setup-charges/${chargePublicId}/direction-decision`,
    { method: "POST", token, body: payload },
  );
}

/** A charge/premium is settled when it no longer needs collection. */
export function isSetupChargeSettled(status: SetupChargeStatus): boolean {
  return status === "paid" || status === "waived_by_direction";
}

function stripNullish<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as Partial<T>;
}
