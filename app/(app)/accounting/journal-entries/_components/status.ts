import type { JournalEntryStatus } from "@/lib/api/journal-entries";

/** Badge tone per journal-entry status. */
export const JOURNAL_STATUS_TONE: Record<
  JournalEntryStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  draft: "neutral",
  submitted: "info",
  approved: "warning",
  posted: "success",
  rejected: "danger",
  cancelled: "neutral",
  archived: "neutral",
  reversed: "danger",
};

/** Statuses surfaced in the worklist filter, in lifecycle order. */
export const JOURNAL_FILTER_STATUSES: JournalEntryStatus[] = [
  "draft",
  "submitted",
  "approved",
  "posted",
  "rejected",
  "reversed",
];
