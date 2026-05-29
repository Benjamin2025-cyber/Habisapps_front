import { apiRequest, notifyAuthExpired } from "./client";

export type ProxyStatus =
  | "draft"
  | "pending_review"
  | "verified"
  | "rejected"
  | "deactivated"
  | "expired"
  | "archived";

export type ProxyVerificationStatus =
  | "not_submitted"
  | "submitted"
  | "verified"
  | "rejected";

export type ProxyAction =
  | "submit"
  | "verify"
  | "reject"
  | "archive"
  | "deactivate"
  | "expire";

export type ProxyOperationType =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "loan_repayment"
  | "statement_request";

export type ClientProxy = {
  public_id: string;
  client_public_id: string | null;
  customer_account_public_id: string | null;
  document_public_id: string | null;
  proxy_full_name: string | null;
  proxy_phone_number: string | null;
  proxy_email: string | null;
  proxy_id_document_type: string | null;
  proxy_id_document_number: string | null;
  mandate_type: string;
  operation_types: ProxyOperationType[] | null;
  max_amount_minor: number | null;
  limit_currency: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: ProxyStatus;
  verification_status: ProxyVerificationStatus;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProxyWritePayload = {
  proxy_full_name?: string;
  proxy_phone_number?: string | null;
  proxy_email?: string | null;
  proxy_id_document_type?: string | null;
  proxy_id_document_number?: string | null;
  mandate_type?: string;
  customer_account_public_id?: string | null;
  operation_types?: ProxyOperationType[] | null;
  max_amount_minor?: number | null;
  limit_currency?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  document_public_id?: string | null;
};

export type ProxyStatusPayload = {
  action: ProxyAction;
  reason?: string | null;
  comment?: string | null;
};

export async function fetchProxies(
  token: string,
  clientPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<ClientProxy[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 50));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/clients/${clientPublicId}/proxies?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    },
  );

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch proxies (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { proxies?: ClientProxy[] } | ClientProxy[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.proxies ?? [];
}

export async function createProxy(
  token: string,
  clientPublicId: string,
  payload: ProxyWritePayload,
): Promise<ClientProxy> {
  return apiRequest<ClientProxy>(`clients/${clientPublicId}/proxies`, {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateProxy(
  token: string,
  clientPublicId: string,
  publicId: string,
  payload: ProxyWritePayload,
): Promise<ClientProxy> {
  return apiRequest<ClientProxy>(
    `clients/${clientPublicId}/proxies/${publicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

export async function updateProxyStatus(
  token: string,
  clientPublicId: string,
  publicId: string,
  payload: ProxyStatusPayload,
): Promise<ClientProxy> {
  return apiRequest<ClientProxy>(
    `clients/${clientPublicId}/proxies/${publicId}/status`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

function stripUndefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
