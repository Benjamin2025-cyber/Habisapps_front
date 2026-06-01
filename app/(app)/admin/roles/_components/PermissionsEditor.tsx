"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Role } from "@/lib/api/roles";

type Props = {
  role: Role;
  permissionCatalog: Record<string, string[]>;
  selectedPermissions: ReadonlyArray<string>;
  /** Returns true when a permission can't be granted to this role (disabled). */
  isPermissionLocked?: (permission: string) => boolean;
  onTogglePermission: (permission: string) => void;
  onToggleModule: (module: string, next: boolean) => void;
  onSave: () => void;
  onReset: () => void;
  dirty: boolean;
  saving: boolean;
  error?: string | null;
  isProtectedRole?: boolean;
  /** When false, all edit controls (checkboxes + save) become read-only / hidden. */
  canSave?: boolean;
  className?: string;
};

/**
 * Permission editor for a single role.
 *
 * Layout:
 *   - sticky header with role name + save / reset
 *   - search filter that hides modules with zero matches
 *   - module sections (collapsible) listing every permission as a checkbox
 *
 * Validation hints (label/text only — the API enforces them):
 *   - at least one permission must remain
 *   - the `platform-admin` role can't have its minimum admin set removed
 *   - protected permissions only apply to `platform-admin`
 */
export function PermissionsEditor({
  role,
  permissionCatalog,
  selectedPermissions,
  isPermissionLocked,
  onTogglePermission,
  onToggleModule,
  onSave,
  onReset,
  dirty,
  saving,
  error,
  isProtectedRole,
  canSave = true,
  className,
}: Props) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(
    () => new Set(selectedPermissions),
    [selectedPermissions],
  );

  const needle = search.trim().toLowerCase();

  const moduleEntries = useMemo(() => {
    return Object.entries(permissionCatalog)
      .map(([module, permissions]) => {
        const filtered = needle.length
          ? permissions.filter((p) => p.toLowerCase().includes(needle))
          : permissions;
        const activeCount = filtered.filter((p) => selectedSet.has(p)).length;
        return {
          module,
          permissions: filtered,
          totalCount: filtered.length,
          activeCount,
        };
      })
      .filter((entry) => entry.totalCount > 0)
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [permissionCatalog, needle, selectedSet]);

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background",
        className,
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border border-l-4 border-l-accent bg-accent/5 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            {t("rolesPage.editor.title", { name: role.display_name })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("rolesPage.editor.count", {
              active: selectedPermissions.length,
              total: Object.values(permissionCatalog).reduce(
                (acc, list) => acc + list.length,
                0,
              ),
            })}
          </p>
        </div>
        {canSave ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onReset}
              disabled={!dirty || saving}
            >
              {t("rolesPage.editor.reset")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
            >
              {saving ? t("common.loading") : t("rolesPage.editor.save")}
            </Button>
          </div>
        ) : null}
      </header>

      {error || isProtectedRole ? (
        <div className="shrink-0 px-4 pt-3">
          {error ? (
            <Alert variant="danger" title={t("rolesPage.editor.errorTitle")}>
              {error}
            </Alert>
          ) : null}

          {isProtectedRole ? (
            <Alert
              variant="warning"
              title={t("rolesPage.editor.protectedRoleTitle")}
            >
              {t("rolesPage.editor.protectedRoleBody")}
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="shrink-0 px-4 pt-3">
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("rolesPage.editor.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {moduleEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("rolesPage.editor.empty")}
          </p>
        ) : (
          moduleEntries.map(({ module, permissions, activeCount, totalCount }) => {
            const isCollapsed = collapsed.has(module);
            const allChecked = activeCount === totalCount;
            return (
              <article
                key={module}
                className="overflow-hidden rounded-[var(--radius-field)] border border-border"
              >
                <header className="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(module)) next.delete(module);
                        else next.add(module);
                        return next;
                      });
                    }}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 transition-transform",
                        isCollapsed ? "-rotate-90" : "",
                      )}
                    >
                      <Chevron />
                    </span>
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {moduleLabel(module)}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {activeCount}/{totalCount}
                    </span>
                  </button>
                  {canSave ? (
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-accent"
                        checked={allChecked}
                        onChange={(event) =>
                          onToggleModule(module, event.target.checked)
                        }
                      />
                      {t("rolesPage.editor.toggleAll")}
                    </label>
                  ) : null}
                </header>

                {!isCollapsed ? (
                  <ul className="divide-y divide-border">
                    {permissions.map((permission) => {
                      const checked = selectedSet.has(permission);
                      const locked = isPermissionLocked?.(permission) ?? false;
                      const disabled = !canSave || locked;
                      return (
                        <li key={permission}>
                          <label
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                              !disabled && "cursor-pointer",
                              checked
                                ? "bg-accent/5"
                                : !disabled && "hover:bg-muted/30",
                              locked && "opacity-60",
                            )}
                            title={
                              locked
                                ? t("rolesPage.editor.protectedLockHint")
                                : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-accent"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => onTogglePermission(permission)}
                            />
                            <span className="font-mono text-xs text-foreground">
                              {permission}
                            </span>
                            {locked ? (
                              <span className="ml-auto rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {t("rolesPage.editor.protectedTag")}
                              </span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 text-muted-foreground"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function moduleLabel(module: string): string {
  // We could ship per-module i18n, but for an admin-only screen showing raw
  // permissions, a humanised version of the module key is enough.
  return module.replace(/-/g, " ").replace(/_/g, " ");
}
