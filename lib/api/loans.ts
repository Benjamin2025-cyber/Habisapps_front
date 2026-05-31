import { apiRequest, notifyAuthExpired } from "./client";

/**
 * Lightweight count helper. Calls `GET /loans` with `per_page=1` and reads
 * `meta.pagination.total` from the envelope. We never need the rows.
 */
export async function countLoans(
  token: string,
  filters: { status?: string } = {},
): Promise<number> {
  return countResource(token, "loans", filters);
}

export async function countClients(
  token: string,
  filters: { status?: string; kyc_status?: string; scope?: "all" } = {},
): Promise<number> {
  // The CRM index defaults to agency-scoped. Users with institution scope
  // (platform-admin, regional-manager…) must explicitly pass `scope=all` to
  // get a cross-agency count.
  return countResource(token, "clients", filters);
}

export async function countStaffUsers(token: string): Promise<number> {
  return countResource(token, "staff-users", {});
}

async function countResource(
  token: string,
  path: string,
  filters: Record<string, string | undefined>,
): Promise<number> {
  // Pull the raw envelope so we can read `meta.pagination.total`.
  const url = `/api/v1/${path}`;
  const query = new URLSearchParams();
  query.set("per_page", "1");
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${url}?${query.toString()}`, {
    method: "GET",
    headers,
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    throw new Error(`Failed to count ${path} (HTTP ${response.status})`);
  }

  try {
    const envelope = JSON.parse(text) as {
      meta?: { pagination?: { total?: number } };
    };
    const total = envelope.meta?.pagination?.total;
    return typeof total === "number" ? total : 0;
  } catch {
    return 0;
  }
}

// Re-export apiRequest for callers that want full payloads.
export { apiRequest };

/* ------------------------------------------------------------------ *
 * P11 — Prêts (mise en place / origination)
 *
 * Cycle de vie (machine à états côté API) :
 *   application → in_review → approved/rejected
 *   approved → disbursed → active → rescheduled/closed/written_off
 *
 * Le passage application → approved se fait par le **circuit de visa**
 * (`decideLoanApproval` sur les 4 étapes), pas par `transitionLoanStatus`.
 *
 * Envelopes :
 *   - LIST  → `data.loans` + `meta.pagination`
 *   - SHOW/CREATE/UPDATE → le prêt directement sous `data`
 *   - actions → objets nommés sous `data` (`data.loan` + `data.approval` /
 *     `data.transition` / `data.snapshot`).
 *
 * ⚠️ L'API n'expose AUCUN GET pour les visas ni pour le tableau d'amortissement
 * (voir back-issues.md #15) — disponibles seulement dans la réponse de l'action.
 * ------------------------------------------------------------------ */

export type LoanStatus =
  | "application"
  | "in_review"
  | "approved"
  | "rejected"
  | "disbursed"
  | "active"
  | "rescheduled"
  | "closed"
  | "written_off";

export type ApprovalStep =
  | "montage"
  | "comptabilite"
  | "controle"
  | "direction";

export const APPROVAL_STEPS: ApprovalStep[] = [
  "montage",
  "comptabilite",
  "controle",
  "direction",
];

export type ApprovalDecision = "approved" | "rejected" | "returned";

/** Transitions autorisées par statut (miroir de la machine à états API). */
export const ALLOWED_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  application: ["in_review", "rejected"],
  in_review: ["application", "rejected"],
  approved: ["disbursed", "rejected"],
  disbursed: ["active"],
  active: ["rescheduled", "closed", "written_off"],
  rescheduled: ["active", "closed", "written_off"],
  closed: [],
  written_off: [],
  rejected: [],
};

export type Loan = {
  public_id: string;
  loan_number: string | null;
  status: LoanStatus;
  processing_level: string | null;
  client_public_id: string | null;
  agency_public_id: string | null;
  loan_product_public_id: string | null;
  credit_agent_public_id: string | null;
  amortization_account_public_id: string | null;
  unpaid_account_public_id: string | null;
  recovery_account_public_id: string | null;
  transfer_account_public_id: string | null;
  requested_amount_minor: number | null;
  approved_principal_minor: number | null;
  currency: string | null;
  applied_on: string | null;
  approved_on: string | null;
  disbursed_on: string | null;
  closed_on: string | null;
  purpose: string | null;
  sector_public_id: string | null;
  sub_sector_public_id: string | null;
  financed_activity_code: string | null;
  activity_address: string | null;
  entrepreneur_address: string | null;
  first_installment_date: string | null;
  number_of_installments: number | null;
  grace_period_duration: number | null;
  tranche_duration: number | null;
  total_loan_duration: number | null;
  dossier_fees_minor: number | null;
  dossier_fees_tax_minor: number | null;
  guarantee_deposit_amount_minor: number | null;
  insurance_amount_minor: number | null;
  formula_policy_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type LoanPagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedLoans = {
  data: Loan[];
  meta: { pagination: LoanPagination };
};

/**
 * Champs acceptés à la création. `client_public_id` et `loan_product_public_id`
 * sont requis et immuables après création (l'update les ignore). L'update n'est
 * possible que tant que le prêt est en statut `application`.
 */
export type LoanWritePayload = {
  client_public_id?: string;
  loan_product_public_id?: string;
  requested_amount_minor?: number;
  currency?: string;
  applied_on?: string | null;
  credit_agent_public_id?: string | null;
  amortization_account_public_id?: string | null;
  unpaid_account_public_id?: string | null;
  recovery_account_public_id?: string | null;
  transfer_account_public_id?: string | null;
  purpose?: string | null;
  sector_public_id?: string | null;
  sub_sector_public_id?: string | null;
  financed_activity_code?: string | null;
  activity_address?: string | null;
  entrepreneur_address?: string | null;
  first_installment_date?: string | null;
  number_of_installments?: number | null;
  grace_period_duration?: number | null;
  tranche_duration?: number | null;
  total_loan_duration?: number | null;
};

export type LoanScheduleLine = {
  installment_number: number;
  due_date: string;
  principal_minor: number;
  interest_minor: number;
  fees_minor: number;
  insurance_minor: number;
  tax_minor: number;
  penalty_minor: number;
  capitalized_interest_minor: number;
  remaining_principal_minor: number;
  total_installment_minor: number;
  currency: string;
  status: string;
};

export type LoanScheduleSnapshot = {
  public_id: string;
  loan_public_id: string;
  formula_engine_key: string;
  formula_engine_version: string;
  policy_snapshot_hash: string;
  generated_at: string;
  status: string;
  lines: LoanScheduleLine[];
};

export type LoanApprovalResult = {
  public_id: string;
  step: ApprovalStep;
  decision: ApprovalDecision;
  acted_by_user_public_id: string | null;
  acted_at: string | null;
  comments: string | null;
};

export type LoanTransitionResult = {
  public_id: string;
  from_status: LoanStatus;
  to_status: LoanStatus;
  decision: string;
  reason: string | null;
  notes: string | null;
  transitioned_at: string | null;
};

/** Paginated list. Server filter is `status`; search is client-side. */
export async function fetchLoans(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    status?: LoanStatus;
  } = {},
): Promise<PaginatedLoans> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);

  const response = await fetch(`/api/v1/loans?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch loans (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { loans?: Loan[] } | Loan[];
    meta?: PaginatedLoans["meta"];
  };

  const rows: Loan[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.loans)
      ? envelope.data!.loans!
      : [];

  return {
    data: rows,
    meta: envelope.meta ?? {
      pagination: {
        current_page: 1,
        per_page: rows.length || 25,
        total: rows.length,
        last_page: 1,
      },
    },
  };
}

