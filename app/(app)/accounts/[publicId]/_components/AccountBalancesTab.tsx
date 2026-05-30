"use client";

import { useCallback } from "react";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import {
  fetchAccountAvailableBalance,
  fetchAccountBalance,
  type AccountAvailableBalance,
  type AccountBalance,
} from "@/lib/api/customer-accounts";
import { localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  accountPublicId: string;
  currency: string | null;
};

type BalancesData = {
  balance: AccountBalance;
  available: AccountAvailableBalance;
};

export function AccountBalancesTab({ accountPublicId, currency }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const ccy = currency ?? "XAF";

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<BalancesData> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [balance, available] = await Promise.all([
        fetchAccountBalance(token, accountPublicId, { currency: ccy }),
        fetchAccountAvailableBalance(token, accountPublicId, { currency: ccy }),
      ]);
      return { balance, available };
    },
    [token, accountPublicId, ccy],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    accountPublicId,
    ccy,
  ]);

  const money = (minor: number) => format.currencyMinor(minor, { currency: ccy });

  if (error) {
    return (
      <Alert
        variant="danger"
        title={t("accountDetail.balances.errorTitle")}
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
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={t("accountDetail.balances.accounting")}
          value={money(data.balance.balance_minor)}
          emphasis
        />
        <Stat
          label={t("accountDetail.balances.available")}
          value={money(data.available.available_balance_minor)}
          emphasis
        />
        <Stat
          label={t("accountDetail.balances.activeHolds")}
          value={money(data.available.active_hold_amount_minor)}
        />
        <Stat
          label={t("accountDetail.balances.minimum")}
          value={money(data.available.minimum_balance_minor)}
        />
        <Stat
          label={t("accountDetail.balances.unavailable")}
          value={money(data.available.unavailable_amount_minor)}
        />
        <Stat
          label={t("accountDetail.balances.accountingFloor")}
          value={money(data.available.accounting_balance_minor)}
        />
      </div>

      <section className="rounded-[var(--radius-card)] border border-border bg-background">
        <header className="border-b border-border border-l-4 border-l-accent bg-accent/5 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-foreground">
            {t("accountDetail.balances.movementsTitle")}
          </h3>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          <Line
            label={t("accountDetail.balances.totalDebit")}
            value={money(data.balance.debit_total_minor)}
          />
          <Line
            label={t("accountDetail.balances.totalCredit")}
            value={money(data.balance.credit_total_minor)}
          />
        </dl>
      </section>

      <p className="text-xs text-muted-foreground">
        {t("accountDetail.balances.currencyNote", { currency: ccy })}
      </p>
    </div>
  );
}

/**
 * Computed read-only figure. Neutral surface (border + muted label), never the
 * pink "error" tint from the mockups (DESIGN §4.4). A null amount renders 0,
 * not a red signal.
 */
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
        className={cn(
          "tabular-nums text-foreground",
          emphasis ? "text-lg font-bold" : "text-base font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
