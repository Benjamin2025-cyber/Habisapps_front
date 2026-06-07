"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PasswordField } from "@/components/ui/PasswordField";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  cancelDatabaseRestore,
  executeDatabaseRestore,
  planDatabaseRestore,
  type DatabaseBackup,
  type RestoreMode,
  type RestorePlan,
  type RestoreTarget,
} from "@/lib/api/database";
import { localizeApiError } from "@/lib/api/errors";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  open: boolean;
  token: string | null;
  backup: DatabaseBackup | null;
  canExecute: boolean;
  onClose: () => void;
  onDone: () => void;
};

type Step = "configure" | "confirm";

/**
 * Restore is a two-phase, step-up-authenticated flow:
 *   1. configure — pick target + mode (+ optional confirmation phrase) → `plan`
 *   2. confirm — review the plan, re-enter the password → `execute`
 * The user can abandon a created plan via `cancel`. `replace` on the live
 * database is destructive; we gate it behind explicit warnings.
 */
export function RestoreDrawer({
  open,
  token,
  backup,
  canExecute,
  onClose,
  onDone,
}: Props) {
  const t = useTranslations("database.restoreDrawer");
  const toast = useToast();
  const format = useFormatter();

  const [step, setStep] = useState<Step>("configure");
  const [target, setTarget] = useState<RestoreTarget>("same_database");
  const [mode, setMode] = useState<RestoreMode>("dry_run");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State resets between backups because the parent remounts this component
  // with a `key` tied to the selected backup id — no reset effect needed.

  const targetOptions = [
    { value: "same_database", label: t("target.same_database") },
    { value: "staging_database", label: t("target.staging_database") },
    { value: "external_database", label: t("target.external_database") },
  ];
  const modeOptions = [
    { value: "dry_run", label: t("mode.dry_run") },
    { value: "verify_only", label: t("mode.verify_only") },
    { value: "replace", label: t("mode.replace") },
  ];

  const isDestructive = mode === "replace";

  function close() {
    if (submitting) return;
    onClose();
  }

  async function handlePlan() {
    if (!token || !backup) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await planDatabaseRestore(token, {
        backup_public_id: backup.public_id,
        target,
        mode,
        confirmation_phrase: confirmationPhrase || undefined,
      });
      setPlan(result.plan);
      setPlanId(result.restore_operation.public_id);
      setStep("confirm");
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      setError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExecute() {
    if (!token || !planId) return;
    setSubmitting(true);
    setError(null);
    try {
      await executeDatabaseRestore(token, planId, password);
      toast.success(t("execToastTitle"), t("execToastBody"));
      onDone();
      onClose();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      setError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelPlan() {
    if (!token || !planId) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await cancelDatabaseRestore(token, planId);
      toast.info(t("cancelToastTitle"), t("cancelToastBody"));
      onDone();
      onClose();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      setError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const footer =
    step === "configure" ? (
      <>
        <Button variant="ghost" onClick={close} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button variant="primary" onClick={handlePlan} disabled={submitting || !backup}>
          {submitting ? t("planning") : t("planButton")}
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={handleCancelPlan} disabled={submitting}>
          {t("cancelPlan")}
        </Button>
        <Button
          variant={isDestructive ? "danger" : "primary"}
          onClick={handleExecute}
          disabled={submitting || !canExecute || password.length === 0}
        >
          {submitting ? t("executing") : t("executeButton")}
        </Button>
      </>
    );

  return (
    <Drawer
      open={open}
      onClose={close}
      title={t("title")}
      description={backup ? backup.filename : undefined}
      footer={footer}
    >
      {step === "configure" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("intro")}</p>

          <Select
            id="restore-target"
            label={t("targetLabel")}
            options={targetOptions}
            value={target}
            isSearchable={false}
            onChange={(value) => setTarget(value as RestoreTarget)}
          />
          <Select
            id="restore-mode"
            label={t("modeLabel")}
            options={modeOptions}
            value={mode}
            isSearchable={false}
            hint={t(`modeHint.${mode}`)}
            onChange={(value) => setMode(value as RestoreMode)}
          />

          <TextField
            id="restore-phrase"
            name="confirmation_phrase"
            label={t("phraseLabel")}
            placeholder={t("phrasePlaceholder")}
            value={confirmationPhrase}
            hint={t("phraseHint")}
            onChange={(event) => setConfirmationPhrase(event.target.value)}
          />

          {isDestructive ? (
            <Alert variant="danger" title={t("destructiveTitle")}>
              {t("destructiveBody")}
            </Alert>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Alert
            variant={plan?.destructive ? "danger" : "info"}
            title={t("planReadyTitle")}
          >
            {plan?.destructive ? t("planDestructive") : t("planSafe")}
          </Alert>

          <dl className="flex flex-col gap-2 rounded-[var(--radius-field)] border border-border bg-muted/20 p-4 text-sm">
            <Row label={t("summaryTarget")} value={t(`target.${target}`)} />
            <Row label={t("summaryMode")} value={t(`mode.${mode}`)} />
            {plan?.expires_at ? (
              <Row
                label={t("summaryExpires")}
                value={format.dateTime(plan.expires_at)}
              />
            ) : null}
          </dl>

          {!canExecute ? (
            <Alert variant="warning">{t("noExecutePermission")}</Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("stepUpIntro")}</p>
              <PasswordField
                id="restore-password"
                name="password"
                label={t("passwordLabel")}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </>
          )}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      )}
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
