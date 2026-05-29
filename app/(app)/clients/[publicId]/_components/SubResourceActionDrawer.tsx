"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type ActionKey =
  | "submit"
  | "verify"
  | "reject"
  | "archive"
  | "deactivate"
  | "expire";

type Props<A extends ActionKey> = {
  open: boolean;
  /** Action being applied. */
  action: A | null;
  /** Display label for the target (e.g. "Carte nationale d'identité — ID#1234"). */
  targetLabel: string;
  /** i18n namespace under which `title.{action}` and `intro.{action}` live. */
  i18nNamespace: string;
  onClose: () => void;
  onSubmit: (payload: {
    action: A;
    reason: string | null;
    comment: string | null;
  }) => Promise<void>;
};

/**
 * Shared confirmation drawer for sub-resource state transitions
 * (identity-documents, guarantors, proxies). `reject` requires a `reason`;
 * the rest take an optional comment for audit context.
 */
export function SubResourceActionDrawer<A extends ActionKey>({
  open,
  action,
  targetLabel,
  i18nNamespace,
  onClose,
  onSubmit,
}: Props<A>) {
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
      setError(t("clientDetail.action.reasonRequired"));
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
        reason: t("clientDetail.action.reasonLabel"),
        comment: t("clientDetail.action.commentLabel"),
      });
      setError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const titleKey = action ? `${i18nNamespace}.action.title.${action}` : "";
  const introKey = action ? `${i18nNamespace}.action.intro.${action}` : "";

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={action ? t(titleKey) : ""}
      description={
        action ? t(introKey, { target: targetLabel }) : undefined
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
            form="sub-resource-action-form"
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
        id="sub-resource-action-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {action === "reject" ? (
          <div>
            <label
              htmlFor="sub-resource-reason"
              className="text-sm font-medium text-foreground"
            >
              {t("clientDetail.action.reasonLabel")}
              <span className="ml-1 text-danger">*</span>
            </label>
            <textarea
              id="sub-resource-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-[var(--radius-field)] border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/10"
              placeholder={t("clientDetail.action.reasonPlaceholder")}
              required
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="sub-resource-comment"
            className="text-sm font-medium text-foreground"
          >
            {t("clientDetail.action.commentLabel")}
          </label>
          <textarea
            id="sub-resource-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-[var(--radius-field)] border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/10"
            placeholder={t("clientDetail.action.commentPlaceholder")}
          />
        </div>
      </form>
    </Drawer>
  );
}
