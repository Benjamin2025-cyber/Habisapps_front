"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  LedgerAccountClass,
  LedgerAccountStatus,
} from "@/lib/api/ledger-accounts";

export type LedgerAccountsFilterState = {
  query: string;
  accountClass: LedgerAccountClass | "";
  status: LedgerAccountStatus | "";
};

export const EMPTY_LEDGER_ACCOUNTS_FILTERS: LedgerAccountsFilterState = {
  query: "",
  accountClass: "",
  status: "",
};

const CLASSES: LedgerAccountClass[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

const STATUSES: LedgerAccountStatus[] = [
  "active",
  "inactive",
  "suspended",
  "archived",
];

type Props = {
  value: LedgerAccountsFilterState;
  onChange: (next: LedgerAccountsFilterState) => void;
};

export function LedgerAccountsFilters({ value, onChange }: Props) {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="ledger-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("ledgerAccounts.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="ledger-search"
            type="search"
            value={value.query}
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            placeholder={t("ledgerAccounts.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-48">
        <label
          htmlFor="ledger-class"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("ledgerAccounts.filters.classLabel")}
        </label>
        <Select
          id="ledger-class"
          size="sm"
          value={value.accountClass}
          options={CLASSES.map((c) => ({
            value: c,
            label: t(`ledgerAccounts.class.${c}`),
          }))}
          placeholder={t("ledgerAccounts.filters.classAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, accountClass: next as LedgerAccountClass | "" })
          }
          className="mt-2"
        />
      </div>

      <div className="sm:w-44">
        <label
          htmlFor="ledger-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("ledgerAccounts.filters.statusLabel")}
        </label>
        <Select
          id="ledger-status"
          size="sm"
          value={value.status}
          options={STATUSES.map((s) => ({
            value: s,
            label: t(`ledgerAccounts.status.${s}`),
          }))}
          placeholder={t("ledgerAccounts.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as LedgerAccountStatus | "" })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
