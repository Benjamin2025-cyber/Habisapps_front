"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

const UNREAD_POLL_MS = 60_000;
const TYPE_DOT: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
  info: "bg-info",
};

/**
 * Top-bar notification bell (#26). Shows an unread badge, and a dropdown feed
 * with the most recent notifications. Clicking an item marks it read (and
 * follows its in-app `action_url` when present); "mark all read" clears the
 * badge. Unread count refreshes on an interval so the badge stays live.
 */
export function NotificationBell() {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(() => {
    if (!token) return;
    fetchUnreadNotificationCount(token)
      .then(setUnread)
      .catch(() => undefined);
  }, [token]);

  const loadFeed = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    fetchNotifications(token, { perPage: 8 })
      .then((res) => {
        setItems(res.data);
        setUnread(res.data.filter((n) => !n.read_at).length);
        // The unread badge may exceed the 8 shown; reconcile via the count call.
        refreshUnread();
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token, refreshUnread]);

  // Initial unread count + interval refresh (badge stays live without opening).
  useEffect(() => {
    if (!token) return;
    refreshUnread();
    const timer = setInterval(refreshUnread, UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [token, refreshUnread]);

  // Load the feed when the dropdown opens.
  useEffect(() => {
    if (open) loadFeed();
  }, [open, loadFeed]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleItemClick(item: AppNotification) {
    if (!token) return;
    if (!item.read_at) {
      // Optimistic: flag read locally, decrement badge, then persist.
      setItems((current) =>
        current.map((n) =>
          n.public_id === item.public_id
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(token, item.public_id).catch(() => refreshUnread());
    }
    // Follow only in-app links (avoid sending the user to a raw API path).
    if (item.action_url && item.action_url.startsWith("/") && !item.action_url.startsWith("/api")) {
      setOpen(false);
      router.push(item.action_url);
    }
  }

  async function handleMarkAll() {
    if (!token) return;
    setItems((current) =>
      current.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
    setUnread(0);
    try {
      await markAllNotificationsRead(token);
    } finally {
      refreshUnread();
    }
  }

  if (!token) return null;

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("shell.topBar.notifications.label")}
        aria-expanded={open}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-field)] text-muted-foreground",
          "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted text-foreground",
        )}
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-danger-foreground">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius-card)] border border-border bg-background shadow-[0_24px_60px_-30px_rgba(20,6,47,0.30)]">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              {t("shell.topBar.notifications.label")}
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-accent hover:underline"
              >
                {t("shell.topBar.notifications.markAllRead")}
              </button>
            ) : null}
          </header>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : error ? (
              <p className="px-4 py-8 text-center text-xs text-danger">
                {t("shell.topBar.notifications.loadError")}
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                {t("shell.topBar.notifications.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const dot = TYPE_DOT[item.type] ?? "bg-muted-foreground";
                  const unreadItem = !item.read_at;
                  return (
                    <li key={item.public_id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                          unreadItem && "bg-accent/5",
                        )}
                      >
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className={cn(
                              "truncate text-sm text-foreground",
                              unreadItem ? "font-semibold" : "font-medium",
                            )}
                          >
                            {item.title}
                          </span>
                          {item.message ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {item.message}
                            </span>
                          ) : null}
                          <span className="text-[0.7rem] text-muted-foreground/80">
                            {format.relative(item.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
