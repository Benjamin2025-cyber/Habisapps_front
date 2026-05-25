"use client";

import { useMemo } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { DashboardFieldLayout } from "./DashboardFieldLayout";
import { DashboardManagementLayout } from "./DashboardManagementLayout";
import { DashboardMinimalLayout } from "./DashboardMinimalLayout";
import { resolveDashboardPreset } from "./preset";

/**
 * Top-level dashboard router. Picks one of three layouts based on the user's
 * roles (see `./preset.ts` for the role → preset map). The (app)/layout has
 * already gated for an authenticated session before we get here.
 */
export function DashboardContent() {
  const session = useSession();
  const preset = useMemo(
    () =>
      session.status === "authenticated"
        ? resolveDashboardPreset(session.user)
        : "minimal",
    [session],
  );

  if (session.status !== "authenticated") return null;

  if (preset === "management") return <DashboardManagementLayout />;
  if (preset === "field") return <DashboardFieldLayout />;
  return <DashboardMinimalLayout />;
}
