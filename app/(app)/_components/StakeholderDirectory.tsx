"use client";

import { useCallback, useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "./PageHeader";

type DirectoryQuery = {
  page: number;
  perPage: number;
  scope?: "all";
  status?: string;
  verificationStatus?: string;
  search?: string;
};

type Paginated<TRow> = {
  data: TRow[];
  meta: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      last_page: number;
    };
  };
};

type Props<TRow> = {
  title: string;
  description: string;
  columns: ColumnDef<TRow, unknown>[];
  load: (token: string, query: DirectoryQuery) => Promise<Paginated<TRow>>;
  getRowId: (row: TRow) => string;
  statusOptions: Array<{ value: string; label: string }>;
  verificationOptions: Array<{ value: string; label: string }>;
};

/**
 * Read-only, institution-wide directory (Référentiel Garants / Mandataires —
 * back-issue #13). Transversal list across clients backed by `GET /guarantors`
 * / `GET /proxies`: server-side search + status/verification filters +
 * pagination. Create/edit stays on the client details page; this view is a
 * lookup surface only.
 */
export function StakeholderDirectory<TRow>({
  title,
  description,
  columns,
  load,
  getRowId,
  statusOptions,
  verificationOptions,
}: Props<TRow>) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  // Institution scope broadens the list beyond the current agency.
  const canScopeInstitution = useCan("crm.scope.institution.read");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [verification, setVerification] = useState("");

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status, verification]);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<Paginated<TRow>> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return load(token, {
        page,
        perPage: pageSize,
        scope: canScopeInstitution ? "all" : undefined,
        status: status || undefined,
        verificationStatus: verification || undefined,
        search: debouncedQuery || undefined,
      });
    },
    [token, page, pageSize, canScopeInstitution, status, verification, debouncedQuery, load],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
    canScopeInstitution,
    status,
    verification,
    debouncedQuery,
  ]);

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader title={title} description={description} />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("directory.filters.search")}
          </label>
          <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("directory.filters.searchPlaceholder")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("directory.filters.status")}
          </label>
          <Select
            size="sm"
            value={status}
            options={statusOptions}
            placeholder={t("directory.filters.statusAll")}
            isClearable
            onChange={setStatus}
            className="mt-2"
          />
        </div>
        <div className="sm:w-48">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("directory.filters.verification")}
          </label>
          <Select
            size="sm"
            value={verification}
            options={verificationOptions}
            placeholder={t("directory.filters.verificationAll")}
            isClearable
            onChange={setVerification}
            className="mt-2"
          />
        </div>
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("directory.errorTitle")}
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

      <DataTable<TRow>
        columns={columns}
        data={data?.data ?? []}
        loading={loading && !data}
        getRowId={getRowId}
        titleAside={
          pageMeta
            ? t("directory.count", { count: pageMeta.total })
            : undefined
        }
        pagination={
          pageMeta
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
            : undefined
        }
      />
    </>
  );
}
