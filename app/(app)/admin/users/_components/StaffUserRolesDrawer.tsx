"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/cn";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Role } from "@/lib/api/roles";
import type { StaffUser } from "@/lib/api/staff-users";

type Props = {
  open: boolean;
  user: StaffUser | null;
  roles: ReadonlyArray<Role>;
  onClose: () => void;
  onSubmit: (roles: string[]) => Promise<void>;
};

/**
 * Multi-select role picker. Only roles flagged `assignable: true` in the
 * catalog are pickable (excludes `platform-admin`). Reflects the current
 * `user.roles` selection on open.
 */
export function StaffUserRolesDrawer({
  open,
  user,
  roles,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(user?.roles ?? []));
    setError(null);
  }, [open, user]);

  function toggle(roleName: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(roleName)) next.delete(roleName);
      else next.add(roleName);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selected.size === 0) {
      setError(t("staffUsers.rolesDrawer.atLeastOne"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(Array.from(selected));
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        roles: t("staffUsers.rolesDrawer.fieldLabel"),
      });
      setError(fieldErrors.roles ?? generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const assignableRoles = roles.filter((role) => role.assignable);

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={t("staffUsers.rolesDrawer.title")}
      description={
        user
          ? t("staffUsers.rolesDrawer.subtitle", { name: user.name })
          : undefined
      }
      widthClassName="sm:w-[34rem]"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="staff-user-roles-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("common.save")}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {user && user.roles.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="font-semibold text-muted-foreground">
            {t("staffUsers.rolesDrawer.currentLabel")}
          </span>
          {user.roles.map((roleName) => (
            <Badge key={roleName} tone="accent">
              {roles.find((r) => r.name === roleName)?.display_name ?? roleName}
            </Badge>
          ))}
        </div>
      ) : null}

      <form
        id="staff-user-roles-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-2"
        noValidate
      >
        {assignableRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("staffUsers.rolesDrawer.empty")}
          </p>
        ) : (
          assignableRoles.map((role) => {
            const checked = selected.has(role.name);
            return (
              <label
                key={role.name}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border border-border bg-background px-3 py-3 transition-colors",
                  checked
                    ? "border-accent/40 bg-accent/5"
                    : "hover:bg-muted/30",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 cursor-pointer accent-accent"
                  checked={checked}
                  onChange={() => toggle(role.name)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {role.display_name}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {t("staffUsers.rolesDrawer.permissionsCount", {
                        count: role.permissions.length,
                      })}
                    </span>
                  </div>
                  {role.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  ) : null}
                </div>
              </label>
            );
          })
        )}
      </form>
    </Drawer>
  );
}
