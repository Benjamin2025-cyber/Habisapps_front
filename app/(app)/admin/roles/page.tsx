"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import {
  fetchRoles,
  updateRolePermissions,
  type Role,
  type RolesIndexResponse,
} from "@/lib/api/roles";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { PermissionsEditor } from "./_components/PermissionsEditor";
import { RolesList } from "./_components/RolesList";

/**
 * P27 — Paramétrage › Rôles & permissions.
 *
 * Master-detail screen: roles list on the left, permission editor on the
 * right. Edits are local until the user clicks "Enregistrer", which fires
 * `PUT /roles/{role}/permissions`. The API enforces the minimum platform-
 * admin set and the protected-permissions allowlist; we surface its 422
 * messages verbatim (localised) so the admin sees exactly what's blocked.
 */
export default function RolesPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["roles.view", "roles.manage"]);
  const canManage = useCan("roles.manage");

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<RolesIndexResponse> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchRoles(token);
    },
    [token],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [token]);

  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null);
  const [workingPermissions, setWorkingPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Auto-select the first assignable role once data lands.
  useEffect(() => {
    if (!data || selectedRoleName) return;
    const firstAssignable =
      data.roles.find((role) => role.assignable) ?? data.roles[0];
    if (firstAssignable) {
      setSelectedRoleName(firstAssignable.name);
      setWorkingPermissions(new Set(firstAssignable.permissions));
    }
  }, [data, selectedRoleName]);

  const selectedRole: Role | null = useMemo(() => {
    if (!data || !selectedRoleName) return null;
    return data.roles.find((role) => role.name === selectedRoleName) ?? null;
  }, [data, selectedRoleName]);

  const dirty = useMemo(() => {
    if (!selectedRole) return false;
    if (workingPermissions.size !== selectedRole.permissions.length) return true;
    for (const permission of selectedRole.permissions) {
      if (!workingPermissions.has(permission)) return true;
    }
    return false;
  }, [selectedRole, workingPermissions]);

  function selectRole(name: string) {
    if (!data) return;
    if (
      dirty &&
      !window.confirm(t("rolesPage.editor.confirmDiscard"))
    ) {
      return;
    }
    const role = data.roles.find((r) => r.name === name) ?? null;
    setSelectedRoleName(name);
    setWorkingPermissions(new Set(role?.permissions ?? []));
    setEditorError(null);
  }

  function togglePermission(permission: string) {
    setWorkingPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  function toggleModule(module: string, nextState: boolean) {
    if (!data) return;
    const modulePermissions = data.permissions[module] ?? [];
    setWorkingPermissions((current) => {
      const next = new Set(current);
      if (nextState) {
        for (const permission of modulePermissions) next.add(permission);
      } else {
        for (const permission of modulePermissions) next.delete(permission);
      }
      return next;
    });
  }

  function resetEditor() {
    if (!selectedRole) return;
    setWorkingPermissions(new Set(selectedRole.permissions));
    setEditorError(null);
  }

  async function saveEditor() {
    if (!token || !selectedRole) return;
    setSaving(true);
    setEditorError(null);
    try {
      await updateRolePermissions(
        token,
        selectedRole.name,
        Array.from(workingPermissions),
      );
      toast.success(
        t("rolesPage.toast.savedTitle"),
        t("rolesPage.toast.savedBody", { name: selectedRole.display_name }),
      );
      // Refetch the catalog so the role's permission count + the list reflect
      // the new state. We keep the selection on the same role.
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      setEditorError(generalMessage);
      toast.error(t("rolesPage.toast.errorTitle"), generalMessage);
    } finally {
      setSaving(false);
    }
  }

  if (session.status !== "authenticated" || !allowed) return null;

  return (
    <div
      className="flex flex-col gap-4"
      // Page fits the available viewport area: 100dvh − topbar (h-16=4rem) − main py-6 (3rem) = 7rem of chrome.
      style={{ height: "calc(100dvh - 7rem)" }}
    >
      <PageHeader
        title={t("rolesPage.pageTitle")}
        description={t("rolesPage.pageDescription")}
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("rolesPage.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <RolesList
          className="h-full"
          roles={data?.roles ?? []}
          selectedRoleName={selectedRoleName}
          onSelect={selectRole}
        />
        {selectedRole && data ? (
          <PermissionsEditor
            className="h-full"
            role={selectedRole}
            permissionCatalog={data.permissions}
            selectedPermissions={Array.from(workingPermissions)}
            onTogglePermission={togglePermission}
            onToggleModule={toggleModule}
            onSave={saveEditor}
            onReset={resetEditor}
            dirty={dirty}
            saving={saving}
            error={editorError}
            isProtectedRole={!selectedRole.assignable}
            canSave={canManage}
          />
        ) : !loading && data ? (
          <div className="flex h-full items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
            {t("rolesPage.emptySelection")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
