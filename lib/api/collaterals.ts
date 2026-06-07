import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P12 — Objets en garantie (collaterals) + leurs items.
 *
 * Loan-scoped : `loans/{loan}/collaterals` (CRUD + `/release`) et
 * `loans/{loan}/collaterals/{collateral}/items` (POST/PATCH).
 *
 * `collateral_type` pilote le formulaire d'item côté FE (champs adaptatifs) :
 * l'API ne contraint PAS les champs par type — `chassis_number` /
 * `registration_number` sont des colonnes dédiées (véhicules) et le reste passe
 * par le sac JSON `metadata`. La libération (`/release`) n'est possible qu'après
 * clôture du prêt (loan.status = closed).
 *
 * Envelopes : LIST → `data.collaterals` ; CREATE/UPDATE/RELEASE → l'entité
 * directement sous `data` (items inclus dans la ressource collateral).
 */
export type CollateralType = "real_estate" | "movable" | "personal_guarantee";

export type CollateralStatus = "active" | "released" | "archived";

export type CollateralItem = {
  public_id: string;
  quantity: number | null;
  description: string;
  reference: string | null;
  chassis_number: string | null;
  registration_number: string | null;
  amount_minor: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Collateral = {
  public_id: string;
  agency_public_id: string | null;
  client_public_id: string | null;
  loan_public_id: string | null;
  document_public_id: string | null;
  collateral_type: CollateralType;
  description: string | null;
  owner_full_name: string | null;
  status: CollateralStatus;
  valuation_date: string | null;
  declared_value_minor: number | null;
  currency: string | null;
  items: CollateralItem[];
  created_at: string;
  updated_at: string;
};

export type CollateralWritePayload = {
  client_public_id?: string | null;
  document_public_id?: string | null;
  collateral_type?: CollateralType;
  description?: string | null;
  owner_full_name?: string | null;
  valuation_date?: string | null;
  declared_value_minor?: number | null;
  currency?: string | null;
};

export type CollateralItemWritePayload = {
  quantity?: number | null;
  description?: string;
  reference?: string | null;
  chassis_number?: string | null;
  registration_number?: string | null;
  amount_minor?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function fetchCollaterals(
  token: string,
  loanPublicId: string,
  options: { page?: number; perPage?: number } = {},
): Promise<Collateral[]> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/loans/${loanPublicId}/collaterals?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
        "X-Locale": getRequestLocale(),
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    },
  );

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch collaterals (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: { collaterals?: Collateral[] } | Collateral[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  return envelope.data?.collaterals ?? [];
}

export async function createCollateral(
  token: string,
  loanPublicId: string,
  payload: CollateralWritePayload,
): Promise<Collateral> {
  return apiRequest<Collateral>(`loans/${loanPublicId}/collaterals`, {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateCollateral(
  token: string,
  loanPublicId: string,
  collateralPublicId: string,
  payload: CollateralWritePayload,
): Promise<Collateral> {
  return apiRequest<Collateral>(
    `loans/${loanPublicId}/collaterals/${collateralPublicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

/** Release a collateral. Requires the loan to be closed (else 422). */
export async function releaseCollateral(
  token: string,
  loanPublicId: string,
  collateralPublicId: string,
): Promise<Collateral> {
  return apiRequest<Collateral>(
    `loans/${loanPublicId}/collaterals/${collateralPublicId}/release`,
    { method: "POST", token, body: {} },
  );
}

export async function createCollateralItem(
  token: string,
  loanPublicId: string,
  collateralPublicId: string,
  payload: CollateralItemWritePayload,
): Promise<CollateralItem> {
  return apiRequest<CollateralItem>(
    `loans/${loanPublicId}/collaterals/${collateralPublicId}/items`,
    { method: "POST", token, body: stripUndefined(payload) },
  );
}

export async function updateCollateralItem(
  token: string,
  loanPublicId: string,
  collateralPublicId: string,
  itemPublicId: string,
  payload: CollateralItemWritePayload,
): Promise<CollateralItem> {
  return apiRequest<CollateralItem>(
    `loans/${loanPublicId}/collaterals/${collateralPublicId}/items/${itemPublicId}`,
    { method: "PATCH", token, body: stripUndefined(payload) },
  );
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
