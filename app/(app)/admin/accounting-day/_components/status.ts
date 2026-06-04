import type { AccountingDayStatus } from "@/lib/api/accounting-days";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

/**
 * Maps an accounting-day status to a Badge tone. `open`/`reopened` are the
 * registrable states (green); `closing` is in-progress (amber); `closed` is the
 * normal end state (neutral); `cancelled` is terminal/abnormal (red).
 */
export const ACCOUNTING_DAY_STATUS_TONES: Record<AccountingDayStatus, BadgeTone> = {
  planned: "info",
  open: "success",
  reopened: "success",
  closing: "warning",
  closed: "neutral",
  cancelled: "danger",
};

/** i18n key for a status label under `accountingDay.status.*`. */
export function accountingDayStatusKey(status: AccountingDayStatus): string {
  return `accountingDay.status.${status}`;
}
