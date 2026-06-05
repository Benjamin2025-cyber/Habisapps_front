"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { PhoneIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api/client";
import { localizeApiMessage, localizeFieldError } from "@/lib/api/errors";
import {
  requestPasswordResetOtpRequest,
  resetPasswordRequest,
} from "@/lib/auth/api";
import { useCountdown, useCountdownFormatter } from "@/lib/hooks/useCountdown";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { maskPhoneNumber, normalizePhone } from "@/lib/phone";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  initialPhone: string;
};

const RESEND_COOLDOWN_SECONDS = 60;

type FormErrorState =
  | { kind: "none" }
  | { kind: "message"; message: string }
  | { kind: "rateLimit"; retryAfter: number };

export function ResetPasswordForm({ initialPhone }: Props) {
  const t = useTranslations();
  const formatCountdown = useCountdownFormatter();
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState<number>(
    initialPhone ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const [formError, setFormError] = useState<FormErrorState>({ kind: "none" });
  const [fieldErrors, setFieldErrors] = useState<{
    phone?: string;
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
      await resetPasswordRequest({
        phone_number: normalizePhone(phone),
        otp,
        password,
        password_confirmation: confirm,
      });
      router.replace("/login?reset=success");
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.isRateLimited() && cause.retryAfter !== null) {
          setFormError({ kind: "rateLimit", retryAfter: cause.retryAfter });
        } else {
          const phoneFieldError = localizeFieldError(
            cause,
            "phone_number",
            t("auth.shared.phoneLabel"),
          );
          const otpFieldError = localizeFieldError(
            cause,
            "otp",
            t("auth.shared.otpAriaLabelReset"),
          );
          const passwordFieldError = localizeFieldError(
            cause,
            "password",
            t("auth.shared.newPasswordLabel"),
          );
          if (phoneFieldError || otpFieldError || passwordFieldError) {
            setFieldErrors({
              phone: phoneFieldError ?? undefined,
              otp: otpFieldError ?? undefined,
              password: passwordFieldError ?? undefined,
            });
          } else {
            setFormError({
              kind: "message",
              message: localizeApiMessage(cause.message),
            });
          }
        }
      } else {
        setFormError({
          kind: "message",
          message:
            cause instanceof Error
              ? localizeApiMessage(cause.message)
              : t("common.unknownError"),
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
      await requestPasswordResetOtpRequest({ phone_number: normalizePhone(phone) });
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
          cause instanceof Error
            ? localizeApiMessage(cause.message)
            : t("common.unknownError"),
        );
      }
    } finally {
      setResending(false);
    }
  }

  const canSubmit =
    phone.trim().length > 0 &&
    otp.length === 6 &&
    password.length > 0 &&
    confirm.length > 0 &&
    !submitting &&
    !rateLimited;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {t("auth.resetPassword.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {initialPhone
            ? t("auth.resetPassword.introWithPhone", { phone: maskPhoneNumber(initialPhone) })
            : t("auth.resetPassword.introWithoutPhone")}
        </p>
      </header>

      {formError.kind === "message" ? (
        <Alert variant="danger" title={t("auth.resetPassword.errorTitle")}>
          {formError.message}
        </Alert>
      ) : null}

      {formError.kind === "rateLimit" ? (
        <Alert variant="warning" title={t("auth.shared.rateLimitTitle")}>
          {t("auth.shared.rateLimitBody", { time: formatCountdown(remaining) })}
        </Alert>
      ) : null}

      {!initialPhone ? (
        <TextField
          id="phone"
          name="phone"
          label={t("auth.shared.phoneLabel")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder={t("auth.shared.phonePlaceholder")}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldErrors.phone}
          trailing={<PhoneIcon className="h-5 w-5" />}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <OtpInput
          value={otp}
          onChange={setOtp}
          autoFocus
          invalid={Boolean(fieldErrors.otp)}
          ariaLabel={t("auth.shared.otpAriaLabelReset")}
        />
        {fieldErrors.otp ? (
          <p className="text-center text-xs text-danger">{fieldErrors.otp}</p>
        ) : null}

        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>{t("auth.shared.otpNotReceived")}</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0 || resending || phone.trim().length === 0 || rateLimited}
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
          placeholder={t("auth.shared.newPasswordPlaceholderReset")}
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
            ? t("auth.resetPassword.submitting")
            : t("auth.resetPassword.submit")}
      </Button>
    </form>
  );
}
