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
  /** Count of loans currently `active`. */
  active_loan_count: number;
  /** Count of loans in arrears (overdue, unpaid schedule exposure as of today). */
  delinquent_loan_count: number;
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

/* ------------------------------------------------------------------ *
 * Operational timeseries — two series (balance + collection) over time
 * buckets. Feeds the "Performances financières" + "Suivi des crédits"
 * charts. (`GET /dashboards/operational/timeseries`)
 * ------------------------------------------------------------------ */
export type DashboardTimeseriesPoint = {
  /** Bucket label (ISO timestamp or date depending on granularity). */
  bucket: string;
  balance_minor: number;
  collection_minor: number;
};

export type DashboardTimeseries = {
  agency_public_id: string | null;
  currency: string;
  period: DashboardPeriod;
  granularity: string;
  loan_product_public_id: string | null;
  loan_status: string | null;
  points: DashboardTimeseriesPoint[];
};

export type DashboardTimeseriesFilters = {
  agency_public_id?: string;
  /** today | week | month | year — backend picks a sensible bucket granularity. */
  period?: string;
  period_starts_on?: string;
  period_ends_on?: string;
  currency?: string;
};

export async function getDashboardTimeseries(
  token: string,
  filters: DashboardTimeseriesFilters = {},
): Promise<DashboardTimeseries> {
  return apiRequest<DashboardTimeseries>("dashboards/operational/timeseries", {
    method: "GET",
    token,
    query: {
      agency_public_id: filters.agency_public_id,
      period: filters.period,
      period_starts_on: filters.period_starts_on,
      period_ends_on: filters.period_ends_on,
      currency: filters.currency,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Per-agency performance table. (`GET /dashboards/agencies-performance`)
 * ------------------------------------------------------------------ */
export type AgencyPerformanceRow = {
  agency_public_id: string;
  agency_code: string;
  agency_name: string;
  collections_minor: number;
  loans_count: number;
  loans_amount_minor: number;
  delinquent_count: number;
  delinquent_amount_minor: number;
  best_agent_public_id: string | null;
  best_agent_name: string | null;
};

export type AgenciesPerformance = {
  currency: string;
  period: DashboardPeriod;
  agencies: AgencyPerformanceRow[];
};

export type AgenciesPerformanceFilters = {
  agency_public_id?: string;
  period?: string;
  period_starts_on?: string;
  period_ends_on?: string;
};

export async function getAgenciesPerformance(
  token: string,
  filters: AgenciesPerformanceFilters = {},
): Promise<AgenciesPerformance> {
  return apiRequest<AgenciesPerformance>("dashboards/agencies-performance", {
    method: "GET",
    token,
    query: {
      agency_public_id: filters.agency_public_id,
      period: filters.period,
      period_starts_on: filters.period_starts_on,
      period_ends_on: filters.period_ends_on,
    },
  });
}
