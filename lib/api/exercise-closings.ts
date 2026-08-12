import { apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * Clôture annuelle — transfert du résultat de l'exercice.
 *
 * À la fin de l'exercice, les classes 6 et 7 sont soldées et le résultat est
 * porté au 131 (bénéfice) ou au 132 (perte). La clôture produit une écriture
 * ordinaire : elle est créée **soumise**, pas comptabilisée, et doit donc être
 * approuvée puis comptabilisée depuis les écritures comptables — c'est le
 * contrôle à quatre yeux sur la plus grosse écriture de l'année.
 *
 * Deux contraintes côté API, à refléter dans l'interface :
 *  - les exercices se clôturent dans l'ordre, et la clôture antérieure doit être
 *    *comptabilisée* (une clôture en attente de revue n'a rien transféré) ;
 *  - l'écriture est datée du dernier jour de l'exercice, donc la journée
 *    comptable de cette date doit être ouverte au moment de la clôture.
 *
 * Un exercice sans mouvement de classe 6 ou 7 n'a rien à clôturer : l'API refuse
 * la clôture, et cet exercice ne bloque pas les suivants.
 *
 * Permission : `accounting.exercise.close` (création) ;
 * `accounting.audit.view` (consultation).
 */
export type ExerciseClosing = {
  public_id: string;
  agency_public_id: string | null;
  fiscal_year: number;
  opens_on: string;
  closes_on: string;
  currency: string;
  net_result_minor: number;
  /** `131` for a bénéfice, `132` for a perte. */
  result_account_code: string;
  /**
   * Statut de l'écriture qui réalise le transfert, pas une copie : tant qu'elle
   * n'est pas `posted`, rien n'a été transféré.
   */
  status: string;
  posted: boolean;
  journal_entry_public_id: string | null;
};

export type ExerciseClosingCreatePayload = {
  agency_public_id?: string;
  fiscal_year: number;
  currency?: string;
};

export async function fetchExerciseClosings(
  token: string,
): Promise<ExerciseClosing[]> {
  const response = await fetch("/api/v1/exercise-closings", {
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
      `Failed to fetch exercise-closings (HTTP ${response.status})`,
    );
  }

  const envelope = JSON.parse(text) as {
    data?: { exercise_closings?: ExerciseClosing[] } | ExerciseClosing[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  const nested = envelope.data?.exercise_closings;
  return Array.isArray(nested) ? nested : [];
}

export async function createExerciseClosing(
  token: string,
  payload: ExerciseClosingCreatePayload,
): Promise<ExerciseClosing> {
  return apiRequest<ExerciseClosing>("exercise-closings", {
    method: "POST",
    token,
    body: payload,
  });
}
