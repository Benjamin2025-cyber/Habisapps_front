"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/auth/permissions";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Tone = "accent" | "info" | "primary" | "success";

const toneStyles: Record<Tone, string> = {
  accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  info: "bg-info text-info-foreground hover:bg-info/90",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  success: "bg-success/90 text-success-foreground hover:bg-success",
};

/**
 * 4 contextual quick-action CTAs, gated by individual permissions.
 * Each button only renders if the user holds the matching permission.
 * Buttons are wrapped in `<Link>` so they navigate; for now the destinations
 * are the existing list/creation pages even when those are stubs (the user
 * will not reach a 404 — the shell layout catches missing routes).
 */
export function DashboardQuickActions() {
  const t = useTranslations();
  const canDeposit = useCan("cash.transactions.manage");
  const canCreateLoan = useCan("loans.create");
  const canCreateClient = useCan("crm.clients.create");
  const canCreateUser = useCan("users.create");

  // Hide the whole row if the user can't do anything (no quick actions for them).
  if (!canDeposit && !canCreateLoan && !canCreateClient && !canCreateUser) {
    return null;
  }

  return (
    <section className="flex flex-wrap items-center gap-3">
      {canDeposit ? (
        <QuickActionLink href="/operations/transactions" tone="accent" icon={<PlusIcon />}>
          {t("dashboard.quickActions.deposit")}
        </QuickActionLink>
      ) : null}

      {canCreateLoan ? (
        <QuickActionLink href="/credit/loans" tone="info" icon={<PlusIcon />}>
          {t("dashboard.quickActions.loan")}
        </QuickActionLink>
      ) : null}

      {canCreateClient ? (
        <QuickActionLink href="/clients" tone="primary" icon={<PlusIcon />}>
          {t("dashboard.quickActions.client")}
        </QuickActionLink>
      ) : null}

      {canCreateUser ? (
        <QuickActionLink href="/admin/users" tone="success" icon={<PlusIcon />}>
          {t("dashboard.quickActions.user")}
        </QuickActionLink>
      ) : null}
    </section>
  );
}

function QuickActionLink({
  href,
  tone,
  icon,
  children,
}: {
  href: string;
  tone: Tone;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-[var(--radius-field)] px-4 text-sm font-semibold",
        "shadow-[0_8px_24px_-18px_rgba(20,6,47,0.4)] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        toneStyles[tone],
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
