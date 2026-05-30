"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  AccountFamily,
  AccountProductStatus,
} from "@/lib/api/account-products";

export type AccountProductsFilterState = {
  query: string;
  family: AccountFamily | "";
  status: AccountProductStatus | "";
};

export const EMPTY_ACCOUNT_PRODUCTS_FILTERS: AccountProductsFilterState = {
  query: "",
  family: "",
  status: "",
};

type Props = {
  value: AccountProductsFilterState;
  onChange: (next: AccountProductsFilterState) => void;
};

export function AccountProductsFilters({ value, onChange }: Props) {
  const t = useTranslations();

  const familyOptions: Array<{ value: AccountFamily | ""; label: string }> = [
    { value: "savings", label: t("accountProducts.family.savings") },
    { value: "current", label: t("accountProducts.family.current") },
    { value: "recovery", label: t("accountProducts.family.recovery") },
    { value: "islamic", label: t("accountProducts.family.islamic") },
  ];

  const statusOptions: Array<{ value: AccountProductStatus | ""; label: string }> = [
    { value: "active", label: t("accountProducts.status.active") },
    { value: "inactive", label: t("accountProducts.status.inactive") },
    { value: "archived", label: t("accountProducts.status.archived") },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="products-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("accountProducts.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="products-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("accountProducts.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-48">
        <label
          htmlFor="products-family"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("accountProducts.filters.familyLabel")}
        </label>
        <Select
          id="products-family"
          size="sm"
          value={value.family}
          options={familyOptions}
          placeholder={t("accountProducts.filters.familyAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, family: next as AccountFamily | "" })
          }
          className="mt-2"
        />
      </div>

      <div className="sm:w-44">
        <label
          htmlFor="products-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("accountProducts.filters.statusLabel")}
        </label>
        <Select
          id="products-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("accountProducts.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as AccountProductStatus | "" })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
