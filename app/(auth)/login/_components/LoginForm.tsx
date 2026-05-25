"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { PhoneIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api/client";
import { loginRequest } from "@/lib/auth/api";
import { useSession } from "@/lib/auth/SessionProvider";
import { useCountdown, useCountdownFormatter } from "@/lib/hooks/useCountdown";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { normalizePhone } from "@/lib/phone";
import { useToast } from "@/lib/toast/ToastProvider";

type FormErrorState =
  | { kind: "none" }
  | { kind: "message"; message: string }
  | { kind: "rateLimit"; retryAfter: number };

export function LoginForm() {
  const t = useTranslations();
  const formatCountdown = useCountdownFormatter();
  const router = useRouter();
  const { signIn } = useSession();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormErrorState>({ kind: "none" });
  const [fieldErrors, setFieldErrors] = useState<{
    phone?: string;
    password?: string;
  }>({});

  const rateLimitTarget = useMemo(
    () => (formError.kind === "rateLimit" ? formError.retryAfter : null),
    [formError],
  );
  const remaining = useCountdown(rateLimitTarget);
  const rateLimited = formError.kind === "rateLimit" && remaining > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rateLimited) return;
    setFormError({ kind: "none" });
    setFieldErrors({});
    setSubmitting(true);
    try {
      const response = await loginRequest({
        phone_number: normalizePhone(phone),
        password,
      });
      signIn({ token: response.token, user: response.user });
      toast.success(
        t("auth.login.successToastTitle"),
        t("auth.login.successToastBody", { name: response.user.name.split(" ")[0] }),
      );
      router.replace("/dashboard");
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.isRateLimited() && cause.retryAfter !== null) {
          setFormError({ kind: "rateLimit", retryAfter: cause.retryAfter });
        } else {
          const phoneFieldError = cause.fieldError("phone_number");
          const passwordFieldError = cause.fieldError("password");
          if (phoneFieldError || passwordFieldError) {
            setFieldErrors({
              phone: phoneFieldError ?? undefined,
              password: passwordFieldError ?? undefined,
            });
          } else {
            setFormError({ kind: "message", message: cause.message });
          }
        }
      } else {
        toast.error(
          t("auth.login.errorTitle"),
          cause instanceof Error ? cause.message : t("common.networkError"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    submitting || phone.length === 0 || password.length === 0 || rateLimited;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <h1 className="text-3xl font-extrabold tracking-tight text-primary">
        {t("auth.login.heading")}
      </h1>

      {formError.kind === "message" ? (
        <Alert variant="danger" title={t("auth.login.errorTitle")}>
          {formError.message}
        </Alert>
      ) : null}

      {formError.kind === "rateLimit" ? (
        <Alert variant="warning" title={t("auth.shared.rateLimitTitle")}>
          {t("auth.shared.rateLimitBody", { time: formatCountdown(remaining) })}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-5">
        <TextField
          id="phone"
          name="phone"
          label={t("auth.shared.phoneLabel")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder={t("auth.login.phonePlaceholder")}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldErrors.phone}
          trailing={<PhoneIcon className="h-5 w-5" />}
        />

        <PasswordField
          id="password"
          name="password"
          label={t("auth.shared.passwordLabel")}
          autoComplete="current-password"
          required
          placeholder={t("auth.login.passwordPlaceholder")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          trailing={
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t("auth.login.forgotPassword")}
            </Link>
          }
        />
      </div>

      <Button type="submit" size="lg" disabled={submitDisabled}>
        {rateLimited
          ? t("common.retryIn", { time: formatCountdown(remaining) })
          : submitting
            ? t("auth.login.submitting")
            : t("auth.login.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.login.firstLoginPrompt")}{" "}
        <Link
          href="/activate"
          className="font-semibold text-accent hover:underline"
        >
          {t("auth.login.activateLink")}
        </Link>
      </p>
    </form>
  );
}
