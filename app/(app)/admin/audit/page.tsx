"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  fetchAuditEvents,
  type AuditEvent,
  type PaginatedAuditEvents,
} from "@/lib/api/audit";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";

/** Standard Spatie activity verbs offered as a curated filter (search covers
 *  any other value). */
const EVENT_VERBS = ["created", "updated", "deleted", "restored"] as const;

const EVENT_TONE: Record<string, "success" | "info" | "danger" | "neutral"> = {
  created: "success",
  updated: "info",
  deleted: "danger",
  restored: "neutral",
};

/** `App\Models\Loan` → `Loan`; null → em dash. */
function shortType(value: string | null): string {
  if (!value) return "—";
  const segment = value.split("\\").pop();
  return segment && segment.length > 0 ? segment : value;
}

/** ISO ATOM → `YYYY-MM-DD HH:mm:ss`. */
function fmtTimestamp(iso: string): string {
  return iso ? iso.slice(0, 19).replace("T", " ") : "—";
}

export default function AuditPage() {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const auditView = useCanAny(["audit.view"]);
  const canView = isPlatformAdmin || auditView;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [eventFilter, setEventFilter] = useState("");
  const [logName, setLogName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AuditEvent | null>(null);

  // Debounce the free-text search so we don't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedAuditEvents> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchAuditEvents(token, {
        page,
        perPage: pageSize,
        event: eventFilter || undefined,
        logName: logName || undefined,
        search: search || undefined,
      });
    },
    [token, page, pageSize, eventFilter, logName, search],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    eventFilter,
    logName,
    search,
  ]);

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: t("audit.columns.timestamp"),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
            {fmtTimestamp(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "event",
        header: t("audit.columns.event"),
        cell: ({ getValue }) => {
          const v = (getValue() as string | null) ?? "";
          if (!v) return <span className="text-muted-foreground">—</span>;
          const key = `audit.events.${v}`;
          const label = t(key);
          return (
            <Badge tone={EVENT_TONE[v] ?? "neutral"}>
              {label === key ? v : label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "description",
        header: t("audit.columns.description"),
        cell: ({ getValue }) => (
          <span className="text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "subject_type",
        header: t("audit.columns.subject"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {shortType(getValue() as string | null)}
          </span>
        ),
      },
      {
        accessorKey: "causer_type",
        header: t("audit.columns.causer"),
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return (
            <span className="text-muted-foreground">
              {v ? shortType(v) : t("audit.system")}
            </span>
          );
        },
      },
      {
        accessorKey: "log_name",
        header: t("audit.columns.logName"),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
    ],
    [t],
  );

  if (session.status !== "authenticated" || !canView) return null;

  const pageMeta = data?.meta.pagination;
  const pagination: DataTablePagination | undefined = pageMeta
    ? {
        page: pageMeta.current_page,
        pageSize: pageMeta.per_page,
        total: pageMeta.total,
        lastPage: pageMeta.last_page,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
      }
    : undefined;

  return (
    <>
      <PageHeader
        title={t("audit.pageTitle")}
        description={t("audit.pageDescription")}
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("audit.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <section className="grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label={t("audit.filters.search")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("audit.filters.searchPlaceholder")}
        />
        <Select
          label={t("audit.filters.event")}
          value={eventFilter}
          options={EVENT_VERBS.map((v) => ({
            value: v,
            label: t(`audit.events.${v}`),
          }))}
          placeholder={t("audit.filters.eventAll")}
          isClearable
          onChange={(next) => {
            setEventFilter(next);
            setPage(1);
          }}
        />
        <TextField
          label={t("audit.filters.logName")}
          value={logName}
          onChange={(event) => {
            setLogName(event.target.value);
            setPage(1);
          }}
          placeholder={t("audit.filters.logNamePlaceholder")}
        />
      </section>

      <DataTable<AuditEvent>
        columns={columns}
        data={rows}
        loading={loading && !data}
        emptyMessage={t("audit.empty")}
        getRowId={(row) =>
          `${row.created_at}|${row.event ?? ""}|${row.log_name ?? ""}|${(row.description ?? "").slice(0, 40)}`
        }
        pagination={pagination}
        title={t("audit.listTitle")}
        titleAside={t("audit.count", {
          count: pageMeta?.total ?? rows.length,
        })}
        onRowClick={(row) => setDetail(row)}
      />

      <AuditDetailDrawer event={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function AuditDetailDrawer({
  event,
  onClose,
}: {
  event: AuditEvent | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const hasProps =
    event?.properties && Object.keys(event.properties).length > 0;

  return (
    <Drawer
      open={event !== null}
      onClose={onClose}
      title={t("audit.detail.title")}
      description={event ? fmtTimestamp(event.created_at) : undefined}
      footer={
        <Button variant="ghost" size="md" type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {event ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Detail label={t("audit.detail.event")} value={event.event} />
            <Detail label={t("audit.detail.logName")} value={event.log_name} />
            <Detail
              label={t("audit.detail.subject")}
              value={shortType(event.subject_type)}
            />
            <Detail
              label={t("audit.detail.causer")}
              value={
                event.causer_type ? shortType(event.causer_type) : t("audit.system")
              }
            />
          </dl>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("audit.detail.description")}
            </span>
            <p className="text-sm text-foreground">{event.description || "—"}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("audit.detail.properties")}
            </span>
            {hasProps ? (
              <pre className="overflow-x-auto rounded-[var(--radius-field)] border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                {JSON.stringify(event.properties, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("audit.detail.noProperties")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
