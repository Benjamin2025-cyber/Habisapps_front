"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Sector, SectorStatus, SubSector } from "@/lib/api/sectors";

const STATUS_TONE: Record<SectorStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  archived: "danger",
};

const PAGE_SIZES = [10, 25, 50, 100];

type Props = {
  sector: Sector | null;
  subSectors: ReadonlyArray<SubSector>;
  loading: boolean;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (subSector: SubSector) => void;
  onDelete: (subSector: SubSector) => void;
};

export function SubSectorPanel({
  sector,
  subSectors,
  loading,
  canManage,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to the first page whenever the selected sector changes.
  useEffect(() => {
    setPage(1);
  }, [sector?.public_id]);

  const total = subSectors.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, lastPage);
  const start = (safePage - 1) * pageSize;
  const visible = subSectors.slice(start, start + pageSize);

  if (!sector) {
    return (
      <section className="flex min-h-[20rem] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-background">
        <p className="text-sm text-muted-foreground">
          {t("sectors.detail.noSelection")}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-foreground">
            {t("sectors.detail.title", { name: sector.name })}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t("sectors.detail.subtitle", {
              code: sector.code,
              count: subSectors.length,
            })}
          </span>
        </div>
        {canManage ? (
          <Button variant="primary" size="sm" onClick={onCreate}>
            {t("sectors.detail.create")}
          </Button>
        ) : null}
      </div>

      {loading && subSectors.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : subSectors.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("sectors.detail.empty")}
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-semibold">
                {t("sectors.detail.columns.code")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("sectors.detail.columns.name")}
              </th>
              <th className="px-4 py-2 font-semibold">
                {t("sectors.detail.columns.status")}
              </th>
              {canManage ? (
                <th className="px-4 py-2 text-right font-semibold">
                  {t("sectors.detail.columns.actions")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((sub) => {
              const items: DropdownMenuItem[] = [
                {
                  label: t("sectors.actions.edit"),
                  onClick: () => onEdit(sub),
                },
                { kind: "separator" },
                {
                  label: t("sectors.actions.delete"),
                  onClick: () => onDelete(sub),
                  destructive: true,
                },
              ];
              return (
                <tr
                  key={sub.public_id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-4 py-2.5 font-bold tabular-nums text-foreground">
                    {sub.code}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{sub.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={
                        STATUS_TONE[sub.status as SectorStatus] ?? "neutral"
                      }
                    >
                      {t(`sectors.status.${sub.status}`)}
                    </Badge>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end">
                        <DropdownMenu
                          trigger={<MoreVerticalIcon className="h-4 w-4" />}
                          triggerLabel={t("sectors.actions.menu")}
                          items={items}
                          align="right"
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {total > 0 ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            {t("dataTable.perPage")}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label={t("dataTable.perPage")}
              className="h-8 rounded-[var(--radius-field)] border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="tabular-nums">
              {t("dataTable.range", {
                from: start + 1,
                to: Math.min(start + pageSize, total),
                total,
              })}
            </span>
            {lastPage > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("common.previous")}
                </button>
                <span className="tabular-nums">
                  {t("dataTable.pageOf", { current: safePage, total: lastPage })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(lastPage, safePage + 1))}
                  disabled={safePage >= lastPage}
                  className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("common.next")}
                </button>
              </>
            ) : null}
          </div>
        </footer>
      ) : null}
    </section>
  );
}
