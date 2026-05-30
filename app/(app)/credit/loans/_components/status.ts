import type { LoanStatus } from "@/lib/api/loans";

/** Badge tone per loan lifecycle status. Shared by the list, fiche and stepper. */
export const LOAN_STATUS_TONE: Record<
  LoanStatus,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  application: "neutral",
  in_review: "warning",
  approved: "info",
  rejected: "danger",
  disbursed: "info",
  active: "success",
  rescheduled: "warning",
  closed: "neutral",
  written_off: "danger",
};
