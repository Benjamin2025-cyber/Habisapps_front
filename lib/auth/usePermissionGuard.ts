"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCanAny } from "./permissions";
import { useSession } from "./SessionProvider";

/**
 * Page-level permission guard. If the authenticated user lacks every listed
 * permission, redirects them to `/dashboard` instead of letting them sit on a
 * page that will only render 403s from the API.
 *
 * Returns `true` when the user is allowed (so the caller can decide whether
 * to render the page body). While the session is still hydrating, returns
 * `false` — pair with the layout's `ShellLoader` to avoid a flash.
 *
 * Usage:
 *   export default function UsersPage() {
 *     const allowed = usePermissionGuard(["users.view"]);
 *     if (!allowed) return null;
 *     // ...
 *   }
 */
export function usePermissionGuard(
  requiredPermissions: ReadonlyArray<string>,
): boolean {
  const router = useRouter();
  const session = useSession();
  const allowed = useCanAny(requiredPermissions);

  useEffect(() => {
    if (session.status === "authenticated" && !allowed) {
      router.replace("/dashboard");
    }
  }, [session.status, allowed, router]);

  return session.status === "authenticated" && allowed;
}
