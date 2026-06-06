import { apiRequest, notifyAuthExpired } from "./client";

/**
 * P18 — Comptabilité › Opérations diverses (OD) — écritures de journal.
 *
 * Cycle de vie (state machine appliquée côté API/DB) :
 *   draft → submitted → approved → posted → reversed
 * Une OD se compose d'un **en-tête** (référence, date, agence…) et de
 * **lignes** (imputations débit/crédit sur les comptes du plan comptable).
 * Les lignes s'ajoutent/suppriment tant que l'écriture est en brouillon ;
 * à la soumission, l'écriture doit comporter ≥ 2 lignes équilibrées
 * (Σ débits = Σ crédits).
 *
 * Shapes :
 *  - LIST  → format paginé Laravel par défaut : `data` (tableau) + `meta`
 *            (current_page / per_page / total / last_page au premier niveau).
 *  - SHOW / CREATE / actions → l'écriture (avec `lines`) directement sous `data`.
 */
export type JournalEntryStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "posted"
  | "rejected"
  | "cancelled"
  | "archived"
  | "reversed";

export type JournalLine = {
  public_id: string;
  journal_entry_public_id: string | null;
  ledger_account_public_id: string | null;
  customer_account_public_id: string | null;
  debit_minor: number;
  credit_minor: number;
  currency: string;
  line_memo: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  public_id: string;
  reference: string;
  business_date: string;
  posted_at: string | null;
  agency_public_id: string | null;
  source_module: string | null;
  source_type: string | null;
  source_public_id: string | null;
  status: JournalEntryStatus;
  description: string | null;
  submitted_at: string | null;
  submitted_by_user_public_id: string | null;
  reviewed_at: string | null;
  reviewed_by_user_public_id: string | null;
  review_comment: string | null;
  rejection_reason: string | null;
  reversal_of_public_id: string | null;
  lines: JournalLine[];
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedJournalEntries = {
  data: JournalEntry[];
  meta: { pagination: Pagination };
};

export type JournalEntryCreatePayload = {
  reference: string;
  business_date: string;
  agency_public_id: string;
  description?: string | null;
  source_module?: string | null;
};

export type JournalEntryUpdatePayload = {
  reference?: string;
  business_date?: string;
  description?: string | null;
};

export type JournalLineCreatePayload = {
  journal_entry_public_id: string;
  ledger_account_public_id: string;
  customer_account_public_id?: string | null;
  debit_minor: number;
  credit_minor: number;
  currency: string;
  line_memo?: string | null;
};

/**
 * Paginated list. The index exposes no server-side filters, so status
 * filtering is applied client-side over the loaded page.
 */
/**
 * `GET /journal-entries/stats` — counts grouped by status (a partition of the
 * scoped total) plus a `submitted_count` convenience aggregate.
 */
export type JournalEntryStats = {
  by_status: Record<string, number>;
  submitted_count: number;
};

export async function getJournalEntryStats(
  token: string,
): Promise<JournalEntryStats> {
  return apiRequest<JournalEntryStats>("journal-entries/stats", {
    method: "GET",
    token,
  });
}

export async function fetchJournalEntries(
  token: string,
  options: { page?: number; perPage?: number; status?: JournalEntryStatus } = {},
): Promise<PaginatedJournalEntries> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("filter[status]", options.status);

  const response = await fetch(`/api/v1/journal-entries?${query.toString()}`, {
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
    throw new Error(`Failed to fetch journal entries (HTTP ${response.status})`);
  }

  // Default Laravel paginated resource shape: { data: [...], meta: { current_page, ... } }
  const envelope = JSON.parse(text) as {
    data?: JournalEntry[];
    meta?: Partial<Pagination>;
  };
  const rows = Array.isArray(envelope.data) ? envelope.data : [];
  const m = envelope.meta ?? {};

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

export async function getJournalEntry(
  token: string,
  publicId: string,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}`, {
    method: "GET",
    token,
  });
}

export async function createJournalEntry(
  token: string,
  payload: JournalEntryCreatePayload,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>("journal-entries", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function updateJournalEntry(
  token: string,
  publicId: string,
  payload: JournalEntryUpdatePayload,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}`, {
    method: "PATCH",
    token,
    body: stripUndefined(payload),
  });
}

export async function deleteJournalEntry(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`journal-entries/${publicId}`, {
    method: "DELETE",
    token,
  });
}

export async function addJournalLine(
  token: string,
  payload: JournalLineCreatePayload,
): Promise<JournalLine> {
  return apiRequest<JournalLine>("journal-lines", {
    method: "POST",
    token,
    body: stripUndefined(payload),
  });
}

export async function deleteJournalLine(
  token: string,
  linePublicId: string,
): Promise<null> {
  return apiRequest<null>(`journal-lines/${linePublicId}`, {
    method: "DELETE",
    token,
  });
}

export async function submitJournalEntry(
  token: string,
  publicId: string,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}/submit`, {
    method: "POST",
    token,
  });
}

export async function approveJournalEntry(
  token: string,
  publicId: string,
  comment?: string | null,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}/approve`, {
    method: "POST",
    token,
    body: comment ? { comment } : {},
  });
}

export async function rejectJournalEntry(
  token: string,
  publicId: string,
  reason: string,
  comment?: string | null,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}/reject`, {
    method: "POST",
    token,
    body: stripUndefined({ reason, comment: comment ?? undefined }),
  });
}

export async function postJournalEntry(
  token: string,
  publicId: string,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}/post`, {
    method: "POST",
    token,
  });
}

export async function reverseJournalEntry(
  token: string,
  publicId: string,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(`journal-entries/${publicId}/reverse`, {
    method: "POST",
    token,
  });
}

/** Σ debit / Σ credit over an entry's lines (minor units). */
export function entryTotals(entry: Pick<JournalEntry, "lines">): {
  debit: number;
  credit: number;
  balanced: boolean;
} {
  const debit = entry.lines.reduce((sum, l) => sum + (l.debit_minor || 0), 0);
  const credit = entry.lines.reduce((sum, l) => sum + (l.credit_minor || 0), 0);
  return { debit, credit, balanced: debit === credit && debit > 0 };
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
