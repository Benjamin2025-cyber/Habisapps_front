import { apiRequest, ApiError, notifyAuthExpired } from "./client";

/**
 * Database management — backups, restores, storage health.
 *
 * Mirrors HabisApi `routes/api/v1/database_management.php`
 * (`/database/backups`, `/database/restores`, `/database/storage`). All routes
 * are platform-admin only via the `system.database.*` permission family
 * (see HabisApi `config/security.php`). Every operation is also gated by the
 * `accounting.day.registration-lock` middleware on the backend, and the service
 * can be globally disabled (responds 503) — surface those as toasts.
 */

export type DatabaseBackupStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "verified"
  | "deleted";

export type BackupVerificationStatus = "passed" | "failed" | null;

export type DatabaseBackup = {
  public_id: string;
  filename: string;
  disk: string;
  status: DatabaseBackupStatus;
  database_connection: string;
  database_driver: string;
  size_bytes: number | null;
  checksum_sha256: string | null;
  encrypted: boolean;
  compression: string | null;
  verification_status: BackupVerificationStatus;
  verified_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  metadata: { note?: string } | Record<string, unknown> | null;
  is_downloadable: boolean;
  created_at: string;
  updated_at: string;
};

export type DatabaseRestoreStatus =
  | "planned"
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type RestoreTarget =
  | "same_database"
  | "staging_database"
  | "external_database";

export type RestoreMode = "dry_run" | "replace" | "verify_only";

