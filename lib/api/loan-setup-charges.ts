import { apiRequest } from "./client";

/**
 * Frais de dossier / setup charges d'un prêt (préalable au déblocage).
 * Le décaissement (DisburseLoan) refuse tant que les **charges réelles** du
 * produit ne sont pas ASSESSÉES **et** COLLECTÉES : dossier_fee, dossier_fee_tax,
 * guarantee_deposit. L'assurance du prêt (`loan_assurance`) est une métadonnée
 * informative, NON collectable et NON bloquante — pas de prime bancassurance en
 * V1 (cf issues.md Issue 3).
 *
 * Lecture de l'état : `fetchSetupChargeState` (GET, sans effet de bord).
 * `assess` (POST) est une action explicite qui calcule les charges. La collecte
 * d'une charge nécessite les operation-account-mappings (P16b) côté API.
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
  paid_at?: string | null;
  journal_entry_public_id?: string | null;
  /** Backend-computed: true when status === 'assessed' && amount > 0. */
  collectable?: boolean;
  /** Backend-computed: true when amount > 0 && not yet collected/waived. */
  blocking_disbursement?: boolean;
  waiver_decision?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

/** Canonical readiness states from the setup-charge read model. */
export type SetupReadinessStatus =
  | "no_setup_required"
  | "not_assessed"
  | "collection_pending"
  | "ready"
  | string;

/** One backend-recommended next action. `action` drives FE branching. */
export type RequiredNextAction = {
  action: "assess_setup_charges" | "collect_setup_charge" | "disburse_loan" | string;
  description?: string;
  charge_public_id?: string;
  charge_type?: string;
};

/**
 * Loan-assurance metadata — informational only in V1 (NOT a collectible
 * bancassurance premium): `managed_as_premium` and `blocking_disbursement` are
 * both false. See issues.md (Issue 3).
 */
export type LoanAssurance = {
  amount_minor: number;
  rate: string | null;
  currency: string;
  blocking_disbursement: boolean;
  managed_as_premium: boolean;
};

/**
 * Canonical setup-charge readiness read model
 * (`GET /loans/{loan}/setup-charges`). This is the authoritative source for
 * disbursement readiness — prefer `ready_for_disbursement` over any locally
 * reconstructed rule.
 */
export type LoanSetupState = {
  loan_public_id: string;
  loan_status: string;
  currency: string;
  readiness_status: SetupReadinessStatus;
  ready_for_disbursement: boolean;
  setup_required: boolean;
  required_next_actions: RequiredNextAction[];
  setup_charges: SetupCharge[];
  loan_assurance: LoanAssurance | null;
};

export type AssessSetupChargesResult = {
  charges: SetupCharge[];
  loan_assurance: LoanAssurance | null;
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

export type SetupChargeDecision = "collect_as_assessed" | "waive";

/**
 * Canonical READ of the setup-charge readiness state
 * (`GET /loans/{loan}/setup-charges`). Use this to load/refresh the panel —
 * it is a pure read (no assessment side-effect). Drives disbursement
 * readiness via `ready_for_disbursement`.
 */
export async function fetchSetupChargeState(
  token: string,
  loanPublicId: string,
): Promise<LoanSetupState> {
  return apiRequest<LoanSetupState>(`loans/${loanPublicId}/setup-charges`, {
    method: "GET",
    token,
  });
}

/** Idempotent : crée les charges si absentes, sinon renvoie l'état courant. */
export async function assessSetupCharges(
  token: string,
  loanPublicId: string,
): Promise<AssessSetupChargesResult> {
  const data = await apiRequest<{
    charges?: SetupCharge[];
    loan_assurance?: LoanAssurance | null;
  }>(`loans/${loanPublicId}/setup-charges/assess`, { method: "POST", token });
  return {
    charges: data.charges ?? [],
    loan_assurance: data.loan_assurance ?? null,
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
