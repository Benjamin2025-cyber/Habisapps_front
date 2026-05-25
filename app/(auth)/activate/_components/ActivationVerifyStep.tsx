"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { OtpInput } from "@/components/ui/OtpInput";
import { ApiError } from "@/lib/api/client";
import { activateRequest, resendActivationOtpRequest } from "@/lib/auth/api";
import { useCountdown, useCountdownFormatter } from "@/lib/hooks/useCountdown";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { maskPhoneNumber } from "@/lib/phone";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  phone: string;
  onBack: () => void;
  onSuccess: () => void;
};

const RESEND_COOLDOWN_SECONDS = 60;

type FormErrorState =
  | { kind: "none" }
  | { kind: "message"; message: string }
  | { kind: "rateLimit"; retryAfter: number };

export function ActivationVerifyStep({ phone, onBack, onSuccess }: Props) {
  const t = useTranslations();
  const formatCountdown = useCountdownFormatter();
  const toast = useToast();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState<number>(RESEND_COOLDOWN_SECONDS);
  const [formError, setFormError] = useState<FormErrorState>({ kind: "none" });
  const [fieldErrors, setFieldErrors] = useState<{
    otp?: string;
    password?: string;
  }>({});

  const rateLimitTarget = useMemo(
    () => (formError.kind === "rateLimit" ? formError.retryAfter : null),
    [formError],
  );
  const remaining = useCountdown(rateLimitTarget);
  const rateLimited = formError.kind === "rateLimit" && remaining > 0;

  useEffect(() => {
    if (resendIn <= 0) return;
    const interval = window.setInterval(() => {
      setResendIn((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendIn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rateLimited) return;
    setFormError({ kind: "none" });
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ password: t("auth.shared.passwordsDontMatch") });
      return;
    }
    setSubmitting(true);
    try {
      await activateRequest({ phone_number: phone, otp, password });
      onSuccess();
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.isRateLimited() && cause.retryAfter !== null) {
          setFormError({ kind: "rateLimit", retryAfter: cause.retryAfter });
        } else {
          const otpFieldError = cause.fieldError("otp");
          const passwordFieldError = cause.fieldError("password");
          if (otpFieldError || passwordFieldError) {
            setFieldErrors({
              otp: otpFieldError ?? undefined,
              password: passwordFieldError ?? undefined,
            });
          } else {
            setFormError({ kind: "message", message: cause.message });
          }
        }
      } else {
        setFormError({
          kind: "message",
          message: cause instanceof Error ? cause.message : t("common.unknownError"),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setFormError({ kind: "none" });
    setResending(true);
    try {
      await resendActivationOtpRequest({ phone_number: phone });
      setResendIn(RESEND_COOLDOWN_SECONDS);
      toast.success(
        t("auth.shared.resendToast.successTitle"),
        t("auth.shared.resendToast.successBody"),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.isRateLimited() && cause.retryAfter !== null) {
        setFormError({ kind: "rateLimit", retryAfter: cause.retryAfter });
      } else {
        toast.error(
          t("auth.shared.resendToast.errorTitle"),
          cause instanceof Error ? cause.message : t("common.unknownError"),
        );
      }
    } finally {
      setResending(false);
    }
  }

  const canSubmit =
    otp.length === 6 &&
    password.length > 0 &&
    confirm.length > 0 &&
    !submitting &&
    !rateLimited;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {t("auth.activate.verifyStep.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.activate.verifyStep.introWithPhone", { phone: maskPhoneNumber(phone) })}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="self-start text-xs font-semibold text-accent hover:underline"
        >
          {t("auth.activate.verifyStep.changePhone")}
        </button>
      </header>

      {formError.kind === "message" ? (
        <Alert variant="danger" title={t("auth.activate.verifyStep.errorTitle")}>
          {formError.message}
        </Alert>
      ) : null}

      {formError.kind === "rateLimit" ? (
        <Alert variant="warning" title={t("auth.shared.rateLimitTitle")}>
          {t("auth.shared.rateLimitBody", { time: formatCountdown(remaining) })}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <OtpInput
          value={otp}
          onChange={setOtp}
          autoFocus
          invalid={Boolean(fieldErrors.otp)}
          ariaLabel={t("auth.shared.otpAriaLabelActivation")}
        />
        {fieldErrors.otp ? (
          <p className="text-center text-xs text-danger">{fieldErrors.otp}</p>
        ) : null}

        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>{t("auth.shared.otpNotReceived")}</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0 || resending}
            className="font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground/70 disabled:no-underline"
          >
            {resending
              ? t("auth.shared.resending")
              : resendIn > 0
                ? t("auth.shared.resendIn", { seconds: resendIn })
                : t("auth.shared.resendCode")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <PasswordField
          id="password"
          name="password"
          label={t("auth.shared.newPasswordLabel")}
          autoComplete="new-password"
          required
          placeholder={t("auth.shared.newPasswordPlaceholder")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          hint={t("common.passwordHint")}
        />
        <PasswordField
          id="confirm"
          name="confirm"
          label={t("auth.shared.confirmPasswordLabel")}
          autoComplete="new-password"
          required
          placeholder={t("auth.shared.confirmPasswordPlaceholder")}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>

      <Button type="submit" size="lg" disabled={!canSubmit}>
        {rateLimited
          ? t("common.retryIn", { time: formatCountdown(remaining) })
          : submitting
            ? t("auth.activate.verifyStep.submitting")
            : t("auth.activate.verifyStep.submit")}
      </Button>
    </form>
  );
}
