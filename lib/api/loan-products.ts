import { apiRequest, notifyAuthExpired } from "./client";

/**
 * P10 — Produits de prêt (catalogue des « types de prêt »).
 *
 * Catalogue géré par le super-admin (`platform-admin` ou `loan.products.*`).
 * Un prêt (`loans.loan_product_public_id`) hérite des limites, frais, pénalités
 * et comptes comptables définis ici.
 *
 * API shape: LIST wraps under `data.loan_products` + `meta.pagination`;
 * SHOW / CREATE / UPDATE return the product directly under `data`.
 *
 * Note: les taux (`interest_rate`, `tax_rate`, …) sont des décimaux renvoyés
 * comme chaînes par l'API (colonnes `decimal`). Les montants sont stockés en
 * `*_minor` (scale 2). Les `*_policy_key` rattachent une politique de calcul
 * nommée (valeur d'enum fixe) au produit ; `null` = politique non rattachée.
 */
export type LoanProductStatus = "active" | "inactive" | "archived";

export type TermUnit = "day" | "week" | "month";

export type RepaymentFrequency = "daily" | "weekly" | "monthly" | "custom";

export type GuaranteeDepositType = "percentage" | "fixed";

/** Valeurs d'enum acceptées par l'API pour chaque clé de politique. */
export const INTEREST_POLICY_VALUE = "loan_interest_method";
export const PENALTY_POLICY_VALUE = "penalties_and_arrears";
export const REPAYMENT_ALLOCATION_POLICY_VALUE = "repayment_allocation_order";
export const FEE_POLICY_VALUE = "fees_taxes_insurance";

export type LoanProduct = {
  public_id: string;
  ledger_account_public_id: string | null;
  code: string;
  name: string;
  status: LoanProductStatus;
  min_term_count: number | null;
  max_term_count: number | null;
  term_unit: TermUnit | null;
  allowed_repayment_frequencies: RepaymentFrequency[] | null;
  requires_guarantor: boolean | null;
  requires_collateral: boolean | null;
  interest_policy_key: string | null;
  penalty_policy_key: string | null;
  repayment_allocation_policy_key: string | null;
  fee_policy_key: string | null;
  min_amount_minor: number | null;
  max_amount_minor: number | null;
  due_date_day: number | null;
  penalty_grace_days: number | null;
  min_grace_period_days: number | null;
  max_grace_period_days: number | null;
  interest_rate: string | null;
  tax_rate: string | null;
  insurance_rate: string | null;
  fee_amount_minor: number | null;
  floor_amount_minor: number | null;
  tax_policy_key: string | null;
  insurance_policy_key: string | null;
  guarantee_deposit_policy_key: string | null;
  guarantee_deposit_type: GuaranteeDepositType | null;
  guarantee_deposit_value: string | null;
  penalty_formula_type: string | null;
  penalty_formula_base: string | null;
  penalty_value_type: string | null;
  penalty_value: string | null;
  operation_type: string | null;
  constant_value: string | null;
  rules: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedLoanProducts = {
  data: LoanProduct[];
  meta: { pagination: Pagination };
};

export type LoanProductWritePayload = {
  ledger_account_public_id?: string | null;
  /** Immutable after creation (we disable it on edit). */
  code?: string;
  name?: string;
  /** Create accepts active/inactive; archive happens via DELETE. */
  status?: "active" | "inactive";
  min_term_count?: number | null;
  max_term_count?: number | null;
  term_unit?: TermUnit | null;
  allowed_repayment_frequencies?: RepaymentFrequency[] | null;
  requires_guarantor?: boolean;
  requires_collateral?: boolean;
  interest_policy_key?: string | null;
  penalty_policy_key?: string | null;
  repayment_allocation_policy_key?: string | null;
  fee_policy_key?: string | null;
  min_amount_minor?: number | null;
  max_amount_minor?: number | null;
  due_date_day?: number | null;
  penalty_grace_days?: number | null;
  min_grace_period_days?: number | null;
  max_grace_period_days?: number | null;
  interest_rate?: number | null;
  tax_rate?: number | null;
  insurance_rate?: number | null;
  fee_amount_minor?: number | null;
  floor_amount_minor?: number | null;
  tax_policy_key?: string | null;
  insurance_policy_key?: string | null;
  guarantee_deposit_policy_key?: string | null;
  guarantee_deposit_type?: GuaranteeDepositType | null;
  guarantee_deposit_value?: number | null;
  penalty_formula_type?: string | null;
  penalty_formula_base?: string | null;
  penalty_value_type?: string | null;
  penalty_value?: number | null;
};

/**
 * Paginated list. The only server filter is `status`; search is client-side.
 */
export async function fetchLoanProducts(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    status?: LoanProductStatus;
  } = {},
): Promise<PaginatedLoanProducts> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);

  const response = await fetch(`/api/v1/loan-products?${query.toString()}`, {
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
    throw new Error(`Failed to fetch loan products (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { loan_products?: LoanProduct[] } | LoanProduct[];
    meta?: PaginatedLoanProducts["meta"];
  };

  const rows: LoanProduct[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.loan_products)
      ? envelope.data!.loan_products!
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

export async function getLoanProduct(
  token: string,
  publicId: string,
): Promise<LoanProduct> {
  return apiRequest<LoanProduct>(`loan-products/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function createLoanProduct(
  token: string,
  payload: LoanProductWritePayload,
): Promise<LoanProduct> {
  return apiRequest<LoanProduct>("loan-products", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateLoanProduct(
  token: string,
  publicId: string,
  payload: LoanProductWritePayload,
): Promise<LoanProduct> {
  return apiRequest<LoanProduct>(`loan-products/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

/** Archive (soft-delete) a product. */
export async function deleteLoanProduct(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`loan-products/${publicId}`, {
    method: "DELETE",
    token,
  });
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
