import { ApiError, apiRequest, notifyAuthExpired } from "./client";
import { getRequestLocale } from "./locale";

/**
 * P16 — Comptabilité › Plan comptable (comptes généraux / ledger accounts).
 *
 * Le plan comptable est le référentiel des comptes du grand livre : chaque
 * compte porte une classe (actif/passif/capitaux/produit/charge), un sens
 * normal (débit/crédit) et peut être rattaché à un compte parent (hiérarchie).
 * Les écritures comptables (journal) imputent des montants sur ces comptes ;
 * leur solde et leurs mouvements se consultent via `/balance` et `/movements`.
 *
 * API shape:
 *  - LIST  → `data.ledger_accounts` + `meta.pagination`
 *  - SHOW / CREATE / UPDATE → le compte directement sous `data`
 *  - BALANCE → l'objet solde directement sous `data`
 *  - MOVEMENTS → `data.{statement, movements}` + `meta.pagination`
 *
 * Le scope agence est appliqué côté API : un compte sans agence (`agency_id`
 * null) est institutionnel et visible par tous ; sinon il est limité à son
 * agence (sauf `platform-admin` / `ledger.scope.institution.read`).
 *
 * Plan comptable consolidé : un compte **de regroupement** (`is_postable`
 * false) ne reçoit aucune écriture — son solde est la consolidation des comptes
 * de détail placés sous lui. C'est le cas de tout compte institutionnel
 * (`scope: "institution"`, ex. `571000 Caisse Globale` regroupant `571001`,
 * `571002`… par agence) et de tout compte d'agence ayant acquis un
 * sous-compte : l'API bascule alors automatiquement son `is_postable` à false.
 * Ne jamais proposer un compte non imputable comme cible d'écriture.
 *
 * Le solde d'un compte de regroupement est consolidé par défaut ; `consolidated`
 * force le comportement (`false` = mouvements propres uniquement). Le champ
 * `scope` de la réponse indique lequel des deux a été renvoyé.
 */
/**
 * Classes du PCEMF (Plan Comptable des Établissements de Microfinance,
 * CEMAC/COBAC) — le plan qu'un EMF camerounais est tenu de tenir. La classe est
 * le premier chiffre du code : `571001` est un compte de classe 5.
 *
 * Remplace les natures IFRS (asset/liability/equity/revenue/expense), qui
 * décrivaient la nature d'un compte et non sa place dans le plan national. La
 * nature reste déductible : les classes 6 et 7 forment le compte de résultat, 8
 * le hors bilan, et pour les classes 1 à 5 le côté du bilan suit
 * `normal_balance_side`.
 */
export type LedgerAccountClass =
  /** Classe 1 — Comptes de capitaux permanents. */
  | "capitaux_permanents"
  /** Classe 2 — Comptes de valeurs immobilisées. */
  | "valeurs_immobilisees"
  /** Classe 3 — Comptes d'opérations avec la clientèle. */
  | "operations_clientele"
  /** Classe 4 — Comptes de tiers. */
  | "tiers"
  /** Classe 5 — Comptes de trésorerie et d'opérations interbancaires. */
  | "tresorerie_interbancaire"
  /** Classe 6 — Comptes de charges. */
  | "charges"
  /** Classe 7 — Comptes de produits. */
  | "produits"
  /** Classe 8 — Comptes de hors bilan. */
  | "hors_bilan";

export type LedgerNormalBalanceSide = "debit" | "credit";

export type LedgerAccountStatus =
  | "active"
  | "inactive"
  | "suspended"
  | "archived";

/** `institution` == `agency_public_id === null`; the API sends both. */
export type LedgerAccountScope = "agency" | "institution";

export type LedgerAccount = {
  public_id: string;
  scope: LedgerAccountScope;
  agency_public_id: string | null;
  parent_account_public_id: string | null;
  code: string;
  name: string;
  account_class: LedgerAccountClass;
  account_type: string | null;
  /** False for a grouping account: it consolidates its children and refuses entries. */
  is_postable: boolean;
  normal_balance_side: LedgerNormalBalanceSide;
  status: LedgerAccountStatus;
  created_at: string;
  updated_at: string;
};

/** A grouping account can never be an entry target. */
export function isPostableTarget(account: LedgerAccount): boolean {
  return account.status === "active" && account.is_postable;
}

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedLedgerAccounts = {
  data: LedgerAccount[];
  meta: { pagination: Pagination };
};

export type LedgerAccountCreatePayload = {
  /** Defaults to `agency` API-side. `institution` requires ledger.scope.institution.manage. */
  scope?: LedgerAccountScope;
  agency_public_id?: string | null;
  code: string;
  name: string;
  account_class: LedgerAccountClass;
  account_type?: string | null;
  is_postable?: boolean;
  parent_account_public_id?: string | null;
  normal_balance_side: LedgerNormalBalanceSide;
  status?: "active" | "inactive" | "suspended";
};

/**
 * Update is partial. `code` and `agency` are immutable; `account_class` is
 * correctable only while the account carries no movements (API-enforced).
 */
export type LedgerAccountUpdatePayload = {
  name?: string;
  account_class?: LedgerAccountClass;
  account_type?: string | null;
  is_postable?: boolean;
  parent_account_public_id?: string | null;
  normal_balance_side?: LedgerNormalBalanceSide;
  status?: LedgerAccountStatus;
};

/**
 * `ledger_account_consolidated` means the figure includes the whole subtree, so
 * it must be labelled as consolidated rather than shown as own movements.
 */
export type LedgerBalanceScope =
  | "ledger_account"
  | "ledger_account_consolidated";

