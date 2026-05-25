"use client";

import { CheckCircleIcon } from "@/components/ui/icons";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * Static placeholder until the journée comptable endpoint is wired up. Shows
 * an "open" chip with today's date. Will be replaced by a hook reading from
 * `/api/v1/...` once the endpoint exists (see BUILDABLE_PAGES.md).
 */
export function AccountingDayChip() {
  const t = useTranslations();
  const format = useFormatter();
  const today = new Date();

  return (
    <span className="hidden items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success md:inline-flex">
      <CheckCircleIcon className="h-3.5 w-3.5" />
      <span>{t("shell.topBar.accountingDay.open")}</span>
      <span aria-hidden className="h-3 w-px bg-success/30" />
      <span className="tabular-nums text-success/80">{format.date(today)}</span>
    </span>
  );
}
