"use client";

import { useCallback } from "react";
import { ShieldIcon, UsersIcon } from "@/components/ui/icons";
import { countStaffUsers } from "@/lib/api/loans";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatTile } from "./DashboardStatTile";
import { DashboardActionTiles, type ActionTile } from "./DashboardActionTiles";
import { DashboardNotificationsCard } from "./DashboardTellerSections";

/**
 * User-admin dashboard (deprecated role kept for back-compat) — staff/access
 * overview. The active/suspended split needs a `/staff-users` status filter
 * (dashboard-request.md #5); shown as "—" until then.
 */
export function DashboardUserAdminLayout() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const canCreateUser = useCan("users.create");
  const canManageRoles = useCan("roles.manage");

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<number | null> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      try {
        return await countStaffUsers(token);
      } catch {
        return null;
      }
    },
    [token],
  );

  const { data, loading } = useApi(fetcher, [token]);

  if (session.status !== "authenticated") return null;

  const firstName = session.user.name.split(" ")[0];

  const actions: ActionTile[] = [
    canCreateUser && {
      key: "newUser",
      label: t("dashboard.userAdmin.actions.newUser"),
      href: "/admin/users",
      icon: UsersIcon,
      tone: "accent" as const,
    },
    canManageRoles && {
      key: "roles",
      label: t("dashboard.userAdmin.actions.roles"),
      href: "/admin/roles",
      icon: ShieldIcon,
      tone: "info" as const,
    },
    {
      key: "users",
      label: t("dashboard.userAdmin.actions.users"),
      href: "/admin/users",
      icon: UsersIcon,
      tone: "primary" as const,
    },
  ].filter(Boolean) as ActionTile[];

  return (
    <>
      <DashboardHeader
        title={t("dashboard.userAdmin.greeting", { name: firstName })}
        subtitle={t("dashboard.userAdmin.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardStatTile
              icon={UsersIcon}
              tone="accent"
              label={t("dashboard.userAdmin.kpi.users")}
              value={data ?? (loading ? "…" : "—")}
              loading={loading && data === null}
            />
            <DashboardStatTile
              icon={UsersIcon}
              tone="success"
              label={t("dashboard.userAdmin.kpi.active")}
              value="—"
              footer={
                <span className="text-xs text-muted-foreground">
                  {t("dashboard.userAdmin.soon")}
                </span>
              }
            />
            <DashboardStatTile
              icon={UsersIcon}
              tone="warning"
              label={t("dashboard.userAdmin.kpi.suspended")}
              value="—"
            />
          </div>

          <DashboardActionTiles
            title={t("dashboard.common.quickActions")}
            actions={actions}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <DashboardNotificationsCard />
        </aside>
      </div>
    </>
  );
}
