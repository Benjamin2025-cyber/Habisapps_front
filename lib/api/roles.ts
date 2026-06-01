import { apiRequest } from "./client";

export type Role = {
  name: string;
  display_name: string;
  description: string;
  assignable: boolean;
  permissions: string[];
  /**
   * SHA1 fingerprint of the persisted permission set (optimistic concurrency).
   * Send it back on update so a stale editor can't clobber a newer grant — the
   * API returns 409 on mismatch. Absent on older payloads.
   */
  permissions_version?: string;
};

/**
 * Permission-policy metadata (back-issues #5/#21). Lets the editor disable
 * checkboxes the API would reject instead of only surfacing the 422 after save.
 * - `protected`: can only be granted to platform-admin (unless delegated).
 * - `non_delegable`: can NEVER be granted to a non-platform role.
 * - `delegable`: protected, but grantable to non-platform roles when
 *   `delegation_enabled` is true.
 */
export type PermissionPolicy = {
  protected: string[];
  non_delegable: string[];
  delegable: string[];
  delegation_enabled: boolean;
};

export type RolesIndexResponse = {
  roles: Role[];
  permissions: Record<string, string[]>;
  permissionPolicy: PermissionPolicy;
};

const EMPTY_POLICY: PermissionPolicy = {
  protected: [],
  non_delegable: [],
  delegable: [],
  delegation_enabled: false,
};

/**
 * Returns the role catalog with each role's PERSISTED (DB) permissions plus
 * their `permissions_version`, the grouped permission catalog, and the
 * permission-policy metadata.
 *
 * `platform-admin` is included but `assignable === false`, so the FE picker
 * should hide / disable it for non-platform-admin actors.
 */
export async function fetchRoles(token: string): Promise<RolesIndexResponse> {
  const raw = await apiRequest<
    | {
        roles?: Role[];
        permissions?: Record<string, string[]>;
        permission_policy?: PermissionPolicy;
      }
    | Role[]
  >("roles", { method: "GET", token });

  if (Array.isArray(raw)) {
    return { roles: raw, permissions: {}, permissionPolicy: EMPTY_POLICY };
  }
  return {
    roles: raw?.roles ?? [],
    permissions: raw?.permissions ?? {},
    permissionPolicy: raw?.permission_policy ?? EMPTY_POLICY,
  };
}

export type UpdateRolePermissionsResponse = {
  role: {
    name: string;
    guard_name: string;
    permissions: string[];
    permissions_version: string;
    previous_permissions: string[];
    added_permissions: string[];
    removed_permissions: string[];
  };
};

/**
 * Replaces (not merges) the permission set for a role. The API now REQUIRES an
 * explicit `replace: true` flag and accepts an `expected_permissions_version`
 * for optimistic concurrency (409 on mismatch). It enforces:
 *   - at least one permission
 *   - protected permissions only on platform-admin (unless delegation enabled)
 *   - platform-admin keeps its minimum administration set
 * so callers should handle 422 / 409 responses gracefully.
 */
export async function updateRolePermissions(
  token: string,
  roleName: string,
  permissions: string[],
  expectedVersion?: string | null,
): Promise<UpdateRolePermissionsResponse> {
  return apiRequest<UpdateRolePermissionsResponse>(
    `roles/${roleName}/permissions`,
    {
      method: "PUT",
      token,
      body: {
        replace: true,
        permissions,
        ...(expectedVersion
          ? { expected_permissions_version: expectedVersion }
          : {}),
      },
    },
  );
}

/** Grant a single permission (additive toggle — does not touch other perms). */
export async function grantRolePermission(
  token: string,
  roleName: string,
  permission: string,
): Promise<UpdateRolePermissionsResponse> {
  return apiRequest<UpdateRolePermissionsResponse>(
    `roles/${roleName}/permissions/${permission}`,
    { method: "POST", token },
  );
}

/** Revoke a single permission (does not touch other perms). */
export async function revokeRolePermission(
  token: string,
  roleName: string,
  permission: string,
): Promise<UpdateRolePermissionsResponse> {
  return apiRequest<UpdateRolePermissionsResponse>(
    `roles/${roleName}/permissions/${permission}`,
    { method: "DELETE", token },
  );
}
