"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "@/components/ui/icons";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { StaffUser } from "@/lib/api/types";

type Props = {
  user: StaffUser;
};

export function UserMenu({ user }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const initials = computeInitials(user.name);
  const primaryRole = user.roles?.[0] ?? t("shell.userMenu.noRole");
  const agency = user.agency_name ?? t("shell.userMenu.agencyFallback");

  async function handleSignOut() {
    setOpen(false);
    await session.signOut();
    router.replace("/login");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("shell.userMenu.open")}
        className={cn(
          "flex h-10 items-center gap-2 rounded-[var(--radius-field)] pl-1 pr-2 text-sm",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground">
          {initials}
        </span>
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className="text-sm font-semibold text-foreground">{user.name}</span>
          <span className="text-[11px] text-muted-foreground">{primaryRole}</span>
        </span>
        <ChevronDownIcon className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-[var(--radius-field)] border border-border bg-background shadow-[0_24px_60px_-30px_rgba(20,6,47,0.25)]"
        >
          <div className="border-b border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.phone_number}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                {primaryRole}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {agency}
              </span>
            </div>
          </div>

          <div className="flex flex-col py-1">
            <MenuItem icon={<UserIcon className="h-4 w-4" />} disabled>
              {t("shell.userMenu.viewProfile")}
            </MenuItem>
            <MenuItem icon={<UserIcon className="h-4 w-4" />} disabled>
              {t("shell.userMenu.preferences")}
            </MenuItem>
          </div>

          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              <LogOutIcon className="h-4 w-4" />
              <span>{t("shell.userMenu.signOut")}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-left text-sm",
        disabled
          ? "cursor-not-allowed text-muted-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}

function computeInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}
