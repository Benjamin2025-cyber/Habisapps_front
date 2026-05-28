"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { AgencyStatus } from "@/lib/api/agencies";

export type AgenciesFilterState = {
  query: string;
  status: AgencyStatus | "";
};

export const EMPTY_AGENCIES_FILTERS: AgenciesFilterState = {
  query: "",
  status: "",
};

type Props = {
  value: AgenciesFilterState;
  onChange: (next: AgenciesFilterState) => void;
};

export function AgenciesFilters({ value, onChange }: Props) {
  const t = useTranslations();

  const statusOptions: Array<{ value: AgencyStatus | ""; label: string }> = [
    { value: "active", label: t("agencies.status.active") },
    { value: "inactive", label: t("agencies.status.inactive") },
    { value: "suspended", label: t("agencies.status.suspended") },
    { value: "archived", label: t("agencies.status.archived") },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.10)] sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="agencies-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("agencies.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="agencies-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("agencies.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-56">
        <label
          htmlFor="agencies-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("agencies.filters.statusLabel")}
        </label>
        <Select
          id="agencies-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("agencies.filters.statusAll")}
          onChange={(event) =>
            onChange({
              ...value,
              status: event.target.value as AgencyStatus | "",
            })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
