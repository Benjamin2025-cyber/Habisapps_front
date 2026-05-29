"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  ClientKycStatus,
  ClientStatus,
} from "@/lib/api/clients";

export type ClientsFilterState = {
  query: string;
  status: ClientStatus | "";
  kycStatus: ClientKycStatus | "";
};

export const EMPTY_CLIENTS_FILTERS: ClientsFilterState = {
  query: "",
  status: "",
  kycStatus: "",
};

type Props = {
  value: ClientsFilterState;
  onChange: (next: ClientsFilterState) => void;
};

export function ClientsFilters({ value, onChange }: Props) {
  const t = useTranslations();

  const statusOptions: Array<{ value: ClientStatus | ""; label: string }> = [
    { value: "active", label: t("clients.status.active") },
    { value: "inactive", label: t("clients.status.inactive") },
    { value: "suspended", label: t("clients.status.suspended") },
    { value: "archived", label: t("clients.status.archived") },
  ];

  const kycOptions: Array<{ value: ClientKycStatus | ""; label: string }> = [
    { value: "draft", label: t("clients.kyc.draft") },
    { value: "pending_review", label: t("clients.kyc.pending_review") },
    { value: "verified", label: t("clients.kyc.verified") },
    { value: "rejected", label: t("clients.kyc.rejected") },
    { value: "suspended", label: t("clients.kyc.suspended") },
    { value: "archived", label: t("clients.kyc.archived") },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="clients-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("clients.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="clients-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("clients.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-44">
        <label
          htmlFor="clients-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("clients.filters.statusLabel")}
        </label>
        <Select
          id="clients-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("clients.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as ClientStatus | "" })
          }
          className="mt-2"
        />
      </div>

      <div className="sm:w-56">
        <label
          htmlFor="clients-kyc"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("clients.filters.kycLabel")}
        </label>
        <Select
          id="clients-kyc"
          size="sm"
          value={value.kycStatus}
          options={kycOptions}
          placeholder={t("clients.filters.kycAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, kycStatus: next as ClientKycStatus | "" })
          }
          className="mt-2"
        />
      </div>
    </section>
  );
}
