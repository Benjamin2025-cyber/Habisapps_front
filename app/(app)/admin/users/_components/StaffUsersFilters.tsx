"use client";

import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Agency } from "@/lib/api/agencies";
import type { StaffUserStatus } from "@/lib/api/staff-users";

export type StaffUsersFilterState = {
  query: string;
  status: StaffUserStatus | "";
  agencyPublicId: string;
  role: string;
};

export const EMPTY_STAFF_USERS_FILTERS: StaffUsersFilterState = {
  query: "",
  status: "",
  agencyPublicId: "",
  role: "",
};

type Props = {
  value: StaffUsersFilterState;
  onChange: (next: StaffUsersFilterState) => void;
  agencies: ReadonlyArray<Agency>;
  roles: ReadonlyArray<{ name: string; display_name: string }>;
};

export function StaffUsersFilters({ value, onChange, agencies, roles }: Props) {
  const t = useTranslations();

  const statusOptions: Array<{ value: StaffUserStatus | ""; label: string }> = [
    { value: "active", label: t("staffUsers.status.active") },
    { value: "pending_verification", label: t("staffUsers.status.pending_verification") },
    { value: "suspended", label: t("staffUsers.status.suspended") },
    { value: "deactivated", label: t("staffUsers.status.deactivated") },
  ];

  const agencyOptions = agencies.map((agency) => ({
    value: agency.public_id,
    label: `${agency.code} — ${agency.name}`,
  }));

  const roleOptions = roles.map((role) => ({
    value: role.name,
    label: role.display_name,
  }));

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label
          htmlFor="staff-users-search"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("staffUsers.filters.searchLabel")}
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            id="staff-users-search"
            type="search"
            value={value.query}
            onChange={(event) =>
              onChange({ ...value, query: event.target.value })
            }
            placeholder={t("staffUsers.filters.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
        </div>
      </div>

      <div className="sm:w-44">
        <label
          htmlFor="staff-users-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("staffUsers.filters.statusLabel")}
        </label>
        <Select
          id="staff-users-status"
          size="sm"
          value={value.status}
          options={statusOptions}
          placeholder={t("staffUsers.filters.statusAll")}
          isClearable
          onChange={(next) =>
            onChange({ ...value, status: next as StaffUserStatus | "" })
          }
          className="mt-2"
        />
      </div>

      <div className="sm:w-56">
        <label
          htmlFor="staff-users-agency"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("staffUsers.filters.agencyLabel")}
        </label>
        <Select
          id="staff-users-agency"
          size="sm"
          value={value.agencyPublicId}
          options={agencyOptions}
          placeholder={t("staffUsers.filters.agencyAll")}
          isClearable
          onChange={(next) => onChange({ ...value, agencyPublicId: next })}
          className="mt-2"
        />
      </div>

      <div className="sm:w-48">
        <label
          htmlFor="staff-users-role"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("staffUsers.filters.roleLabel")}
        </label>
        <Select
          id="staff-users-role"
          size="sm"
          value={value.role}
          options={roleOptions}
          placeholder={t("staffUsers.filters.roleAll")}
          isClearable
          onChange={(next) => onChange({ ...value, role: next })}
          className="mt-2"
        />
      </div>
    </section>
  );
}
