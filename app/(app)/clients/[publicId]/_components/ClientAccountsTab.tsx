"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  fetchCustomerAccounts,
  type CustomerAccount,
  type CustomerAccountStatus,
} from "@/lib/api/customer-accounts";
import {
  fetchAccountProducts,
  type AccountProduct,
} from "@/lib/api/account-products";
import { localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  clientPublicId: string;
  onCountChange?: (count: number) => void;
};

const STATUS_TONE: Record<
  CustomerAccountStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  suspended: "warning",
  closed: "neutral",
  archived: "danger",
};

/**
 * Client fiche → Comptes tab: lists this client's customer accounts. Rows open
 * the full account fiche (P7) where balances, statements, signatures and holds
 * are managed.
 */
export function ClientAccountsTab({ clientPublicId, onCountChange }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [products, setProducts] = useState<AccountProduct[]>([]);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<CustomerAccount[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const response = await fetchCustomerAccounts(token, {
        clientPublicId,
        perPage: 100,
      });
      return response.data;
    },
    [token, clientPublicId],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    clientPublicId,
  ]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAccountProducts(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setProducts(response.data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (data) onCountChange?.(data.length);
  }, [data, onCountChange]);

  const productNameOf = useMemo(() => {
    const byId = new Map<string, string>();
    for (const product of products) {
      byId.set(
        product.public_id,
        `${product.name} — ${t(`accountProducts.family.${product.account_family}`)}`,
      );
    }
    return (publicId: string | null) =>
      publicId ? byId.get(publicId) ?? publicId : "—";
  }, [products, t]);

  const columns = useMemo<ColumnDef<CustomerAccount, unknown>[]>(
    () => [
      {
        accessorKey: "account_number",
        header: t("clientDetail.accounts.columns.number"),
        cell: ({ getValue }) => (
          <span className="font-bold tabular-nums text-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: t("clientDetail.accounts.columns.product"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {productNameOf(row.original.account_product_public_id)}
          </span>
        ),
      },
      {
        accessorKey: "currency",
        header: t("clientDetail.accounts.columns.currency"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("clientDetail.accounts.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as CustomerAccountStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`accounts.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "opened_on",
        header: t("clientDetail.accounts.columns.openedOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 10) : "—"}
            </span>
          );
        },
      },
    ],
    [t, productNameOf],
  );

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert
          variant="danger"
          title={t("clientDetail.accounts.errorTitle")}
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

      <DataTable<CustomerAccount>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("clientDetail.accounts.empty")}
        getRowId={(row) => row.public_id}
        title={t("clientDetail.accounts.title")}
        titleAside={t("clientDetail.accounts.count", { count: data?.length ?? 0 })}
        onRowClick={(row) => router.push(`/accounts/${row.public_id}`)}
      />
    </div>
  );
}
