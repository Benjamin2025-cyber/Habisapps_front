import { apiRequest } from "./client";

export type DashboardPeriod = {
  from: string | null;
  to: string | null;
};

export type DashboardParBuckets = {
  par30_outstanding_at_risk_minor: number;
  par60_outstanding_at_risk_minor: number;
  par90_outstanding_at_risk_minor: number;
};

export type DashboardCollections = {
  expected_collection_minor: number;
  actual_collection_minor: number;
  /** null when no expected collection in the window. */
  performance_ratio: number | null;
};

export type DashboardTellerVariances = {
  closed_count: number;
  variance_count: number;
  variance_total_abs_minor: number;
};

export type OperationalDashboard = {
  agency_public_id: string | null;
  currency: string;
  period: DashboardPeriod;
  loan_product_public_id: string | null;
  loan_status: string | null;
  premium_status: string | null;
  claim_status: string | null;
  /** ISO 8601 timestamp of the freshest underlying record. */
  data_freshness_at: string;
  portfolio_outstanding_minor: number;
  par: DashboardParBuckets;
  collections: DashboardCollections;
  cash_position_minor: number;
  teller_variances: DashboardTellerVariances;
  /** Hidden in the UI for now (modules futurs cachés). */
  insurance_premiums?: {
    assessed_minor: number;
    paid_minor: number;
    due_count: number;
    paid_count: number;
  };
  claims_by_status?: Record<string, number>;
};

export type OperationalDashboardFilters = {
  agency_public_id?: string;
  period_starts_on?: string;
  period_ends_on?: string;
};

export async function getOperationalDashboard(
  token: string,
  filters: OperationalDashboardFilters = {},
): Promise<OperationalDashboard> {
  return apiRequest<OperationalDashboard>("dashboards/operational", {
    method: "GET",
    token,
    query: {
      agency_public_id: filters.agency_public_id,
      period_starts_on: filters.period_starts_on,
      period_ends_on: filters.period_ends_on,
    },
  });
}
