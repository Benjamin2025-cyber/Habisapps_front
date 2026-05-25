/**
 * Standard envelope used by every HabisApi response.
 * See HabisApi/README.md → "API Design".
 */
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: ApiErrorBag | null;
  meta: ApiMeta | null;
};

export type ApiErrorBag = Record<string, string[]> | { message?: string };

export type ApiMeta = {
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
  [key: string]: unknown;
};

export type StaffUser = {
  public_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  matricule: string | null;
  job_title: string | null;
  agency_public_id: string | null;
  agency_code: string | null;
  agency_name: string | null;
  status: "pending_verification" | "active" | "suspended" | string;
  /** Roles the user is currently assigned. */
  roles: string[];
  /** Union of role-granted + directly-granted permissions. Use for `useCan()`. */
  permissions: string[];
  /** Subset of `permissions` that were granted directly (not via a role). */
  direct_permissions: string[];
  phone_verified_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  professional_profile?: Record<string, unknown> | null;
};

export type LoginResponse = {
  user: StaffUser;
  token: string;
};

export type MeResponse = {
  user: StaffUser;
};