/** Solde agrégé d'un compte sur une période (montants en *_minor, scale 2). */
export type LedgerAccountBalance = {
  scope: LedgerBalanceScope;
  public_id: string;
  currency: string;
  from: string | null;
  to: string | null;
  debit_total_minor: number;
  credit_total_minor: number;
  balance_minor: number;
  normal_balance_side: LedgerNormalBalanceSide | null;
};

/** Résumé du relevé (mouvements + soldes d'ouverture/clôture). */
export type LedgerStatement = {
  scope: LedgerBalanceScope;
  public_id: string;
  currency: string;
  from: string | null;
  to: string | null;
  opening_balance_minor: number;
  debit_total_minor: number;
  credit_total_minor: number;
  closing_balance_minor: number;
  normal_balance_side: LedgerNormalBalanceSide | null;
};

export type LedgerMovement = {
  public_id: string;
  journal_entry_public_id: string;
  ledger_account_public_id: string;
  reference: string | null;
  business_date: string;
  currency: string;
  debit_minor: number;
  credit_minor: number;
  signed_amount_minor: number;
  line_memo: string | null;
};

export type LedgerAccountMovements = {
  statement: LedgerStatement;
  movements: LedgerMovement[];
  meta: { pagination: Pagination };
};

const JSON_HEADERS = (token: string): Record<string, string> => ({
  Accept: "application/json",
  "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
  "X-Locale": getRequestLocale(),
  Authorization: `Bearer ${token}`,
});

/**
 * Paginated list. The API does not expose server-side filters here, so
 * search / class / status filtering is applied client-side over the loaded
 * page (the chart of accounts is a bounded referential).
 */
export async function fetchLedgerAccounts(
  token: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PaginatedLedgerAccounts> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 100));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(`/api/v1/ledger-accounts?${query.toString()}`, {
    method: "GET",
    headers: JSON_HEADERS(token),
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    // ApiError rather than Error: callers need the status to tell a permission
    // refusal (403) apart from a real failure.
    throw new ApiError(
      `Failed to fetch ledger accounts (HTTP ${response.status})`,
      response.status,
      null,
    );
  }

  // The ledger-accounts endpoint returns Laravel's default paginated shape:
  // `{ data: { ledger_accounts: [...] }, meta: { current_page, per_page, total,
  // last_page, ... } }` — a FLAT meta, unlike the app envelope's `meta.pagination`.
  const envelope = JSON.parse(text) as {
    data?: { ledger_accounts?: LedgerAccount[] } | LedgerAccount[];
    meta?: Partial<Pagination> & { pagination?: Partial<Pagination> };
  };

  const rows: LedgerAccount[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.ledger_accounts)
      ? envelope.data!.ledger_accounts!
      : [];

  // Accept either a nested `meta.pagination` (app envelope) or a flat `meta`.
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};

  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? options.perPage ?? 25,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

export async function getLedgerAccount(
  token: string,
  publicId: string,
): Promise<LedgerAccount> {
  return apiRequest<LedgerAccount>(`ledger-accounts/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function createLedgerAccount(
  token: string,
  payload: LedgerAccountCreatePayload,
): Promise<LedgerAccount> {
  return apiRequest<LedgerAccount>("ledger-accounts", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateLedgerAccount(
  token: string,
  publicId: string,
  payload: LedgerAccountUpdatePayload,
): Promise<LedgerAccount> {
  return apiRequest<LedgerAccount>(`ledger-accounts/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

/** Archive (soft-delete) — sets status to `archived`. */
export async function deleteLedgerAccount(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`ledger-accounts/${publicId}`, {
    method: "DELETE",
    token,
  });
}

export async function getLedgerAccountBalance(
  token: string,
  publicId: string,
  options: {
    currency?: string;
    from?: string;
    to?: string;
    /** Omit to let the API decide from `is_postable`. */
    consolidated?: boolean;
  } = {},
): Promise<LedgerAccountBalance> {
  return apiRequest<LedgerAccountBalance>(`ledger-accounts/${publicId}/balance`, {
    method: "GET",
    token,
    query: {
      currency: options.currency,
      from: options.from,
      to: options.to,
      consolidated: options.consolidated,
    },
  });
}

export async function fetchLedgerAccountMovements(
  token: string,
  publicId: string,
  options: {
    currency?: string;
    from?: string;
    to?: string;
    /** Omit to let the API decide from `is_postable`. */
    consolidated?: boolean;
    page?: number;
    perPage?: number;
  } = {},
): Promise<LedgerAccountMovements> {
  const query = new URLSearchParams();
  if (options.currency) query.set("currency", options.currency);
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  if (options.consolidated !== undefined) {
    query.set("consolidated", String(options.consolidated));
  }
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));

  const response = await fetch(
    `/api/v1/ledger-accounts/${publicId}/movements?${query.toString()}`,
    { method: "GET", headers: JSON_HEADERS(token), credentials: "omit" },
  );

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    // A grouping account's statement consolidates every agency beneath it, so
    // 403 here is an expected permission outcome, not a fault: keep the status.
    throw new ApiError(
      `Failed to fetch ledger movements (HTTP ${response.status})`,
      response.status,
      null,
    );
  }

  const envelope = JSON.parse(text) as {
    data?: { statement?: LedgerStatement; movements?: LedgerMovement[] };
    meta?: { pagination?: Pagination };
  };

  return {
    statement: envelope.data?.statement as LedgerStatement,
    movements: envelope.data?.movements ?? [],
    meta: envelope.meta?.pagination
      ? { pagination: envelope.meta.pagination }
      : {
          pagination: {
            current_page: 1,
            per_page: options.perPage ?? 25,
            total: envelope.data?.movements?.length ?? 0,
            last_page: 1,
          },
        },
  };
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
