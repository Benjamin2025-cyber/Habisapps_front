"use client";

import { useEffect, useState } from "react";
import { BellIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import type { StaffUser } from "@/lib/api/types";
import { AccountingDayChip } from "./AccountingDayChip";
import { UserMenu } from "./UserMenu";

type Props = {
  user: StaffUser;
  onToggleSidebar: () => void;
};

export function TopBar({ user, onToggleSidebar }: Props) {
  const t = useTranslations();
  const toast = useToast();
  const [shortcut, setShortcut] = useState<string>("⌘K");

  // Show "Ctrl+K" on non-Mac platforms.
  useEffect(() => {
    if (typeof navigator !== "undefined" && !/Mac|iPhone|iPad/.test(navigator.platform)) {
      setShortcut("Ctrl+K");
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={t("shell.topBar.toggleSidebar")}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-[var(--radius-field)] text-muted-foreground",
          "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() =>
          toast.info(
            t("shell.topBar.search.placeholder"),
            t("shell.topBar.search.comingSoon"),
          )
        }
        className={cn(
          "group hidden h-10 flex-1 max-w-md items-center gap-3 rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 text-left text-sm text-muted-foreground",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex",
        )}
      >
        <SearchIcon className="h-4 w-4" />
        <span className="flex-1 truncate">{t("shell.topBar.search.placeholder")}</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground sm:inline-block">
          {shortcut}
        </kbd>
      </button>

      <div className="flex-1 sm:hidden" />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <AccountingDayChip />

        <button
          type="button"
          onClick={() =>
            toast.info(
              t("shell.topBar.notifications.label"),
              t("shell.topBar.notifications.empty"),
            )
          }
          aria-label={t("shell.topBar.notifications.label")}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-field)] text-muted-foreground",
            "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <BellIcon className="h-5 w-5" />
        </button>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
