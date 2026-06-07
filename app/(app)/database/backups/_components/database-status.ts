import type {
  BackupVerificationStatus,
  DatabaseBackupStatus,
  DatabaseRestoreStatus,
} from "@/lib/api/database";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export const BACKUP_STATUS_TONE: Record<DatabaseBackupStatus, BadgeTone> = {
  pending: "neutral",
  running: "info",
  completed: "accent",
  verified: "success",
  failed: "danger",
  deleted: "neutral",
};

export const RESTORE_STATUS_TONE: Record<DatabaseRestoreStatus, BadgeTone> = {
  planned: "info",
  pending: "warning",
  running: "info",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function verificationTone(status: BackupVerificationStatus): BadgeTone {
  if (status === "passed") return "success";
  if (status === "failed") return "danger";
  return "neutral";
}

/**
 * Human-readable byte size (B / KB / MB / GB / TB) using the active locale's
 * number formatting. Returns an em dash for null/unknown sizes.
 */
export function formatBytes(
  bytes: number | null | undefined,
  intlLocale: string,
): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: value >= 100 || unit === 0 ? 0 : 1,
  }).format(value);
  return `${formatted} ${units[unit]}`;
}
