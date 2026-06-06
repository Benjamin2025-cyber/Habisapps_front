import type { StaffUser } from "@/lib/api/types";

/**
 * Dashboard rendering preset, picked once per session from the user's roles.
 * Every role gets a purpose-built, data-rich layout scoped to what it may see;
 * `minimal` is the fallback for the bare `staff` role with no business authority.
 *
 * Resolution is priority-ordered (see `PRESET_BY_ROLE`): a user holding several
 * roles lands on the highest-authority dashboard they qualify for.
 */
export type DashboardPreset =
  | "management"
  | "teller"
  | "officer"
  | "accountant"
  | "kyc"
  | "regional"
  | "compliance"
  | "auditor"
  | "userAdmin"
  | "minimal";

/**
 * Role → preset, in descending precedence. `platform-admin` / `agency-manager`
 * keep the operational management dashboard (they pass `/dashboards/operational`);
 * every other role has a dedicated layout built from the data its permissions
 * unlock (the field roles 403 on the operational endpoint).
 */
const PRESET_BY_ROLE: ReadonlyArray<readonly [string, DashboardPreset]> = [
  ["platform-admin", "management"],
  ["agency-manager", "management"],
  ["compliance-officer", "compliance"],
  ["auditor", "auditor"],
  ["regional-manager", "regional"],
  ["accountant", "accountant"],
  ["loan-officer", "officer"],
  ["kyc-officer", "kyc"],
  ["teller", "teller"],
  ["user-admin", "userAdmin"],
];

export function resolveDashboardPreset(user: StaffUser): DashboardPreset {
  for (const [role, preset] of PRESET_BY_ROLE) {
    if (user.roles.includes(role)) return preset;
  }
  return "minimal";
}
