"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { CustomerAccountStatus } from "@/lib/api/customer-accounts";

export type AccountsFilterState = {
  query: string;
  status: CustomerAccountStatus | "";
};

export const EMPTY_ACCOUNTS_FILTERS: AccountsFilterState = {
  query: "",
  status: "",
};

type Props = {
  value: AccountsFilterState;
  onChange: (next: AccountsFilterState) => void;
};

export function AccountsFilters({ value, onChange }: Props) {
  const t = useTranslations();

  const statusOptions: Array<{ value: CustomerAccountStatus | ""; label: string }> = [
    { value: "active", label: t("accounts.status.active") },
    { value: "suspended", label: t("accounts.status.suspended") },
    { value: "closed", label: t("accounts.status.closed") },
    { value: "archived", label: t("accounts.status.archived") },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="accounts-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("accounts.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="accounts-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("accounts.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-48">
        <label
          htmlFor="accounts-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("accounts.filters.statusLabel")}
        </label>
        <Select
          id="accounts-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("accounts.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as CustomerAccountStatus | "" })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
