"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { LoanStatus } from "@/lib/api/loans";

export type LoansFilterState = {
  query: string;
  status: LoanStatus | "";
};

export const EMPTY_LOANS_FILTERS: LoansFilterState = {
  query: "",
  status: "",
};

const STATUSES: LoanStatus[] = [
  "application",
  "in_review",
  "approved",
  "rejected",
  "disbursed",
  "active",
  "rescheduled",
  "closed",
  "written_off",
];

type Props = {
  value: LoansFilterState;
  onChange: (next: LoansFilterState) => void;
};

export function LoansFilters({ value, onChange }: Props) {
  const t = useTranslations();

  const statusOptions = STATUSES.map((status) => ({
    value: status,
    label: t(`loans.status.${status}`),
  }));

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="loans-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("loans.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="loans-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("loans.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-52">
        <label
          htmlFor="loans-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("loans.filters.statusLabel")}
        </label>
        <Select
          id="loans-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("loans.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as LoanStatus | "" })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
