"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Client, KycAction } from "@/lib/api/clients";

type Props = {
  open: boolean;
  client: Client | null;
  /** Action to apply on confirm — only "reject" requires a reason. */
  action: KycAction | null;
  onClose: () => void;
  onSubmit: (payload: {
    action: KycAction;
    reason: string | null;
    comment: string | null;
  }) => Promise<void>;
};

/**
 * Lightweight drawer for KYC actions that need a free-text justification.
 * Used today for `reject` (reason required) and as an optional comment slot
 * for `verify` / `suspend` / `archive` / `submit`.
 */
export function ClientKycReasonDrawer({
  open,
  client,
  action,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setComment("");
    setError(null);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    if (action === "reject" && reason.trim().length === 0) {
      setError(t("clients.kycReason.reasonRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        action,
        reason: action === "reject" ? reason.trim() : null,
        comment: comment.trim().length === 0 ? null : comment.trim(),
      });
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause, {
        reason: t("clients.kycReason.reasonLabel"),
        comment: t("clients.kycReason.commentLabel"),
      });
      setError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const titleKey = action ? `clients.kycReason.title.${action}` : "";
  const introKey = action ? `clients.kycReason.intro.${action}` : "";

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={action ? t(titleKey) : ""}
      description={
        client && action
          ? t(introKey, {
              name:
                `${client.last_name ?? ""} ${client.first_name ?? ""}`.trim() ||
                client.client_reference ||
                "",
            })
          : undefined
      }
      widthClassName="sm:w-[28rem]"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant={action === "reject" ? "danger" : "primary"}
            size="md"
            type="submit"
            form="client-kyc-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("common.confirm")}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <form
        id="client-kyc-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {action === "reject" ? (
          <div>
            <label
              htmlFor="client-kyc-reason"
              className="text-sm font-medium text-foreground"
            >
              {t("clients.kycReason.reasonLabel")}
              <span className="ml-1 text-danger">*</span>
            </label>
            <textarea
              id="client-kyc-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-[var(--radius-field)] border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/10"
              placeholder={t("clients.kycReason.reasonPlaceholder")}
              required
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="client-kyc-comment"
            className="text-sm font-medium text-foreground"
          >
            {t("clients.kycReason.commentLabel")}
          </label>
          <textarea
            id="client-kyc-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-[var(--radius-field)] border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/10"
            placeholder={t("clients.kycReason.commentPlaceholder")}
          />
        </div>
      </form>
    </Drawer>
  );
}
