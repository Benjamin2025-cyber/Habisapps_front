"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import { useSession } from "@/lib/auth/SessionProvider";

type Props = {
  /** Selected staff-user public_id ("" = none). */
  value: string;
  onChange: (publicId: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
};

/**
 * Picker for a staff user (prospector, collection agent, …). Self-contained:
 * loads the staff list once from the session token. Synchronous + searchable —
 * the staff-users index has no free-text search, and institution staff are few.
 */
export function StaffUserPicker({
  value,
  onChange,
  id,
  label,
  placeholder,
  error,
  hint,
  disabled,
}: Props) {
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const [users, setUsers] = useState<StaffUser[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchStaffUsers(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setUsers(response.data);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const options = useMemo(() => {
    const list = users.map((user) => ({
      value: user.public_id,
      label: user.agency_name ? `${user.name} — ${user.agency_name}` : user.name,
    }));
    // Keep an unknown pre-selected value visible (e.g. a staff member outside
    // the loaded page) so editing doesn't silently drop it.
    if (value && !list.some((option) => option.value === value)) {
      list.push({ value, label: value });
    }
    return list;
  }, [users, value]);

  return (
    <Select
      id={id}
      label={label}
      value={value}
      options={options}
      placeholder={placeholder}
      isClearable
      onChange={onChange}
      error={error}
      hint={hint}
      disabled={disabled}
    />
  );
}
