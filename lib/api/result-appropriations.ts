import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * Affectation du résultat — ce que l'assemblée générale décide de faire du
 * résultat de l'exercice.
 *
 * La clôture porte le résultat au 131 (bénéfice) ou au 132 (perte). Il y reste
 * jusqu'à ce que l'AG en décide la répartition : réserve légale, autres réserves,
 * report à nouveau, dividendes. L'affectation vide le 131 (ou le 132) et crédite
 * les comptes retenus.
 *
 * Le système ne calcule pas la répartition : le taux de la réserve légale et ce
 * qui part en report à nouveau relèvent de la décision de l'assemblée, consignée
 * dans son procès-verbal. Il vérifie seulement que la somme des affectations égale
 * le résultat, faute de quoi le 131 garderait un reliquat que plus rien ne
 * pourrait solder.
 *
 * Comme la clôture, l'affectation crée une écriture **soumise** : rien n'est
 * transféré avant approbation puis comptabilisation.
 *
 * Permission : `accounting.exercise.appropriate` (création) ;
 * `accounting.audit.view` (consultation).
 */
export type ResultAppropriation = {
  public_id: string;
  agency_public_id: string | null;
  fiscal_year: number;
  currency: string;
  /** `131` when a profit was allocated, `132` for a loss. */
  source_account_code: string;
  amount_minor: number;
  decided_on: string;
  status: string;
  posted: boolean;
  journal_entry_public_id: string | null;
};

export type ResultAppropriationLine = {
  ledger_account_public_id: string;
  amount_minor: number;
};

export type ResultAppropriationCreatePayload = {
  agency_public_id?: string;
  fiscal_year: number;
  decided_on: string;
  allocations: ResultAppropriationLine[];
  currency?: string;
};

export async function fetchResultAppropriations(
  token: string,
): Promise<ResultAppropriation[]> {
  const response = await fetch("/api/v1/result-appropriations", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      "X-Locale": getRequestLocale(),
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(
      `Failed to fetch result-appropriations (HTTP ${response.status})`,
    );
  }

  const envelope = JSON.parse(text) as {
    data?:
      | { result_appropriations?: ResultAppropriation[] }
      | ResultAppropriation[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  const nested = envelope.data?.result_appropriations;
  return Array.isArray(nested) ? nested : [];
}

export async function createResultAppropriation(
  token: string,
  payload: ResultAppropriationCreatePayload,
): Promise<ResultAppropriation> {
  return apiRequest<ResultAppropriation>("result-appropriations", {
    method: "POST",
    token,
    body: payload,
  });
}