export type DatabaseRestoreOperation = {
  public_id: string;
  status: DatabaseRestoreStatus;
  target: RestoreTarget;
  mode: RestoreMode;
  confirmation_method: string | null;
  destructive: boolean;
  backup_public_id: string;
  backup_checksum_sha256: string | null;
  pre_restore_backup_public_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type DatabaseStorage = {
  enabled: boolean;
  disk: string;
  is_private: boolean;
  reachable: boolean;
  free_bytes: number | null;
  backup_count: number;
  total_bytes: number;
  last_successful_backup: DatabaseBackup | null;
  retention_policy: {
    max_age_days: number;
    max_count: number;
    min_protected: number;
    keep_last_verified: boolean;
  };
  restore_enabled: boolean;
  maintenance_lock: {
    active: boolean;
    owner_user_id: number | string | null;
    reason: string | null;
    expires_at: string | null;
  } | null;
};

type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedBackups = {
  data: DatabaseBackup[];
  meta: { pagination: Pagination };
};

export type PaginatedRestores = {
  data: DatabaseRestoreOperation[];
  meta: { pagination: Pagination };
};

const FALLBACK_PAGINATION: Pagination = {
  current_page: 1,
  per_page: 25,
  total: 0,
  last_page: 1,
};

/**
 * Shared raw-envelope reader for the two list endpoints, since `apiRequest`
 * drops `meta` and we need `meta.pagination` for server-side paging.
 */
async function fetchListEnvelope<T>(
  token: string,
  path: string,
  query: URLSearchParams,
  key: "backups" | "restore_operations",
): Promise<{ data: T[]; meta: { pagination: Pagination } }> {
  const qs = query.toString();
  const response = await fetch(`/api/v1/${path}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    let message = `Request failed (HTTP ${response.status})`;
    let errors = null;
    if (text.length > 0) {
      try {
        const parsed = JSON.parse(text) as { message?: string; errors?: never };
        message = parsed.message ?? message;
        errors = parsed.errors ?? null;
      } catch {
        /* keep default */
      }
    }
    throw new ApiError(message, response.status, errors);
  }

  const envelope = JSON.parse(text) as {
    data?: Record<string, T[]> | T[];
    meta?: { pagination?: Pagination };
  };

  const rows: T[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.[key])
      ? (envelope.data as Record<string, T[]>)[key]
      : [];

  return {
    data: rows,
    meta: { pagination: envelope.meta?.pagination ?? FALLBACK_PAGINATION },
  };
}

/* ------------------------------------------------------------------ backups */

export async function fetchDatabaseBackups(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    status?: DatabaseBackupStatus;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<PaginatedBackups> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);
  if (options.search && options.search.trim().length > 0) {
    query.set("search", options.search.trim());
  }
  if (options.dateFrom) query.set("date_from", options.dateFrom);
  if (options.dateTo) query.set("date_to", options.dateTo);

  return fetchListEnvelope<DatabaseBackup>(
    token,
    "database/backups",
    query,
    "backups",
  );
}

export async function getDatabaseBackup(
  token: string,
  publicId: string,
): Promise<DatabaseBackup> {
  const data = await apiRequest<{ backup: DatabaseBackup }>(
    `database/backups/${publicId}`,
    { method: "GET", token },
  );
  return data.backup;
}

export async function createDatabaseBackup(
  token: string,
  note?: string,
): Promise<DatabaseBackup> {
  const trimmed = note?.trim();
  const data = await apiRequest<{ backup: DatabaseBackup }>("database/backups", {
    method: "POST",
    token,
    body: trimmed ? { note: trimmed } : {},
  });
  return data.backup;
}

export async function deleteDatabaseBackup(
  token: string,
  publicId: string,
): Promise<DatabaseBackup> {
  const data = await apiRequest<{ backup: DatabaseBackup }>(
    `database/backups/${publicId}`,
    { method: "DELETE", token },
  );
  return data.backup;
}

export async function verifyDatabaseBackup(
  token: string,
  publicId: string,
): Promise<{
  backup: DatabaseBackup;
  verification: {
    passed: boolean;
    file_exists: boolean;
    checksum_matches: boolean;
  };
}> {
  return apiRequest(`database/backups/${publicId}/verify`, {
    method: "POST",
    token,
  });
}

/**
 * Stream a backup artifact to the browser. The endpoint returns a binary
 * download (not JSON), so we fetch the blob and trigger a save via a transient
 * anchor. Failures come back as a JSON `{ message, errors:{code} }` envelope
 * which we surface as an `ApiError`.
 */
export async function downloadDatabaseBackup(
  token: string,
  backup: Pick<DatabaseBackup, "public_id" | "filename">,
): Promise<void> {
  const response = await fetch(
    `/api/v1/database/backups/${backup.public_id}/download`,
    {
      method: "GET",
      headers: {
        Accept: "*/*",
        "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    },
  );

  if (!response.ok) {
    if (response.status === 401) notifyAuthExpired();
    let message = `Download failed (HTTP ${response.status})`;
    let errors = null;
    try {
      const parsed = (await response.json()) as {
        message?: string;
        errors?: never;
      };
      message = parsed.message ?? message;
      errors = parsed.errors ?? null;
    } catch {
      /* binary error body — keep default */
    }
    throw new ApiError(message, response.status, errors);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backup.filename || `${backup.public_id}.dump`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------------- restores */

export async function fetchDatabaseRestores(
  token: string,
  options: {
    page?: number;
    perPage?: number;
    status?: DatabaseRestoreStatus;
  } = {},
): Promise<PaginatedRestores> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.status) query.set("status", options.status);

  return fetchListEnvelope<DatabaseRestoreOperation>(
    token,
    "database/restores",
    query,
    "restore_operations",
  );
}

export type RestorePlan = {
  target: RestoreTarget;
  mode: RestoreMode;
  backup_checksum_sha256: string | null;
  destructive: boolean;
  expires_at: string | null;
  execution_token: string;
};

export async function planDatabaseRestore(
  token: string,
  payload: {
    backup_public_id: string;
    target: RestoreTarget;
    mode: RestoreMode;
    confirmation_phrase?: string;
  },
): Promise<{ restore_operation: DatabaseRestoreOperation; plan: RestorePlan }> {
  const body: Record<string, string> = {
    backup_public_id: payload.backup_public_id,
    target: payload.target,
    mode: payload.mode,
  };
  if (payload.confirmation_phrase && payload.confirmation_phrase.length > 0) {
    body.confirmation_phrase = payload.confirmation_phrase;
  }
  return apiRequest("database/restores/plan", {
    method: "POST",
    token,
    body,
  });
}

export async function executeDatabaseRestore(
  token: string,
  publicId: string,
  password: string,
): Promise<{ restore_operation: DatabaseRestoreOperation }> {
  return apiRequest(`database/restores/${publicId}/execute`, {
    method: "POST",
    token,
    body: { password },
  });
}

export async function cancelDatabaseRestore(
  token: string,
  publicId: string,
): Promise<{ restore_operation: DatabaseRestoreOperation }> {
  return apiRequest(`database/restores/${publicId}/cancel`, {
    method: "POST",
    token,
  });
}

/* ------------------------------------------------------------------ storage */

export async function getDatabaseStorage(
  token: string,
): Promise<DatabaseStorage> {
  const data = await apiRequest<{ storage: DatabaseStorage }>(
    "database/storage",
    { method: "GET", token },
  );
  return data.storage;
}

export type RetentionDryRun = {
  dry_run: true;
  candidate_count: number;
  candidates: Array<{ public_id: string; size_bytes: number | null }>;
  reclaimable_bytes: number;
};

export type RetentionRun = {
  dry_run: false;
  deleted_count: number;
  deleted_public_ids: string[];
  reclaimed_bytes: number;
};

export async function runBackupRetention(
  token: string,
  dryRun: boolean,
): Promise<RetentionDryRun | RetentionRun> {
  return apiRequest("database/backups/retention/run", {
    method: "POST",
    token,
    body: { dry_run: dryRun },
  });
}
