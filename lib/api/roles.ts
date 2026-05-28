import { apiRequest } from "./client";

export type Role = {
  name: string;
  display_name: string;
  description: string;
  assignable: boolean;
  permissions: string[];
};

export type RolesIndexResponse = {
  roles: Role[];
  permissions: Record<string, string[]>;
};

/**
 * Returns the canonical role catalog from `config/security.php` (server-side)
 * plus the permission catalog grouped by module.
 *
 * `platform-admin` is included but `assignable === false`, so the FE picker
 * should hide / disable it for non-platform-admin actors.
 */
export async function fetchRoles(token: string): Promise<RolesIndexResponse> {
  const raw = await apiRequest<RolesIndexResponse | Role[]>("roles", {
    method: "GET",
    token,
  });
  if (Array.isArray(raw)) {
    return { roles: raw, permissions: {} };
  }
  return {
    roles: raw?.roles ?? [],
    permissions: raw?.permissions ?? {},
  };
}

export type UpdateRolePermissionsResponse = {
  role: {
    name: string;
    guard_name: string;
    permissions: string[];
  };
};

/**
 * Replaces (not merges) the permission set for a role. The API enforces
 *   - at least one permission
 *   - "protected" permissions can only be granted to `platform-admin`
 *   - `platform-admin` must keep a minimum administration set
 * so callers should handle 422 responses gracefully.
 */
export async function updateRolePermissions(
  token: string,
  roleName: string,
  permissions: string[],
): Promise<UpdateRolePermissionsResponse> {
  return apiRequest<UpdateRolePermissionsResponse>(
    `roles/${roleName}/permissions`,
    {
      method: "PUT",
      token,
      body: { permissions },
    },
  );
}
