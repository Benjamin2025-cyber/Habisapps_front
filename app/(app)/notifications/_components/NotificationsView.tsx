"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type PaginatedNotifications,
} from "@/lib/api/notifications";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { PageHeader } from "../../_components/PageHeader";
import { NotificationDetail } from "./NotificationDetail";
import { NotificationList, type NotificationFilter } from "./NotificationList";

const PER_PAGE = 25;

/**
 * Notifications master-detail screen. The list (master) is paginated and
 * filterable; selecting a row puts its `public_id` in the URL (`?selected=`),
 * which deep-links the detail pane and marks the notification read. On small
 * screens the detail replaces the list with a "back" affordance.
 */
export function NotificationsView() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("selected");

  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Detail resolved by deep-link when the row isn't on the current page.
  const [fetchedDetail, setFetchedDetail] = useState<AppNotification | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<"load" | "notfound" | null>(null);

  // Debounce free-text search.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const readFilter = filter === "all" ? undefined : filter === "unread" ? false : true;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedNotifications> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchNotifications(token, {
        page,
        perPage: PER_PAGE,
        read: readFilter,
        search: search || undefined,
      });
    },
    [token, page, readFilter, search],
  );
  const { data, loading, error, setData, refetch } = useApi(fetcher, [
    token,
    page,
    readFilter,
    search,
  ]);

  const items = useMemo(() => data?.data ?? [], [data]);
  const pageMeta = data?.meta.pagination;

  // Keep a live handle on the latest list so the deep-link effect can patch
  // read-state without re-running on every list change.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const setSelected = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("selected", id);
      else params.delete("selected");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Resolve + mark-read whenever the selected id changes.
  useEffect(() => {
    if (!selected || !token) {
      setFetchedDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const existing = dataRef.current?.data.find((n) => n.public_id === selected) ?? null;
    if (!existing) setDetailLoading(true);
    setDetailError(null);

    let cancelled = false;
    markNotificationRead(token, selected)
      .then((row) => {
        if (cancelled) return;
        setFetchedDetail(row);
        // Patch the in-list copy so its unread marker clears immediately.
        const current = dataRef.current;
        if (current?.data.some((n) => n.public_id === row.public_id)) {
          setData({
            ...current,
            data: current.data.map((n) =>
              n.public_id === row.public_id
                ? { ...n, read_at: row.read_at ?? n.read_at ?? new Date().toISOString() }
                : n,
            ),
          });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const status = cause instanceof ApiError ? cause.status : 0;
        setDetailError(status === 404 ? "notfound" : "load");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, token, setData]);

  const handleSelect = useCallback(
    (item: AppNotification) => {
      setSelected(item.public_id);
    },
    [setSelected],
  );

  const handleMarkAll = useCallback(async () => {
    if (!token) return;
    const current = dataRef.current;
    if (current) {
      const now = new Date().toISOString();
      setData({
        ...current,
        data: current.data.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      });
    }
    try {
      await markAllNotificationsRead(token);
    } finally {
      refetch();
    }
  }, [token, setData, refetch]);

  const resolvedDetail = useMemo(() => {
    if (!selected) return null;
    return items.find((n) => n.public_id === selected) ?? fetchedDetail;
  }, [selected, items, fetchedDetail]);

  const hasUnread = items.some((n) => !n.read_at);

  if (session.status !== "authenticated") return null;

  return (
    <>
      <PageHeader
        title={t("notifications.pageTitle")}
        description={t("notifications.pageDescription")}
      />

      <div className="flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col gap-5 lg:flex-row">
        <div
          className={cn(
            "min-h-0 flex-1 lg:flex-none lg:w-[380px]",
            selected && "hidden lg:block",
          )}
        >
          <NotificationList
            items={items}
            loading={loading}
            error={!!error}
            filter={filter}
            onFilterChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
            search={searchInput}
            onSearchChange={setSearchInput}
            selectedId={selected}
            onSelect={handleSelect}
            onMarkAll={handleMarkAll}
            hasUnread={hasUnread}
            page={pageMeta?.current_page ?? page}
            lastPage={pageMeta?.last_page ?? 1}
            total={pageMeta?.total ?? 0}
            onPageChange={setPage}
            onRetry={refetch}
          />
        </div>

        <div
          className={cn(
            "min-h-0 flex-1",
            !selected && "hidden lg:block",
          )}
        >
          <NotificationDetail
            notification={resolvedDetail}
            loading={detailLoading}
            error={detailError}
            onBack={() => setSelected(null)}
          />
        </div>
      </div>
    </>
  );
}
