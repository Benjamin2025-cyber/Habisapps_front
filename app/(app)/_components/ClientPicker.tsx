"use client";

import { useMemo } from "react";
import { AsyncSelect, type AsyncSelectOption } from "@/components/ui/AsyncSelect";
import { fetchClients, type Client } from "@/lib/api/clients";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";

/** Client option carries its agency + plain holder name for the selection. */
export type ClientOption = AsyncSelectOption & {
  agencyPublicId: string | null;
  /** Holder name without the reference suffix (for defaulting an account title). */
  holderName: string;
};

type Props = {
  /** Selected option (controlled by the parent). */
  value: ClientOption | null;
  onChange: (option: ClientOption | null) => void;
  /**
   * Restrict results to this agency. Applied client-side: the clients index
   * has no agency filter yet (only status / kyc_status / search), so this
   * narrows the fetched page rather than querying server-side.
   */
  agencyPublicId?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
};

/**
 * Server-search client picker. Queries `GET /clients?search=` (debounced) as
 * the user types. Self-contained: pulls token + institution scope from the
 * session. `agencyPublicId` narrows results to one agency (client-side until
 * the backend exposes an agency filter).
 */
export function ClientPicker({
  value,
  onChange,
  agencyPublicId,
  id,
  label,
  placeholder,
  error,
  hint,
  disabled,
  required,
}: Props) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const canScopeInstitution = useCan("crm.scope.institution.read");

  const loadOptions = useMemo(() => {
    const run = (
      input: string,
      callback: (options: ClientOption[]) => void,
    ) => {
      if (!token) {
        callback([]);
        return;
      }
      fetchClients(token, {
        search: input || undefined,
        scope: canScopeInstitution ? "all" : undefined,
        perPage: 50,
      })
        .then((response) => {
          const rows = agencyPublicId
            ? response.data.filter((c) => c.agency_public_id === agencyPublicId)
            : response.data;
          callback(rows.map(toOption));
        })
        .catch(() => callback([]));
    };
    return debounce(run, 300);
  }, [token, canScopeInstitution, agencyPublicId]);

  return (
    <AsyncSelect<ClientOption>
      // Remount when the agency filter changes so the default list reflects it.
      key={agencyPublicId ?? "all"}
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
      noOptionsMessage={t("clientPicker.noResults")}
      loadingMessage={t("clientPicker.searching")}
    />
  );
}

export function toClientOption(client: Client): ClientOption {
  return toOption(client);
}

function toOption(client: Client): ClientOption {
  const name =
    [client.last_name?.toUpperCase(), client.first_name]
      .filter((part): part is string => !!part && part.length > 0)
      .join(" ") || client.public_id;
  return {
    value: client.public_id,
    label: client.client_reference ? `${name} — ${client.client_reference}` : name,
    agencyPublicId: client.agency_public_id ?? null,
    holderName: name,
  };
}

function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
