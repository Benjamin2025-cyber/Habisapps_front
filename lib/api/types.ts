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
  id: number;
  public_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  matricule: string | null;
  job_title: string | null;
  agency_id: number | null;
  agency_code: string | null;
  agency_name: string | null;
  status: "pending_verification" | "active" | "suspended" | string;
  roles?: string[];
  permissions?: string[];
  last_login_at: string | null;
  activated_at: string | null;
};

export type LoginResponse = {
  user: StaffUser;
  token: string;
};
