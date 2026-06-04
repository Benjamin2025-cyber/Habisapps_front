import { apiRequest, notifyAuthExpired } from "./client";

/**
 * In-app user notification feed (#26). Each authenticated user has their own
 * feed; read-state is per-user. Endpoints:
 *   GET  /notifications                 — paginated list (data.notifications)
 *   POST /notifications/{id}/read       — mark one read (data.notification)
 *   POST /notifications/read-all        — mark all read (data.marked_read_count)
 * There is no dedicated unread-count endpoint, so we derive it from a
 * `filter[read]=false` page-of-one (meta.pagination.total).
 */
export type NotificationType = "info" | "success" | "warning" | "error" | string;

export type AppNotification = {
  public_id: string;
  type: NotificationType;
  category: string | null;
  title: string;
  message: string | null;
  action_url: string | null;
  agency_public_id: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PaginatedNotifications = {
  data: AppNotification[];
  meta: { pagination: Pagination };
};

export type NotificationQuery = {
  page?: number;
  perPage?: number;
  /** true → only read, false → only unread, undefined → all. */
  read?: boolean;
  type?: string;
  category?: string;
  search?: string;
};

export async function fetchNotifications(
  token: string,
  options: NotificationQuery = {},
): Promise<PaginatedNotifications> {
  const query = new URLSearchParams();
  query.set("per_page", String(options.perPage ?? 25));
  if (options.page && options.page > 0) query.set("page", String(options.page));
  if (options.read !== undefined) query.set("filter[read]", options.read ? "true" : "false");
  if (options.type) query.set("filter[type]", options.type);
  if (options.category) query.set("filter[category]", options.category);
  if (options.search) query.set("search", options.search);

  const response = await fetch(`/api/v1/notifications?${query.toString()}`, {
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
    throw new Error(`Failed to fetch notifications (HTTP ${response.status})`);
  }
  const envelope = JSON.parse(text) as {
    data?: { notifications?: AppNotification[] } | AppNotification[];
    meta?: { pagination?: Partial<Pagination> } & Partial<Pagination>;
  };
  const rows: AppNotification[] = Array.isArray(envelope.data)
    ? envelope.data
    : Array.isArray(envelope.data?.notifications)
      ? envelope.data!.notifications!
      : [];
  const m = envelope.meta?.pagination ?? envelope.meta ?? {};
  return {
    data: rows,
    meta: {
      pagination: {
        current_page: m.current_page ?? 1,
        per_page: m.per_page ?? options.perPage ?? 25,
        total: m.total ?? rows.length,
        last_page: m.last_page ?? 1,
      },
    },
  };
}

/** Unread count via a page-of-one filtered to unread. */
export async function fetchUnreadNotificationCount(token: string): Promise<number> {
  const res = await fetchNotifications(token, { read: false, perPage: 1 });
  return res.meta.pagination.total;
}

export async function markNotificationRead(
  token: string,
  publicId: string,
): Promise<AppNotification> {
  const data = await apiRequest<{ notification: AppNotification }>(
    `notifications/${publicId}/read`,
    { method: "POST", token },
  );
  return data.notification;
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const data = await apiRequest<{ marked_read_count: number }>(
    "notifications/read-all",
    { method: "POST", token },
  );
  return data.marked_read_count;
}
