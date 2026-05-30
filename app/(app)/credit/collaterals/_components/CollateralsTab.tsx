"use client";

import { useCallback, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import {
  createCollateral,
  createCollateralItem,
  fetchCollaterals,
  releaseCollateral,
  updateCollateral,
  updateCollateralItem,
  type Collateral,
  type CollateralItem,
  type CollateralStatus,
  type CollateralItemWritePayload,
  type CollateralWritePayload,
} from "@/lib/api/collaterals";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import type { Loan } from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import {
  CollateralDrawer,
  type CollateralDrawerMode,
} from "./CollateralDrawer";
import {
  CollateralItemDrawer,
  type ItemDrawerMode,
} from "./CollateralItemDrawer";

type Props = {
  loan: Loan;
  loanClosed: boolean;
};

const STATUS_TONE: Record<CollateralStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  released: "neutral",
  archived: "danger",
};

type ItemDrawerState = {
  collateral: Collateral;
  mode: ItemDrawerMode;
  item: CollateralItem | null;
};

export function CollateralsTab({ loan, loanClosed }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<Collateral[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchCollaterals(token, loan.public_id, { perPage: 100 });
    },
    [token, loan.public_id],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    loan.public_id,
  ]);

  const [collateralDrawer, setCollateralDrawer] = useState<{
    mode: CollateralDrawerMode;
    initial: Collateral | null;
  } | null>(null);
  const [itemDrawer, setItemDrawer] = useState<ItemDrawerState | null>(null);

  const money = (minor: number | null, currency: string | null) =>
    minor === null || minor === undefined
      ? "—"
      : format.currencyMinor(minor, { currency: currency ?? "XAF" });

  async function handleCollateralSubmit(payload: CollateralWritePayload) {
    if (!token || !collateralDrawer) return;
    if (collateralDrawer.mode === "create") {
      await createCollateral(token, loan.public_id, payload);
      toast.success(
        t("guarantees.collateral.toast.createdTitle"),
        t("guarantees.collateral.toast.createdBody"),
      );
    } else if (collateralDrawer.initial) {
      await updateCollateral(
        token,
        loan.public_id,
        collateralDrawer.initial.public_id,
        payload,
      );
      toast.success(
        t("guarantees.collateral.toast.updatedTitle"),
        t("guarantees.collateral.toast.updatedBody"),
      );
    }
    setCollateralDrawer(null);
    refetch();
  }

  async function handleItemSubmit(payload: CollateralItemWritePayload) {
    if (!token || !itemDrawer) return;
    if (itemDrawer.mode === "create") {
      await createCollateralItem(
        token,
        loan.public_id,
        itemDrawer.collateral.public_id,
        payload,
      );
      toast.success(
        t("guarantees.item.toast.createdTitle"),
        t("guarantees.item.toast.createdBody"),
      );
    } else if (itemDrawer.item) {
      await updateCollateralItem(
        token,
        loan.public_id,
        itemDrawer.collateral.public_id,
        itemDrawer.item.public_id,
        payload,
      );
      toast.success(
        t("guarantees.item.toast.updatedTitle"),
        t("guarantees.item.toast.updatedBody"),
      );
    }
    setItemDrawer(null);
    refetch();
  }

  async function handleRelease(collateral: Collateral) {
    if (!token) return;
    try {
      await releaseCollateral(token, loan.public_id, collateral.public_id);
      toast.success(
        t("guarantees.collateral.toast.releasedTitle"),
        t("guarantees.collateral.toast.releasedBody"),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("guarantees.collateral.toast.errorTitle"), generalMessage);
    }
  }

  const collaterals = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("guarantees.collateral.intro")}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCollateralDrawer({ mode: "create", initial: null })}
        >
          {t("guarantees.collateral.actions.create")}
        </Button>
      </div>

      {error ? (
        <Alert
          variant="danger"
          title={t("guarantees.collateral.errorTitle")}
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

      {loading && !data ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : collaterals.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          {t("guarantees.collateral.empty")}
        </div>
      ) : (
        collaterals.map((collateral) => {
          const itemActions: DropdownMenuItem[] = [
            {
              label: t("guarantees.collateral.actions.edit"),
              onClick: () =>
                setCollateralDrawer({ mode: "edit", initial: collateral }),
              disabled: collateral.status !== "active",
            },
            {
              label: t("guarantees.collateral.actions.addItem"),
              onClick: () =>
                setItemDrawer({ collateral, mode: "create", item: null }),
              disabled: collateral.status !== "active",
            },
            { kind: "separator" },
            {
              label: t("guarantees.collateral.actions.release"),
              onClick: () => handleRelease(collateral),
              disabled: !loanClosed || collateral.status !== "active",
              destructive: true,
            },
          ];

          return (
            <section
              key={collateral.public_id}
              className="rounded-[var(--radius-card)] border border-border bg-background"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">
                      {t(`guarantees.collateralType.${collateral.collateral_type}`)}
                    </Badge>
                    <Badge tone={STATUS_TONE[collateral.status]}>
                      {t(`guarantees.collateral.status.${collateral.status}`)}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {collateral.description ||
                      t("guarantees.collateral.untitled")}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {collateral.owner_full_name
                      ? t("guarantees.collateral.ownerLine", {
                          owner: collateral.owner_full_name,
                        })
                      : null}
                    {collateral.declared_value_minor !== null
                      ? `${collateral.owner_full_name ? " · " : ""}${t(
                          "guarantees.collateral.valueLine",
                          {
                            value: money(
                              collateral.declared_value_minor,
                              collateral.currency,
                            ),
                          },
                        )}`
                      : null}
                  </p>
                </div>
                <DropdownMenu
                  trigger={<MoreVerticalIcon className="h-4 w-4" />}
                  triggerLabel={t("guarantees.collateral.actions.menu")}
                  items={itemActions}
                  align="right"
                />
              </header>

              <div className="p-4">
                {collateral.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("guarantees.item.empty")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3">
                            {t("guarantees.item.columns.description")}
                          </th>
                          <th className="py-2 pr-3 text-right">
                            {t("guarantees.item.columns.quantity")}
                          </th>
                          <th className="py-2 pr-3">
                            {t("guarantees.item.columns.details")}
                          </th>
                          <th className="py-2 pr-3 text-right">
                            {t("guarantees.item.columns.amount")}
                          </th>
                          <th className="py-2 text-right">
                            {t("guarantees.item.columns.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {collateral.items.map((item) => (
                          <tr
                            key={item.public_id}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="py-2 pr-3 text-foreground">
                              {item.description}
                              {item.reference ? (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({item.reference})
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                              {item.quantity ?? "—"}
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">
                              {itemDetails(item)}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                              {money(item.amount_minor, item.currency)}
                            </td>
                            <td className="py-2 text-right">
                              {collateral.status === "active" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItemDrawer({
                                      collateral,
                                      mode: "edit",
                                      item,
                                    })
                                  }
                                  className="text-xs font-semibold text-accent hover:underline"
                                >
                                  {t("guarantees.item.actions.edit")}
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })
      )}

      {collateralDrawer ? (
        <CollateralDrawer
          open
          mode={collateralDrawer.mode}
          initial={collateralDrawer.initial}
          defaultCurrency={loan.currency}
          onClose={() => setCollateralDrawer(null)}
          onSubmit={handleCollateralSubmit}
        />
      ) : null}

      {itemDrawer ? (
        <CollateralItemDrawer
          open
          mode={itemDrawer.mode}
          collateralType={itemDrawer.collateral.collateral_type}
          initial={itemDrawer.item}
          defaultCurrency={itemDrawer.collateral.currency ?? loan.currency}
          onClose={() => setItemDrawer(null)}
          onSubmit={handleItemSubmit}
        />
      ) : null}
    </div>
  );
}

/** Compact type-specific summary for an item row. */
function itemDetails(item: CollateralItem): string {
  const parts: string[] = [];
  if (item.chassis_number) parts.push(`Châssis ${item.chassis_number}`);
  if (item.registration_number) parts.push(`Immat. ${item.registration_number}`);
  const meta = item.metadata ?? {};
  for (const key of ["title_deed_number", "lot_number", "location", "brand", "model"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
