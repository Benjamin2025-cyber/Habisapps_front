"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { fetchProxies, type ClientProxy } from "@/lib/api/client-proxies";
import { localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  accountPublicId: string;
  clientPublicId: string | null;
};

const VERIFICATION_TONE: Record<
  ClientProxy["verification_status"],
  "neutral" | "info" | "success" | "danger"
> = {
  pending: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
};

/**
 * Read-only view of the mandataires who may operate THIS account. Proxies
 * belong to the client and have no account-scoped endpoint, so we fetch the
 * client's proxies. Management lives in the client fiche (P6.2).
 *
 * `customer_account_id` is nullable: a mandataire registered while creating the
 * client profile is client-level and may act on every account they hold, while
 * one registered against an account is limited to it. Keeping only the second
 * kind reported "aucun mandataire" on accounts whose holder had in fact
 * registered one — the common case, since the client form is where they are
 * usually captured. Both kinds are listed, and the scope column says which.
 */
export function AccountProxiesTab({ accountPublicId, clientPublicId }: Props) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ClientProxy[]> => {
      if (!token) throw new Error("Missing session token");
      if (!clientPublicId) return [];
      void signal;
      const rows = await fetchProxies(token, clientPublicId, { perPage: 100 });
      return rows.filter(
        (p) =>
          p.customer_account_public_id === accountPublicId ||
          p.customer_account_public_id === null,
      );
    },
    [token, clientPublicId, accountPublicId],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    clientPublicId,
    accountPublicId,
  ]);

  const columns = useMemo<ColumnDef<ClientProxy, unknown>[]>(
    () => [
      {
        accessorKey: "proxy_full_name",
        header: t("accountDetail.proxies.columns.name"),
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        id: "scope",
        header: t("accountDetail.proxies.columns.scope"),
        cell: ({ row }) => (
          <Badge
            tone={row.original.customer_account_public_id === null ? "info" : "neutral"}
          >
            {t(
              row.original.customer_account_public_id === null
                ? "accountDetail.proxies.scope.client"
                : "accountDetail.proxies.scope.account",
            )}
          </Badge>
        ),
      },
      {
        accessorKey: "proxy_phone_number",
        header: t("accountDetail.proxies.columns.phone"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "mandate_type",
        header: t("accountDetail.proxies.columns.mandate"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "verification_status",
        header: t("accountDetail.proxies.columns.status"),
        cell: ({ row, getValue }) => {
          if (row.original.status !== "active") {
            return (
              <Badge tone="neutral">
                {t(`clientDetail.proxies.status.${row.original.status}`)}
              </Badge>
            );
          }
          const verification = getValue() as ClientProxy["verification_status"];
          return (
            <Badge tone={VERIFICATION_TONE[verification]}>
              {t(`clientDetail.proxies.verificationStatus.${verification}`)}
            </Badge>
          );
        },
      },
      {
        id: "period",
        header: t("accountDetail.proxies.columns.period"),
        cell: ({ row }) => {
          const from = row.original.starts_on?.slice(0, 10);
          const to = row.original.ends_on?.slice(0, 10);
          if (!from && !to) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums text-muted-foreground">
              {(from ?? "…") + " → " + (to ?? "…")}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert
          variant="danger"
          title={t("accountDetail.proxies.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <DataTable<ClientProxy>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("accountDetail.proxies.empty")}
        getRowId={(row) => row.public_id}
        title={t("accountDetail.proxies.title")}
        titleAside={t("accountDetail.proxies.count", { count: data?.length ?? 0 })}
      />

      {clientPublicId ? (
        <p className="text-xs text-muted-foreground">
          {t("accountDetail.proxies.manageHint")}{" "}
          <Link
            href={`/clients/${clientPublicId}`}
            className="font-semibold text-accent hover:underline"
          >
            {t("accountDetail.proxies.manageLink")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
