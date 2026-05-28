"use client";

import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export type DataTablePagination = {
  /** 1-based page number — matches what Laravel returns. */
  page: number;
  pageSize: number;
  total: number;
  lastPage: number;
  onPageChange: (next: number) => void;
};

type Props<TRow> = {
  columns: ColumnDef<TRow, unknown>[];
  data: TRow[];
  loading?: boolean;
  emptyMessage?: string;
  /** Title of the table section (left side of the header). */
  title?: ReactNode;
  /** Right side of the header strip — typically "X items" count. */
  titleAside?: ReactNode;
  /** Caption rendered below the table card (e.g. "X agence(s) enregistrée(s) au total"). */
  bottomCaption?: ReactNode;
  /** Server-side pagination. Caller manages state. Omit to hide. */
  pagination?: DataTablePagination;
  /** Stable identifier per row for React keys. Falls back to row index. */
  getRowId?: (row: TRow, index: number) => string;
  /** Optional row click handler. */
  onRowClick?: (row: TRow) => void;
  className?: string;
};

/**
 * Generic data table built on TanStack Table v8 (headless).
 *
 * Section design mirrors interfaces.pdf p8 list cards: a tinted header strip
 * with a vertical accent bar on the left + optional right-side count, then
 * the column header row in the same tint with no uppercase, then white body
 * rows. Bottom caption + server-side pagination sit below the card.
 */
export function DataTable<TRow>({
  columns,
  data,
  loading,
  emptyMessage,
  title,
  titleAside,
  bottomCaption,
  pagination,
  getRowId,
  onRowClick,
  className,
}: Props<TRow>) {
  const t = useTranslations();

  const table = useReactTable<TRow>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    pageCount: pagination?.lastPage ?? 1,
  });

  const showsPagination = !!pagination && pagination.lastPage > 1;
  const showsBottomBar = !!bottomCaption || showsPagination;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
        {title || titleAside ? (
          <header className="flex items-center justify-between gap-3 border-b border-border border-l-4 border-l-accent bg-accent/5 px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {titleAside ? (
              <span className="text-xs text-muted-foreground">{titleAside}</span>
            ) : null}
          </header>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/5 text-xs">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const align =
                      (header.column.columnDef.meta as { align?: "left" | "right" } | undefined)
                        ?.align ?? "left";
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        style={
                          header.column.columnDef.size
                            ? { width: header.column.columnDef.size }
                            : undefined
                        }
                        className={cn(
                          "px-4 py-3 font-semibold text-foreground",
                          align === "right" ? "text-right" : "text-left",
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {loading && data.length === 0 ? (
                <SkeletonRows
                  rows={4}
                  columns={table.getVisibleLeafColumns().length}
                />
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.getVisibleLeafColumns().length}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {emptyMessage ?? t("dataTable.empty")}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "transition-colors hover:bg-accent/5",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const align =
                        (cell.column.columnDef.meta as { align?: "left" | "right" } | undefined)
                          ?.align ?? "left";
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-4 py-3 align-middle",
                            align === "right" ? "text-right" : "text-left",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showsBottomBar ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
          <span className="text-muted-foreground">{bottomCaption}</span>
          {showsPagination && pagination ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground tabular-nums">
                {t("dataTable.range", {
                  from: (pagination.page - 1) * pagination.pageSize + 1,
                  to: Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  ),
                  total: pagination.total,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  pagination.onPageChange(Math.max(1, pagination.page - 1))
                }
                disabled={pagination.page <= 1 || loading}
                className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.previous")}
              </button>
              <span className="text-muted-foreground tabular-nums">
                {t("dataTable.pageOf", {
                  current: pagination.page,
                  total: pagination.lastPage,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  pagination.onPageChange(
                    Math.min(pagination.lastPage, pagination.page + 1),
                  )
                }
                disabled={pagination.page >= pagination.lastPage || loading}
                className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.next")}
              </button>
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

function SkeletonRows({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-4 py-3">
              <span className="block h-3 w-full animate-pulse rounded bg-muted/60" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
