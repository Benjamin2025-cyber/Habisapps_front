"use client";

import { useEffect, useMemo, useRef } from "react";
import { AsyncSelect, type AsyncSelectOption } from "@/components/ui/AsyncSelect";
import {
  fetchLedgerAccounts,
  getLedgerAccount,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { debounce } from "@/lib/debounce";
import { localizeApiError } from "@/lib/api/errors";

export type LedgerAccountOption = AsyncSelectOption & {
  account: LedgerAccount;
};

export function toLedgerAccountOption(
  account: LedgerAccount,
): LedgerAccountOption {
  /*
   * The chart holds one row per agency for every detail account, so a reader
   * with institution scope gets `3712 — Comptes courants clients` three times
   * over with nothing to separate them. Naming the agency is what makes the
   * choice a choice rather than a guess; institution-level grouping accounts
   * carry no agency and need no suffix.
   */
  const agency = account.agency_code ?? account.agency_name ?? null;

  return {
    value: account.public_id,
    label: agency
      ? `${account.code} — ${account.name} · ${agency}`
      : `${account.code} — ${account.name}`,
    account,
  };
}

type Props = {
  value: LedgerAccountOption | null;
  onChange: (option: LedgerAccountOption | null) => void;
  /**
   * Narrows the result set to what this field may legally accept. Applied after
   * the server search, so it filters the matches rather than the first page of
   * the chart.
   */
  filter?: (account: LedgerAccount) => boolean;
  /** Limits the server result to the chart of the document's agency. */
  agencyPublicId?: string | null;
  /** Re-fetches the default list when it changes (e.g. the selected agency). */
  resetKey?: string;
  /**
   * Public id of an already-selected account, for edit forms that hold a bare
   * id. Resolved once by its own request rather than by hunting the first page
   * of the chart, which would fail for any code past the first hundred.
   */
  initialValuePublicId?: string | null;
  id?: string;
  label?: string;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  /** Reports why the chart could not be read, so the field can say so. */
  onLoadError?: (message: string | null) => void;
};

/**
 * Server-search ledger account picker. Queries `GET /ledger-accounts?search=`
 * (debounced) on `code`, `name`, class, type, side and status. When supplied,
 * `agencyPublicId` is sent too, so the initial page is the selected agency's
 * chart rather than institution grouping accounts.
 *
 * Exists because a real PCEMF chart is ~1 400 accounts per agency and the API
 * caps `per_page` at 100: loading one page and filtering it in the browser —
 * which is what every picker used to do — silently hides almost the whole
 * chart. Searching server-side is the only way the deeper codes are reachable.
 */
export function LedgerAccountPicker({
  value,
  onChange,
  filter,
  agencyPublicId,
  resetKey,
  initialValuePublicId,
  id,
  label,
  placeholder,
  error,
  hint,
  disabled,
  onLoadError,
  required,
}: Props) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  // Resolve the incoming id exactly once; afterwards `value` is authoritative,
  // so re-selecting or clearing is never undone.
  const resolvedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!token || !initialValuePublicId) return;
    if (value?.value === initialValuePublicId) return;
    if (resolvedFor.current === initialValuePublicId) return;
    resolvedFor.current = initialValuePublicId;
    let cancelled = false;
    getLedgerAccount(token, initialValuePublicId)
      .then((account) => {
        if (!cancelled) onChange(toLedgerAccountOption(account));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, initialValuePublicId, value, onChange]);

  const loadOptions = useMemo(() => {
    const run = (
      input: string,
      callback: (options: LedgerAccountOption[]) => void,
    ) => {
      if (!token) {
        callback([]);
        return;
      }
      fetchLedgerAccounts(token, {
        search: input || undefined,
        perPage: 100,
        agencyPublicId,
      })
        .then((response) => {
          const rows = filter ? response.data.filter(filter) : response.data;
          onLoadError?.(null);
          callback(rows.map(toLedgerAccountOption));
        })
        .catch((cause: unknown) => {
          // A refused chart used to arrive as "no matches", which reads as an
          // empty chart rather than as a right the reader does not have.
          onLoadError?.(localizeApiError(cause).generalMessage);
          callback([]);
        });
    };
    return debounce(run, 300);
  }, [token, filter, agencyPublicId, onLoadError]);

  return (
    <AsyncSelect<LedgerAccountOption>
      key={resetKey ?? "all"}
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder={placeholder}
      error={error}
      hint={hint}
      disabled={disabled}
      required={required}
      isClearable
      noOptionsMessage={t("ledgerAccounts.picker.noResults")}
      loadingMessage={t("ledgerAccounts.picker.searching")}
    />
  );
}
