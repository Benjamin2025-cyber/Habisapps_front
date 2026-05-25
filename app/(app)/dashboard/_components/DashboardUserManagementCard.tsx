"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useCan } from "@/lib/auth/permissions";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  totalUsers: number | null;
  loading?: boolean;
};

/**
 * Compact panel that mirrors the PDF "Gestion des utilisateurs" widget.
 *
 * Today we can only display the total user count. Active/suspended splits
 * require the `staff-users` index to accept a status filter (see
 * BUILDABLE_PAGES.md "Modules avec maquette mais sans endpoint dédié").
 * The placeholder under the counters notes that limitation.
 */
export function DashboardUserManagementCard({ totalUsers, loading }: Props) {
  const t = useTranslations();
  const canAddUser = useCan("users.create");
  const canManageRoles = useCan("roles.manage");

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          {t("dashboard.userManagement.title")}
        </h2>
      </header>

      <ul className="flex flex-col gap-3">
        <CounterRow
          label={t("dashboard.userManagement.registered")}
          count={totalUsers}
          dotColor="var(--color-success)"
          loading={loading}
        />
        <CounterRow
          label={t("dashboard.userManagement.active")}
          count={null}
          dotColor="var(--color-success)"
          loading={loading}
        />
        <CounterRow
          label={t("dashboard.userManagement.suspended")}
          count={null}
          dotColor="var(--color-danger)"
          loading={loading}
        />
      </ul>

      <p className="text-[11px] text-muted-foreground">
        {t("dashboard.userManagement.countsUnavailable")}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {canAddUser ? (
          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-field)] bg-success/90 px-3 text-xs font-semibold text-success-foreground hover:bg-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <PlusIcon /> {t("dashboard.userManagement.addUser")}
          </Link>
        ) : null}
        {canManageRoles ? (
          <Button variant="outline" size="sm">
            <PlusIcon /> {t("dashboard.userManagement.createRole")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function CounterRow({
  label,
  count,
  dotColor,
  loading,
}: {
  label: string;
  count: number | null;
  dotColor: string;
  loading?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm text-foreground">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        {label}
      </span>
      <span className="font-bold tabular-nums">
        {loading || count === null ? "—" : count.toString().padStart(2, "0")}
      </span>
    </li>
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
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
