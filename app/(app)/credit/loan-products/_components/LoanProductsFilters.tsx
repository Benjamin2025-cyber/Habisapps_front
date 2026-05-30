"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { LoanProductStatus } from "@/lib/api/loan-products";

export type LoanProductsFilterState = {
  query: string;
  status: LoanProductStatus | "";
};

export const EMPTY_LOAN_PRODUCTS_FILTERS: LoanProductsFilterState = {
  query: "",
  status: "",
};

type Props = {
  value: LoanProductsFilterState;
  onChange: (next: LoanProductsFilterState) => void;
};

export function LoanProductsFilters({ value, onChange }: Props) {
  const t = useTranslations();

  const statusOptions: Array<{ value: LoanProductStatus | ""; label: string }> = [
    { value: "active", label: t("loanProducts.status.active") },
    { value: "inactive", label: t("loanProducts.status.inactive") },
    { value: "archived", label: t("loanProducts.status.archived") },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="loan-products-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("loanProducts.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="loan-products-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("loanProducts.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-44">
        <label
          htmlFor="loan-products-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("loanProducts.filters.statusLabel")}
        </label>
        <Select
          id="loan-products-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("loanProducts.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as LoanProductStatus | "" })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
