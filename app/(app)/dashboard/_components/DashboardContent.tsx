"use client";

import { useMemo } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { DashboardManagementLayout } from "./DashboardManagementLayout";
import { DashboardMinimalLayout } from "./DashboardMinimalLayout";
import { DashboardTellerLayout } from "./DashboardTellerLayout";
import { DashboardOfficerLayout } from "./DashboardOfficerLayout";
import { DashboardAccountantLayout } from "./DashboardAccountantLayout";
import { DashboardKycLayout } from "./DashboardKycLayout";
import { DashboardRegionalLayout } from "./DashboardRegionalLayout";
import { DashboardComplianceLayout } from "./DashboardComplianceLayout";
import { DashboardAuditorLayout } from "./DashboardAuditorLayout";
import { DashboardUserAdminLayout } from "./DashboardUserAdminLayout";
import { resolveDashboardPreset } from "./preset";

/**
 * Top-level dashboard router. Picks one role-tailored layout based on the user's
 * roles (see `./preset.ts`). The (app)/layout has already gated for an
 * authenticated session before we get here.
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

  switch (preset) {
    case "management":
      return <DashboardManagementLayout />;
    case "teller":
      return <DashboardTellerLayout />;
    case "officer":
      return <DashboardOfficerLayout />;
    case "accountant":
      return <DashboardAccountantLayout />;
    case "kyc":
      return <DashboardKycLayout />;
    case "regional":
      return <DashboardRegionalLayout />;
    case "compliance":
      return <DashboardComplianceLayout />;
    case "auditor":
      return <DashboardAuditorLayout />;
    case "userAdmin":
      return <DashboardUserAdminLayout />;
    default:
      return <DashboardMinimalLayout />;
  }
}
