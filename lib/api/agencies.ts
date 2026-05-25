import { apiRequest } from "./client";

export type Agency = {
  id: number;
  public_id: string;
  code: string;
  name: string;
  status: string;
  manager?: {
    public_id: string;
    name: string;
  } | null;
};

export type PaginatedAgencies = {
  data: Agency[];
  meta?: {
    pagination?: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
};

export async function listAgencies(
  token: string,
  options: { perPage?: number; status?: string } = {},
): Promise<Agency[]> {
  const result = await apiRequest<Agency[] | { data: Agency[] }>("agencies", {
    method: "GET",
    token,
    query: {
      per_page: options.perPage ?? 100,
      "filter[status]": options.status,
    },
  });

  // The API may return either a bare array or { data: [...] } envelope.
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { data?: unknown }).data)) {
    return (result as { data: Agency[] }).data;
  }
  return [];
}
