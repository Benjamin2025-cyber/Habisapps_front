/**
 * Known batch-procedure codes the backend can actually execute.
 *
 * ⚠️ TEMPORARY MIRROR OF BACKEND SOURCE. The list below is copied from
 * `App\Application\BatchRuns\ExecuteRegisteredBatchRun` (the dispatch that maps
 * a procedure `code` → a handler class). The API does **not** yet expose this
 * catalog, so we hardcode it. A procedure whose code is not in this set can be
 * saved as a row but every run of it fails at execute with
 * "This batch procedure is not executable."
 *
 * → Replace this constant with a fetch once the backend exposes the executable
 *   codes (GitHub issue: "Expose an endpoint listing executable batch-procedure
 *   codes"; tracked in back-issues-round3.md §G). Until then, keep this in sync
 *   whenever the backend dev wires a new handler.
 */

/**
 * Canonical codes offered when **creating** a procedure — one per backend
 * handler. Aliases (below) are recognised but not offered, to keep the picker
 * clean.
 */
export const KNOWN_BATCH_PROCEDURE_CODES = [
  "loan_arrears_assessment",
  "loan_monthly_arrears_penalty",
  "loan_portfolio_report_hook",
  "accounting_close_verification",
  "cash_close_verification",
] as const;

export type KnownBatchProcedureCode =
  (typeof KNOWN_BATCH_PROCEDURE_CODES)[number];

/**
 * Extra codes the backend ALSO executes (aliases of the handlers above). Not
 * offered on create, but recognised so `isExecutableBatchCode` doesn't wrongly
 * warn on a procedure registered under an alias.
 */
const BATCH_PROCEDURE_CODE_ALIASES = [
  "accounting_daily_close",
  "journal_close_verification",
  "cash_daily_close",
  "agency_cash_close",
  "credit_portfolio_report_hook",
  "portfolio_report_generation",
  "loan_servicing_notification_hook",
  "loan_notifications_hook",
  "credit_notification_hook",
] as const;

const EXECUTABLE = new Set<string>([
  ...KNOWN_BATCH_PROCEDURE_CODES,
  ...BATCH_PROCEDURE_CODE_ALIASES,
]);

/** Normalise a code the way the backend does: lowercase + dashes→underscores. */
export function normalizeBatchCode(code: string): string {
  return code.trim().toLowerCase().replace(/-/g, "_");
}

/**
 * True when the backend has a handler wired to this code (so a run of it can
 * succeed). False → the procedure exists but any run fails at execute.
 */
export function isExecutableBatchCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return EXECUTABLE.has(normalizeBatchCode(code));
}
