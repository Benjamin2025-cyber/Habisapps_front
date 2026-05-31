"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon, SearchIcon } from "@/components/ui/icons";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Sector, SectorStatus } from "@/lib/api/sectors";

const STATUS_TONE: Record<SectorStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  archived: "danger",
};

type Props = {
  sectors: ReadonlyArray<Sector>;
  loading: boolean;
  selectedId: string | null;
  search: string;
  canManage: boolean;
  countOf: (sectorPublicId: string) => number;
  onSearchChange: (value: string) => void;
  onSelect: (sector: Sector) => void;
  onCreate: () => void;
  onEdit: (sector: Sector) => void;
  onDelete: (sector: Sector) => void;
};

export function SectorList({
  sectors,
  loading,
  selectedId,
  search,
  canManage,
  countOf,
  onSearchChange,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations();

  return (
    <section className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("sectors.master.title")}
        </h2>
        {canManage ? (
          <Button variant="primary" size="sm" onClick={onCreate}>
            {t("sectors.master.create")}
          </Button>
        ) : null}
      </div>

      <div className="border-b border-border p-3">
        <div className="flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("sectors.master.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-[calc(100vh-22rem)] min-h-[12rem] overflow-y-auto">
        {loading && sectors.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : sectors.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("sectors.master.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sectors.map((sector) => {
              const active = sector.public_id === selectedId;
              const items: DropdownMenuItem[] = [
                {
                  label: t("sectors.actions.edit"),
                  onClick: () => onEdit(sector),
                },
                { kind: "separator" },
                {
                  label: t("sectors.actions.delete"),
                  onClick: () => onDelete(sector),
                  destructive: true,
                },
              ];
              return (
                <li key={sector.public_id}>
                  <div
                    className={`flex items-center gap-2 px-4 py-3 ${
                      active ? "bg-accent/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(sector)}
                      className="flex flex-1 flex-col items-start gap-1 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-bold tabular-nums text-foreground">
                          {sector.code}
                        </span>
                        <span className="text-sm text-foreground">
                          {sector.name}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge
                          tone={
                            STATUS_TONE[sector.status as SectorStatus] ??
                            "neutral"
                          }
                        >
                          {t(`sectors.status.${sector.status}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t("sectors.master.subCount", {
                            count: countOf(sector.public_id),
                          })}
                        </span>
                      </span>
                    </button>
                    {canManage ? (
                      <DropdownMenu
                        trigger={<MoreVerticalIcon className="h-4 w-4" />}
                        triggerLabel={t("sectors.actions.menu")}
                        items={items}
                        align="right"
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
