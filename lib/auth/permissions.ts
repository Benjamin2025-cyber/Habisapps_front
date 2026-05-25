"use client";

import { useSession } from "./SessionProvider";

/**
 * Returns true iff the current authenticated user holds the given permission
 * (union of role-granted + direct grants). When not authenticated, always false.
 *
 * Use this for fine-grained gating: buttons, conditional sections, inline UI.
 * For coarse decisions (which dashboard preset to render, which sidebar group
 * to show), prefer `useHasRole` or read `session.user.roles` directly.
 *
 * Defensive: tolerates legacy sessions stored before the API started shipping
 * the `permissions` field. SessionProvider will auto-refresh them via `/me`.
 */
export function useCan(permission: string): boolean {
  const session = useSession();
  if (session.status !== "authenticated") return false;
  return (session.user.permissions ?? []).includes(permission);
}

/**
 * Variant that checks whether the user holds ANY of the listed permissions.
 * Useful when several distinct permissions unlock the same UI element.
 */
export function useCanAny(permissions: ReadonlyArray<string>): boolean {
  const session = useSession();
  if (session.status !== "authenticated") return false;
  const owned = session.user.permissions ?? [];
  return permissions.some((permission) => owned.includes(permission));
}

/**
 * Whether the current user has any of the given roles. Coarse-grained — use
 * for dashboard preset selection and sidebar group visibility, not for
 * individual buttons.
 */
export function useHasRole(roles: ReadonlyArray<string>): boolean {
  const session = useSession();
  if (session.status !== "authenticated") return false;
  const owned = session.user.roles ?? [];
  return roles.some((role) => owned.includes(role));
}
