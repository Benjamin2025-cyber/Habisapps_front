"use client";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import type { DatabaseStorage } from "@/lib/api/database";
import { useFormatter, useLocale, useTranslations } from "@/lib/i18n/I18nProvider";
import { formatBytes } from "./database-status";

type Props = {
  storage: DatabaseStorage | null;
  loading: boolean;
};

/**
 * Compact health strip for the database-management page: disk reachability,
 * free space, backup footprint, last successful backup, and the retention
 * policy. Surfaces a banner when an active maintenance lock is held.
 */
export function StorageHealthCard({ storage, loading }: Props) {
  const t = useTranslations("database.storage");
  const format = useFormatter();
  const { intlLocale } = useLocale();

  if (loading && !storage) {
    return (
      <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
        <span className="block h-4 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="block h-10 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </section>
    );
  }

  if (!storage) return null;

  const lock = storage.maintenance_lock;

  const stats: Array<{ label: string; value: string }> = [
    { label: t("freeSpace"), value: formatBytes(storage.free_bytes, intlLocale) },
    {
      label: t("backupCount"),
      value: format.number(storage.backup_count),
    },
    { label: t("totalSize"), value: formatBytes(storage.total_bytes, intlLocale) },
    {
      label: t("lastBackup"),
      value: storage.last_successful_backup
        ? format.dateTime(storage.last_successful_backup.created_at)
        : t("never"),
    },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <Badge tone={storage.enabled ? "success" : "neutral"}>
            {storage.enabled ? t("enabled") : t("disabled")}
          </Badge>
          <Badge tone={storage.reachable ? "success" : "danger"}>
            {storage.reachable ? t("reachable") : t("unreachable")}
          </Badge>
          <Badge tone="neutral">
            {t("disk", { disk: storage.disk })}
          </Badge>
        </div>
      </header>

      {!storage.is_private ? (
        <Alert variant="warning">{t("notPrivateWarning")}</Alert>
      ) : null}

      {lock?.active ? (
        <Alert variant="info" title={t("maintenanceLockTitle")}>
          {t("maintenanceLockBody", {
            reason: lock.reason ?? t("noReason"),
            expires: lock.expires_at
              ? format.dateTime(lock.expires_at)
              : t("noExpiry"),
          })}
        </Alert>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="text-sm font-semibold text-foreground tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted-foreground">
        {t("retentionSummary", {
          days: storage.retention_policy.max_age_days,
          count: storage.retention_policy.max_count,
          protect: storage.retention_policy.min_protected,
        })}
      </p>
    </section>
  );
}
