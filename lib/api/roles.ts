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
