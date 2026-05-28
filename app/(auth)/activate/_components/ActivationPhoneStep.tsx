"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PhoneIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api/client";
import { localizeApiMessage, localizeFieldError } from "@/lib/api/errors";
import { resendActivationOtpRequest } from "@/lib/auth/api";
import { useCountdown, useCountdownFormatter } from "@/lib/hooks/useCountdown";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { normalizePhone } from "@/lib/phone";

type Props = {
  initialPhone: string;
  onSubmitted: (phone: string) => void;
};

type FormErrorState =
  | { kind: "none" }
  | { kind: "message"; message: string }
  | { kind: "rateLimit"; retryAfter: number };

export function ActivationPhoneStep({ initialPhone, onSubmitted }: Props) {
  const t = useTranslations();
  const formatCountdown = useCountdownFormatter();
  const [phone, setPhone] = useState(initialPhone);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormErrorState>({ kind: "none" });
  const [fieldError, setFieldError] = useState<string | undefined>();

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
    setFieldError(undefined);
    setSubmitting(true);
    const normalized = normalizePhone(phone);
    try {
      await resendActivationOtpRequest({ phone_number: normalized });
      onSubmitted(normalized);
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
          if (phoneFieldError) setFieldError(phoneFieldError);
          else
            setFormError({
              kind: "message",
              message: localizeApiMessage(cause.message),
            });
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {t("auth.activate.phoneStep.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.activate.phoneStep.intro")}
        </p>
      </header>

      {formError.kind === "message" ? (
        <Alert variant="danger" title={t("auth.activate.phoneStep.errorTitle")}>
          {formError.message}
        </Alert>
      ) : null}

      {formError.kind === "rateLimit" ? (
        <Alert variant="warning" title={t("auth.shared.rateLimitTitle")}>
          {t("auth.shared.rateLimitBody", { time: formatCountdown(remaining) })}
        </Alert>
      ) : null}

      <TextField
        id="phone"
        name="phone"
        label={t("auth.shared.phoneLabel")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        autoFocus
        placeholder={t("auth.shared.phonePlaceholder")}
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fieldError}
        trailing={<PhoneIcon className="h-5 w-5" />}
      />

      <Button
        type="submit"
        size="lg"
        disabled={submitting || phone.trim().length === 0 || rateLimited}
      >
        {rateLimited
          ? t("common.retryIn", { time: formatCountdown(remaining) })
          : submitting
            ? t("auth.activate.phoneStep.submitting")
            : t("auth.activate.phoneStep.submit")}
      </Button>
    </form>
  );
}
