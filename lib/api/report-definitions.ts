import { notifyAuthExpired } from "./client";

/**
 * Report definitions (#28) — the catalogue of generatable reports. A report run
 * (POST /report-runs) references a definition by `public_id`. Definitions are
 * seeded server-side (StandardReportDefinitionSeeder), so the FE can now offer
 * generation. List shape: `data.report_definitions` + `meta.pagination`.
 */
export type ReportDefinition = {
  public_id: string;
  code: string;
  name: string;
  report_type: string;
  module: string;
  status: string;
  version: number;
  effective_from: string | null;
  effective_to: string | null;
  supported_parameters: string[];
  requires_agency: boolean;
  requires_currency: boolean;
  requires_period: boolean;
  description: string | null;
};

export async function fetchReportDefinitions(
  token: string,
  options: {
    reportType?: string;
    module?: string;
    status?: string;
    search?: string;
    perPage?: number;
  } = {},
): Promise<ReportDefinition[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.reportType) query.set("filter[report_type]", options.reportType);
  if (options.module) query.set("filter[module]", options.module);
  if (options.status) query.set("filter[status]", options.status);
  if (options.search) query.set("search", options.search);

  const response = await fetch(`/api/v1/report-definitions?${query.toString()}`, {
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
    throw new Error(`Failed to fetch report definitions (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { report_definitions?: ReportDefinition[] } | ReportDefinition[];
  };
  return Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.report_definitions)
      ? envelope.data!.report_definitions!
      : [];
}
