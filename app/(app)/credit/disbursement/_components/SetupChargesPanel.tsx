"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { localizeApiError } from "@/lib/api/errors";
import {
  assessSetupCharges,
  collectInsurancePremium,
  collectSetupCharge,
  decideSetupChargeException,
  isSetupChargeSettled,
  type InsurancePremiumAssessment,
  type SetupCharge,
  type SetupChargePaymentSource,
} from "@/lib/api/loan-setup-charges";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Option = { value: string; label: string };

type Props = {
  loanPublicId: string | null;
  active: boolean;
  currency: string;
  accountOptions: ReadonlyArray<Option>;
  sessionOptions: ReadonlyArray<Option>;
  /** Reports whether all charges + insurance are settled (gates disbursement). */
  onSettledChange: (allSettled: boolean) => void;
};

export function SetupChargesPanel({
  loanPublicId,
  active,
  currency,
  accountOptions,
  sessionOptions,
  onSettledChange,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const directionPerm = useCanAny(["loans.approvals.direction"]);
  const canWaive = isPlatformAdmin || directionPerm;

  const [charges, setCharges] = useState<SetupCharge[]>([]);
  const [insurance, setInsurance] = useState<InsurancePremiumAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Shared collection controls.
  const [paymentSource, setPaymentSource] =
    useState<SetupChargePaymentSource>("customer_account");
  const [accountId, setAccountId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Direction waiver inline state.
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveComments, setWaiveComments] = useState("");

  const load = useCallback(async () => {
    if (!token || !loanPublicId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await assessSetupCharges(token, loanPublicId);
      setCharges(result.charges);
      setInsurance(result.insurance_premium_assessment);
      setLoaded(true);
    } catch (cause) {
      setLoadError(localizeApiError(cause).generalMessage);
    } finally {
      setLoading(false);
    }
  }, [token, loanPublicId]);

  useEffect(() => {
    if (!active || !loanPublicId) {
      setCharges([]);
      setInsurance(null);
      setLoaded(false);
      setLoadError(null);
      setRowError(null);
      setWaivingId(null);
      return;
    }
    setLoaded(false);
    void load();
  }, [active, loanPublicId, load]);

  const allSettled = useMemo(() => {
    const chargesOk = charges.every((c) => isSetupChargeSettled(c.status));
    const insuranceOk = !insurance || isSetupChargeSettled(insurance.status);
    return chargesOk && insuranceOk;
  }, [charges, insurance]);

  const pendingCount = useMemo(
    () =>
      charges.filter((c) => !isSetupChargeSettled(c.status)).length +
      (insurance && !isSetupChargeSettled(insurance.status) ? 1 : 0),
    [charges, insurance],
  );

  useEffect(() => {
    onSettledChange(loaded && allSettled);
  }, [loaded, allSettled, onSettledChange]);

  function money(minor: number): string {
    return format.currencyMinor(minor, { currency });
  }

  function statusTone(status: string): "success" | "warning" {
    return isSetupChargeSettled(status) ? "success" : "warning";
  }

  function chargeLabel(type: string): string {
    const key = `disbursement.setupCharges.types.${type}`;
    const label = t(key);
    return label === key ? type : label;
  }

  async function settleCharge(charge: SetupCharge) {
    if (!token || !loanPublicId) return;
    if (paymentSource === "customer_account" && !accountId) {
      setRowError(t("disbursement.setupCharges.needSource"));
      return;
    }
    if (paymentSource === "teller_cash" && !sessionId) {
      setRowError(t("disbursement.setupCharges.needSource"));
      return;
    }
    setBusyId(charge.public_id);
    setRowError(null);
    try {
      await collectSetupCharge(token, loanPublicId, charge.public_id, {
        payment_source: paymentSource,
        customer_account_public_id:
          paymentSource === "customer_account" ? accountId : null,
        teller_session_public_id:
          paymentSource === "teller_cash" ? sessionId : null,
      });
      toast.success(t("disbursement.setupCharges.settledToast"));
      await load();
    } catch (cause) {
      setRowError(localizeApiError(cause).generalMessage);
    } finally {
      setBusyId(null);
    }
  }

  async function settleInsurance(item: InsurancePremiumAssessment) {
    if (!token || !loanPublicId) return;
    if (!accountId) {
      setRowError(t("disbursement.setupCharges.needSource"));
      return;
    }
    setBusyId(item.public_id);
    setRowError(null);
    try {
      await collectInsurancePremium(token, loanPublicId, item.public_id, {
        customer_account_public_id: accountId,
      });
      toast.success(t("disbursement.setupCharges.settledToast"));
      await load();
    } catch (cause) {
      setRowError(localizeApiError(cause).generalMessage);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmWaive(charge: SetupCharge) {
    if (!token || !loanPublicId || waiveComments.trim().length === 0) return;
    setBusyId(charge.public_id);
    setRowError(null);
    try {
      await decideSetupChargeException(token, loanPublicId, charge.public_id, {
        decision: "waive",
        comments: waiveComments.trim(),
      });
      toast.success(t("disbursement.setupCharges.settledToast"));
      setWaivingId(null);
      setWaiveComments("");
      await load();
    } catch (cause) {
      setRowError(localizeApiError(cause).generalMessage);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <p className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t("disbursement.setupCharges.loading")}
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
        {loadError}
      </div>
    );
  }

  const hasItems = charges.length > 0 || insurance !== null;
  if (!hasItems) {
    return (
      <p className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t("disbursement.setupCharges.none")}
      </p>
    );
  }

  const canWaiveType = (type: string) =>
    type === "dossier_fee" || type === "dossier_fee_tax";

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("disbursement.setupCharges.title")}
        </span>
        <span className="text-[0.7rem] text-muted-foreground">
          {t("disbursement.setupCharges.intro")}
        </span>
      </div>

      {/* Shared collection controls (used by every "Régler") */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          label={t("disbursement.setupCharges.paymentSource")}
          value={paymentSource}
          options={[
            {
              value: "customer_account",
              label: t("disbursement.setupCharges.sourceAccount"),
            },
            {
              value: "teller_cash",
              label: t("disbursement.setupCharges.sourceCash"),
            },
          ]}
          onChange={(next) => setPaymentSource(next as SetupChargePaymentSource)}
        />
        {paymentSource === "customer_account" ? (
          <Select
            label={t("disbursement.setupCharges.account")}
            value={accountId}
            options={accountOptions as Option[]}
            placeholder={t("disbursement.setupCharges.accountPlaceholder")}
            onChange={setAccountId}
            hint={
              accountOptions.length === 0
                ? t("disbursement.setupCharges.noAccounts")
                : undefined
            }
          />
        ) : (
          <Select
            label={t("disbursement.setupCharges.session")}
            value={sessionId}
            options={sessionOptions as Option[]}
            placeholder={t("disbursement.setupCharges.sessionPlaceholder")}
            onChange={setSessionId}
            hint={
              sessionOptions.length === 0
                ? t("disbursement.setupCharges.noSessions")
                : undefined
            }
          />
        )}
      </div>
      {paymentSource === "teller_cash" ? (
        <p className="text-[0.7rem] text-muted-foreground">
          {t("disbursement.setupCharges.insuranceAccountOnly")}
        </p>
      ) : null}

      {rowError ? (
        <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-1.5 text-xs text-danger">
          {rowError}
        </p>
      ) : null}

      {/* Charge rows */}
      <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-field)] border border-border">
        {charges.map((c) => {
          const settled = isSetupChargeSettled(c.status);
          const isWaiving = waivingId === c.public_id;
          return (
            <li key={c.public_id} className="flex flex-col gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {chargeLabel(c.charge_type)}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {money(c.assessed_amount_minor)}
                </span>
                <Badge tone={statusTone(c.status)}>
                  {t(`disbursement.setupCharges.status.${c.status}`)}
                </Badge>
              </div>
              {!settled ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => settleCharge(c)}
                  >
                    {busyId === c.public_id
                      ? t("disbursement.setupCharges.settling")
                      : t("disbursement.setupCharges.settle")}
                  </Button>
                  {canWaive && canWaiveType(c.charge_type) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() => {
                        setWaivingId(isWaiving ? null : c.public_id);
                        setWaiveComments("");
                      }}
                    >
                      {t("disbursement.setupCharges.waive")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {isWaiving ? (
                <div className="flex flex-col gap-2 rounded-[var(--radius-field)] border border-border bg-muted/30 p-2">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("disbursement.setupCharges.waiveTitle")}
                  </span>
                  <textarea
                    value={waiveComments}
                    onChange={(e) => setWaiveComments(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder={t("disbursement.setupCharges.waiveComments")}
                    className="rounded-[var(--radius-field)] border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() => {
                        setWaivingId(null);
                        setWaiveComments("");
                      }}
                    >
                      {t("disbursement.setupCharges.waiveCancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyId !== null || waiveComments.trim().length === 0}
                      onClick={() => confirmWaive(c)}
                    >
                      {t("disbursement.setupCharges.waiveConfirm")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}

        {insurance ? (
          <li className="flex flex-col gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {t("disbursement.setupCharges.insurance")}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {money(insurance.premium_amount_minor)}
              </span>
              <Badge tone={statusTone(insurance.status)}>
                {t(`disbursement.setupCharges.status.${insurance.status}`)}
              </Badge>
            </div>
            {!isSetupChargeSettled(insurance.status) ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => settleInsurance(insurance)}
                >
                  {busyId === insurance.public_id
                    ? t("disbursement.setupCharges.settling")
                    : t("disbursement.setupCharges.settle")}
                </Button>
                <span className="text-[0.7rem] text-muted-foreground">
                  {t("disbursement.setupCharges.insuranceAccountOnly")}
                </span>
              </div>
            ) : null}
          </li>
        ) : null}
      </ul>

      <p
        className={`text-xs ${allSettled ? "text-success" : "text-warning"}`}
      >
        {allSettled
          ? t("disbursement.setupCharges.allSettled")
          : t("disbursement.setupCharges.pending", { count: pendingCount })}
      </p>
    </section>
  );
}
