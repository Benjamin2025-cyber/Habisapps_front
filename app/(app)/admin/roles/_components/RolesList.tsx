"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Role } from "@/lib/api/roles";

type Props = {
  roles: ReadonlyArray<Role>;
  selectedRoleName: string | null;
  onSelect: (roleName: string) => void;
  className?: string;
};

export function RolesList({
  roles,
  selectedRoleName,
  onSelect,
  className,
}: Props) {
  const t = useTranslations();
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border border-l-4 border-l-accent bg-accent/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("rolesPage.list.title")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("rolesPage.list.count", { count: roles.length })}
        </span>
      </header>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {roles.map((role) => {
          const selected = role.name === selectedRoleName;
          return (
            <li key={role.name}>
              <button
                type="button"
                onClick={() => onSelect(role.name)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0",
                  selected
                    ? "bg-accent/10"
                    : "hover:bg-muted/30",
                )}
                aria-current={selected ? "true" : undefined}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {role.display_name}
                  </span>
                  {!role.assignable ? (
                    <Badge tone="warning">
                      {t("rolesPage.list.protectedBadge")}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {t("rolesPage.list.permissionsCount", {
                    count: role.permissions.length,
                  })}
                </span>
                {role.description ? (
                  <p className="text-xs text-muted-foreground">
                    {role.description}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
