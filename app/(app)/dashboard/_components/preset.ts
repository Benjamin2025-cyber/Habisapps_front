import type { StaffUser } from "@/lib/api/types";

/**
 * Dashboard rendering preset, picked once per session based on the user's
 * roles. The mapping is intentionally coarse: 3 buckets that cover all 11
 * roles defined in `config/security.php`.
 *
 * - `management`: leadership + risk + audit. Renders the full PDF p6 layout
 *   (KPI strip, alerts, user-management widget, activities, agency table).
 * - `field`: day-to-day operators. Renders a role-tailored counts + queues
 *   layout (NOT the management cards — they 403 on `/dashboards/operational`).
 * - `minimal`: generic `staff` role with no business authority. Welcome only.
 */
export type DashboardPreset = "management" | "field" | "minimal";

const MANAGEMENT_ROLES = [
  "platform-admin",
  "agency-manager",
  "compliance-officer",
  "auditor",
];

const FIELD_ROLES = [
  "regional-manager",
  "loan-officer",
  "accountant",
  "teller",
  "kyc-officer",
  "user-admin",
];

export function resolveDashboardPreset(user: StaffUser): DashboardPreset {
  const roles = user.roles;
  if (roles.some((role) => MANAGEMENT_ROLES.includes(role))) return "management";
  if (roles.some((role) => FIELD_ROLES.includes(role))) return "field";
  return "minimal";
}
