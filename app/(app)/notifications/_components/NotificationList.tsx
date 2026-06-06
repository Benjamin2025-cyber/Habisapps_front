"use client";

import { Badge } from "@/components/ui/Badge";
import { SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/api/notifications";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { notificationVisual } from "./notification-visuals";

export type NotificationFilter = "all" | "unread" | "read";

const FILTERS: NotificationFilter[] = ["all", "unread", "read"];

type Props = {
  items: AppNotification[];
  loading: boolean;
  error: boolean;
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (item: AppNotification) => void;
  onMarkAll: () => void;
  hasUnread: boolean;
  page: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};

/** Humanise a snake_case category into a readable chip label. */
function humanizeCategory(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[._-]+/g, " ").trim();
  if (cleaned === "") return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Master pane of the notifications screen: search + filter toolbar, the
 * scrollable feed of notification rows, and the footer pager. Purely
 * presentational — selection, paging, and read-state live in the parent view.
 */
export function NotificationList({
  items,
  loading,
  error,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  onMarkAll,
  hasUnread,
  page,
  lastPage,
  total,
  onPageChange,
  onRetry,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const emptyKey =
    filter === "unread"
      ? "notifications.list.emptyUnread"
      : filter === "read"
        ? "notifications.list.emptyRead"
        : "notifications.list.empty";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <label className="flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3 transition-colors focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/10">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("notifications.search.placeholder")}
            aria-label={t("notifications.search.label")}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </label>

        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-[var(--radius-field)] bg-muted p-0.5">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                aria-pressed={filter === value}
                className={cn(
                  "rounded-[calc(var(--radius-field)-2px)] px-3 py-1 text-xs font-semibold transition-colors",
                  filter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`notifications.filters.${value}`)}
              </button>
            ))}
          </div>

          {hasUnread ? (
            <button
              type="button"
              onClick={onMarkAll}
              className="shrink-0 text-xs font-semibold text-accent hover:underline"
            >
              {t("notifications.markAllRead")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <p className="text-sm text-danger">
              {t("notifications.list.loadError")}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t(emptyKey)}
          </p>
        ) : (
          <ul
            aria-label={t("notifications.list.ariaLabel")}
            className="divide-y divide-border"
          >
            {items.map((item) => {
              const visual = notificationVisual(item.type);
              const unread = !item.read_at;
              const selected = item.public_id === selectedId;
              const category = humanizeCategory(item.category);
              return (
                <li key={item.public_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                      "border-l-2 hover:bg-muted/40",
                      selected
                        ? "border-l-accent bg-accent/5"
                        : "border-l-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        visual.chipClass,
                      )}
                    >
                      <visual.Icon className="h-[18px] w-[18px]" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-start gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm text-foreground",
                            unread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {item.title}
                        </span>
                        {unread ? (
                          <span
                            aria-label={t("notifications.list.unreadBadge")}
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                          />
                        ) : null}
                      </span>

                      {item.message ? (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {item.message}
                        </span>
                      ) : null}

                      <span className="flex flex-wrap items-center gap-2 pt-0.5">
                        {category ? (
                          <Badge tone="neutral">{category}</Badge>
                        ) : null}
                        <span className="text-[0.7rem] text-muted-foreground/80">
                          {format.relative(item.created_at)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pager */}
      {total > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {t("notifications.list.showing", {
              count: items.length,
              total,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-[var(--radius-field)] px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("notifications.pagination.previous")}
            </button>
            <span className="px-1 text-xs tabular-nums text-muted-foreground">
              {t("notifications.pagination.page", {
                page,
                pages: Math.max(lastPage, 1),
              })}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= lastPage || loading}
              className="rounded-[var(--radius-field)] px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("notifications.pagination.next")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
