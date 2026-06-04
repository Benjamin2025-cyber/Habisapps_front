"use client";

import { useCallback } from "react";
import Link from "next/link";
import { CalendarIcon, CheckCircleIcon, LockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  fetchCurrentAccountingDay,
  type AccountingDay,
  type AccountingDayStatus,
} from "@/lib/api/accounting-days";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type ChipTone = "success" | "warning" | "neutral";

const STATUS_TONES: Record<AccountingDayStatus, ChipTone> = {
  open: "success",
  reopened: "success",
  closing: "warning",
  closed: "warning",
  planned: "neutral",
  cancelled: "neutral",
};

const TONE_STYLES: Record<ChipTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * Live journée-comptable indicator in the top bar. Reads the current accounting
 * day for the user's scope and reflects its status; links to the management
 * screen. Hidden for users without `accounting.days.view` (or on a fetch error,
 * e.g. a scope that can't be resolved) so it never shows a misleading state.
 */
export function AccountingDayChip() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canViewPerm = useCanAny(["accounting.days.view"]);
  const canView = isPlatformAdmin || canViewPerm;

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AccountingDay | null> => {
      void signal;
      if (!token || !canView) return null;
      // Platform admins have no single agency scope; show the institution day.
      return isPlatformAdmin
        ? fetchCurrentAccountingDay(token, { scope: "institution" })
        : fetchCurrentAccountingDay(token);
    },
    [token, canView, isPlatformAdmin],
  );

  const { data: day, loading, error } = useApi(fetcher, [
    token,
    canView,
    isPlatformAdmin,
  ]);

  if (!canView || error) return null;

  if (loading && !day) {
    return (
      <span className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground md:inline-flex">
        <CalendarIcon className="h-3.5 w-3.5" />
        <span>{t("shell.topBar.accountingDay.loading")}</span>
      </span>
    );
  }

  const tone: ChipTone = day ? STATUS_TONES[day.status] : "warning";
  const label = day
    ? t(`shell.topBar.accountingDay.${day.status}`)
    : t("shell.topBar.accountingDay.none");
  const Icon = tone === "success" ? CheckCircleIcon : LockIcon;

  return (
    <Link
      href="/admin/accounting-day"
      aria-label={t("shell.topBar.accountingDay.ariaLabel")}
      className={cn(
        "hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors md:inline-flex",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        TONE_STYLES[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {day?.business_date ? (
        <>
          <span aria-hidden className="h-3 w-px bg-current opacity-30" />
          <span className="tabular-nums opacity-80">
            {format.date(day.business_date)}
          </span>
        </>
      ) : null}
    </Link>
  );
}