export async function getLoan(token: string, publicId: string): Promise<Loan> {
  return apiRequest<Loan>(`loans/${publicId}`, { method: "GET", token });
}

/* ---- P15 — Déblocage (disbursement) ---- */

export type DisbursementChannel = "transfer_account" | "cash";

export type LoanDisbursement = {
  public_id: string;
  principal_amount_minor: number | null;
  currency: string | null;
  disbursement_channel: DisbursementChannel | string;
  status: string;
  transfer_account_public_id?: string | null;
  posted_by_user_public_id?: string | null;
  posted_at?: string | null;
};

export type LoanDisbursePayload = {
  disbursement_channel?: DisbursementChannel;
  transfer_account_public_id?: string | null;
  teller_session_public_id?: string | null;
  business_date?: string | null;
  notes?: string | null;
};

/**
 * Disburse an approved loan. Requires the loan to be `approved`, and the loan
 * product + (for transfer channel) the transfer account to have active ledger
 * mappings — otherwise the API returns a clear "ledger mapping required" error
 * (the chart of accounts is P16). Returns the loan + the disbursement record.
 */
export async function disburseLoan(
  token: string,
  publicId: string,
  payload: LoanDisbursePayload,
): Promise<{ loan: Loan; disbursement: LoanDisbursement }> {
  return apiRequest<{ loan: Loan; disbursement: LoanDisbursement }>(
    `loans/${publicId}/disburse`,
    { method: "POST", token, body: stripUndefinedLoan(payload) },
  );
}

export async function createLoan(
  token: string,
  payload: LoanWritePayload,
): Promise<Loan> {
  return apiRequest<Loan>("loans", {
    method: "POST",
    token,
    body: stripUndefinedLoan(payload),
  });
}

export async function updateLoan(
  token: string,
  publicId: string,
  payload: LoanWritePayload,
): Promise<Loan> {
  return apiRequest<Loan>(`loans/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefinedLoan(payload),
  });
}

/** Generate (or regenerate) the amortization schedule. Loan must be approved/rescheduled. */
export async function generateLoanSchedule(
  token: string,
  publicId: string,
): Promise<LoanScheduleSnapshot> {
  const data = await apiRequest<{ snapshot: LoanScheduleSnapshot }>(
    `loans/${publicId}/schedule/generate`,
    { method: "POST", token, body: {} },
  );
  return data.snapshot;
}

/** Decide one visa step (montage/comptabilite/controle/direction). */
export async function decideLoanApproval(
  token: string,
  publicId: string,
  step: ApprovalStep,
  payload: { decision: ApprovalDecision; comments?: string | null },
): Promise<{ loan: Loan; approval: LoanApprovalResult }> {
  return apiRequest<{ loan: Loan; approval: LoanApprovalResult }>(
    `loans/${publicId}/approvals/${step}`,
    { method: "POST", token, body: stripUndefinedLoan(payload) },
  );
}

/** Transition the loan to an allowed target status. */
export async function transitionLoanStatus(
  token: string,
  publicId: string,
  payload: { to_status: LoanStatus; reason?: string | null; notes?: string | null },
): Promise<{ loan: Loan; transition: LoanTransitionResult }> {
  return apiRequest<{ loan: Loan; transition: LoanTransitionResult }>(
    `loans/${publicId}/status-transitions`,
    { method: "POST", token, body: stripUndefinedLoan(payload) },
  );
}

function stripUndefinedLoan<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
