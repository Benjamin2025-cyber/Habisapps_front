"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { TextField } from "@/components/ui/TextField";
import {
  fetchAccountStatement,
  type AccountMovement,
  type AccountStatement,
} from "@/lib/api/customer-accounts";
import { localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  accountPublicId: string;
  currency: string | null;
};

export function AccountStatementTab({ accountPublicId, currency }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const ccy = currency ?? "XAF";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<AccountStatement> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchAccountStatement(token, accountPublicId, {
        currency: ccy,
        from: from || undefined,
        to: to || undefined,
        page,
        perPage: 50,
      });
    },
    [token, accountPublicId, ccy, from, to, page],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    accountPublicId,
    ccy,
    from,
    to,
    page,
  ]);

  const money = (minor: number) => format.currencyMinor(minor, { currency: ccy });

  const columns = useMemo<ColumnDef<AccountMovement, unknown>[]>(
    () => [
      {
        accessorKey: "business_date",
        header: t("accountDetail.statement.columns.date"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value ? value.slice(0, 10) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "reference",
        header: t("accountDetail.statement.columns.reference"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "line_memo",
        header: t("accountDetail.statement.columns.memo"),
        cell: ({ getValue }) => (
          <span className="text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "debit_minor",
        header: t("accountDetail.statement.columns.debit"),
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return (
            <span className="tabular-nums text-foreground">
              {value ? money(value) : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "credit_minor",
        header: t("accountDetail.statement.columns.credit"),
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return (
            <span className="tabular-nums text-foreground">
              {value ? money(value) : "—"}
            </span>
          );
        },
      },
    ],
    // money depends on format/ccy which are stable for the tab's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, ccy],
  );

  const summary = data?.statement;
  const pageMeta = data?.pagination;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <TextField
            label={t("accountDetail.statement.from")}
            type="date"
            value={from}
            onChange={(event) => {
              setPage(1);
              setFrom(event.target.value);
            }}
          />
        </div>
        <div className="sm:w-44">
          <TextField
            label={t("accountDetail.statement.to")}
            type="date"
            value={to}
            onChange={(event) => {
              setPage(1);
              setTo(event.target.value);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {t("accountDetail.balances.currencyNote", { currency: ccy })}
        </p>
      </section>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={t("accountDetail.statement.opening")}
            value={money(summary.opening_balance_minor)}
          />
          <Stat
            label={t("accountDetail.statement.totalDebit")}
            value={money(summary.debit_total_minor)}
          />
          <Stat
            label={t("accountDetail.statement.totalCredit")}
            value={money(summary.credit_total_minor)}
          />
          <Stat
            label={t("accountDetail.statement.closing")}
            value={money(summary.closing_balance_minor)}
            emphasis
          />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="danger"
          title={t("accountDetail.statement.errorTitle")}
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

      <DataTable<AccountMovement>
        columns={columns}
        data={data?.movements ?? []}
        loading={loading && !data}
        emptyMessage={t("accountDetail.statement.empty")}
        getRowId={(row) => row.public_id}
        title={t("accountDetail.statement.title")}
        titleAside={t("accountDetail.statement.count", {
          count: pageMeta?.total ?? data?.movements.length ?? 0,
        })}
        pagination={
          pageMeta
            ? {
                page: pageMeta.current_page,
                pageSize: pageMeta.per_page,
                total: pageMeta.total,
                lastPage: pageMeta.last_page,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-muted/30 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          emphasis
            ? "text-base font-bold tabular-nums text-foreground"
            : "text-sm font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
