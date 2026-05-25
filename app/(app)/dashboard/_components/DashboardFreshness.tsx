"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  /** ISO 8601 timestamp from the API payload. */
  iso: string | null;
  refreshing?: boolean;
  onRefresh: () => void;
};

export function DashboardFreshness({ iso, refreshing, onRefresh }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const [, forceRender] = useState(0);

  // Re-render every 30 seconds so the "il y a X minutes" label stays current.
  useEffect(() => {
    const handle = window.setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  if (!iso) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>
        {t("dashboard.freshness.label", { relative: format.relative(iso) })}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className={cn(
          "inline-flex items-center gap-1 rounded-[var(--radius-field)] px-2 py-1 text-xs font-semibold text-accent",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <RefreshIcon
          className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
        />
        <span>
          {refreshing
            ? t("dashboard.freshness.refreshing")
            : t("dashboard.freshness.refresh")}
        </span>
      </button>
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
