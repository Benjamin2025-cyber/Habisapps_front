/**
 * Status → tone maps shared by the role dashboards. `StatusTone` is exactly the
 * Badge tone union (a subset of the chart `Tone`), so the same value works for
 * both `<Badge tone>` and the chart `toneColorVar()`.
 */
export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

export const LOAN_STATUS_TONE: Record<string, StatusTone> = {
  application: "neutral",
  in_review: "info",
  approved: "accent",
  rejected: "danger",
  disbursed: "info",
  active: "success",
  rescheduled: "warning",
  closed: "neutral",
  written_off: "danger",
};

export const KYC_STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  pending_review: "warning",
  verified: "success",
  rejected: "danger",
  suspended: "warning",
  archived: "neutral",
};

export const JOURNAL_STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  posted: "success",
  rejected: "danger",
  cancelled: "neutral",
  archived: "neutral",
  reversed: "warning",
};

export function loanStatusTone(status: string): StatusTone {
  return LOAN_STATUS_TONE[status] ?? "neutral";
}

export function kycStatusTone(status: string): StatusTone {
  return KYC_STATUS_TONE[status] ?? "neutral";
}

export function journalStatusTone(status: string): StatusTone {
  return JOURNAL_STATUS_TONE[status] ?? "neutral";
}
