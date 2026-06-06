"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  BellIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/api/notifications";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { notificationVisual } from "./notification-visuals";

type Props = {
  notification: AppNotification | null;
  loading: boolean;
  error: "load" | "notfound" | null;
  onBack: () => void;
};

/** Render a metadata value as a short readable string; objects are JSON-stringified. */
function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Humanise a snake_case key into a readable label. */
function humanizeKey(value: string): string {
  const cleaned = value.replace(/[._-]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** In-app links only — never send the user to a raw API path. */
function isInAppLink(url: string | null): url is string {
  return !!url && url.startsWith("/") && !url.startsWith("/api");
}

/**
 * Detail pane of the notifications screen. Shows the selected notification's
 * type, body, structured info, any metadata, and a link to the related record.
 * On small screens it replaces the list and offers a "back to list" control.
 */
export function NotificationDetail({ notification, loading, error, onBack }: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline lg:hidden"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      {t("notifications.detail.backToList")}
    </button>
  );

  // States with no content: loading, error, or nothing selected.
  if (!notification) {
    return (
      <section className="flex h-full min-h-0 flex-col rounded-[var(--radius-card)] border border-border bg-background">
        <div className="border-b border-border px-5 py-3">{backButton}</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : error ? (
            <p className="max-w-sm text-sm text-danger">
              {t(
                error === "notfound"
                  ? "notifications.detail.notFound"
                  : "notifications.detail.loadError",
              )}
            </p>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellIcon className="h-6 w-6" />
              </span>
              <p className="max-w-xs text-sm text-muted-foreground">
                {t("notifications.detail.empty")}
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  const visual = notificationVisual(notification.type);
  const unread = !notification.read_at;
  const metadataEntries = notification.metadata
    ? Object.entries(notification.metadata).filter(([, v]) => v !== null && v !== "")
    : [];

  const typeLabelKey = `notifications.type.${visual.labelKey}`;
  const typeLabel = t(typeLabelKey);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        {backButton}
        <span className="hidden text-sm font-semibold text-foreground lg:inline">
          {t("notifications.detail.heading")}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {/* Hero */}
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
              visual.chipClass,
            )}
          >
            <visual.Icon className="h-6 w-6" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-lg font-semibold leading-snug text-foreground">
              {notification.title}
            </h2>
            <span className="text-xs text-muted-foreground">
              {format.dateTime(notification.created_at)}
            </span>
          </div>
        </div>

        {notification.message ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {notification.message}
          </p>
        ) : null}

        {/* Information */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("notifications.detail.sectionInfo")}
          </h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label={t("notifications.detail.fields.type")}>
              <Badge tone={visual.tone}>{typeLabel}</Badge>
            </Field>
            <Field label={t("notifications.detail.fields.status")}>
              <Badge tone={unread ? "accent" : "neutral"}>
                {t(
                  unread
                    ? "notifications.detail.status.unread"
                    : "notifications.detail.status.read",
                )}
              </Badge>
            </Field>
            {notification.category ? (
              <Field label={t("notifications.detail.fields.category")}>
                <span className="text-sm text-foreground">
                  {humanizeKey(notification.category)}
                </span>
              </Field>
            ) : null}
            {notification.agency_public_id ? (
              <Field label={t("notifications.detail.fields.agency")}>
                <span className="font-mono text-sm text-foreground">
                  {notification.agency_public_id}
                </span>
              </Field>
            ) : null}
            <Field label={t("notifications.detail.fields.receivedAt")}>
              <span className="text-sm text-foreground">
                {format.dateTime(notification.created_at)}
              </span>
            </Field>
          </dl>
        </div>

        {/* Metadata */}
        {metadataEntries.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("notifications.detail.sectionMetadata")}
            </h3>
            <dl className="mt-3 divide-y divide-border rounded-[var(--radius-field)] border border-border">
              {metadataEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-4 px-3 py-2"
                >
                  <dt className="text-xs text-muted-foreground">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="break-all text-right text-sm text-foreground">
                    {renderValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* Actions */}
        {isInAppLink(notification.action_url) ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("notifications.detail.sectionActions")}
            </h3>
            <Link href={notification.action_url} className="mt-3 inline-block">
              <Button variant="accent" size="sm">
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                {t("notifications.detail.openLink")}
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}
