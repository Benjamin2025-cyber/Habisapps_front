"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import {
  fetchDocument,
  fetchDocumentObjectUrl,
  type DocumentRecord,
} from "@/lib/api/documents";
import type { ClientIdentityDocument } from "@/lib/api/client-identity-documents";
import { useSession } from "@/lib/auth/SessionProvider";
import { cn } from "@/lib/cn";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  doc: ClientIdentityDocument | null;
  /** Localised label for the document type code. */
  typeLabel: string;
};

/**
 * Read-only viewer for one KYC document: the scan itself plus its
 * characteristics, opened by clicking the row.
 *
 * « Nous aimerions pouvoir consulter les documents KYC (visuel +
 * caractéristiques) en cliquant sur la ligne. » Both faces are shown when the
 * type has two, because a verification against the person in front of you reads
 * the back as often as the front.
 */
export function IdentityDocumentViewerDrawer({
  open,
  onClose,
  doc,
  typeLabel,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={typeLabel}
      description={doc?.document_number ?? undefined}
      widthClassName="sm:max-w-3xl"
    >
      {doc ? (
        <div className="flex flex-col gap-4">
          <Section title={t("clientDetail.identityDocs.viewer.visual")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DocumentFace
                key={doc.document_public_id ?? "front"}
                documentPublicId={doc.document_public_id}
                label={t("clientDetail.identityDocs.viewer.front")}
              />
              {doc.back_document_public_id ? (
                <DocumentFace
                  key={doc.back_document_public_id}
                  documentPublicId={doc.back_document_public_id}
                  label={t("clientDetail.identityDocs.viewer.back")}
                />
              ) : null}
            </div>
          </Section>

          <Section title={t("clientDetail.identityDocs.viewer.characteristics")}>
            <Grid>
              <Field
                label={t("clientDetail.identityDocs.columns.type")}
                value={typeLabel}
              />
              <Field
                label={t("clientDetail.identityDocs.columns.number")}
                value={doc.document_number}
                mono
              />
              <Field
                label={t("clientDetail.identityDocs.columns.authority")}
                value={doc.issuing_authority}
              />
              <Field
                label={t("clientDetail.identityDocs.columns.status")}
                value={t(
                  `clientDetail.identityDocs.verificationStatus.${doc.verification_status}`,
                )}
              />
              <Field
                label={t("clientDetail.identityDocs.columns.issuedOn")}
                value={doc.issued_on ? format.date(doc.issued_on) : null}
              />
              <Field
                label={t("clientDetail.identityDocs.columns.expiresOn")}
                value={doc.expires_on ? format.date(doc.expires_on) : null}
              />
              <Field
                label={t("clientDetail.identityDocs.viewer.submittedAt")}
                value={doc.submitted_at ? format.dateTime(doc.submitted_at) : null}
              />
              <Field
                label={t("clientDetail.identityDocs.viewer.verifiedAt")}
                value={doc.verified_at ? format.dateTime(doc.verified_at) : null}
              />
              {doc.rejection_reason ? (
                <Field
                  label={t("clientDetail.identityDocs.viewer.rejectionReason")}
                  value={doc.rejection_reason}
                  wide
                />
              ) : null}
            </Grid>
          </Section>
        </div>
      ) : null}
    </Drawer>
  );
}

/**
 * One face of the document. Fetches the metadata first: a KYC upload may be a
 * PDF as well as a JPEG/PNG, and an `<img>` pointed at a PDF renders as a
 * broken image rather than as the document somebody is trying to verify.
 */
function DocumentFace({
  documentPublicId,
  label,
}: {
  documentPublicId: string | null;
  label: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [meta, setMeta] = useState<DocumentRecord | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  // Starts loading: the component is keyed on the document id, so a different
  // face remounts rather than reusing this state. Nothing is set synchronously
  // inside the effect, which would cascade a render.
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!token || !documentPublicId) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    Promise.all([
      fetchDocument(token, documentPublicId),
      fetchDocumentObjectUrl(token, documentPublicId),
    ])
      .then(([record, blobUrl]) => {
        objectUrl = blobUrl;
        if (cancelled) return;
        setMeta(record);
        setUrl(blobUrl);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
      // Revoking on unmount / id change: the bytes are held in memory until we do.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, documentPublicId]);

  const frame =
    "flex h-64 items-center justify-center overflow-hidden rounded-[var(--radius-field)] border border-border bg-muted/30";

  if (!documentPublicId) {
    return (
      <Faced label={label}>
        <div className={cn(frame, "text-xs text-muted-foreground")}>
          {t("clientDetail.identityDocs.viewer.noFile")}
        </div>
      </Faced>
    );
  }

  const isPdf = meta?.mime_type === "application/pdf";

  return (
    <Faced label={label}>
      <div className={frame}>
        {state === "loading" ? (
          <span className="text-xs text-muted-foreground">
            {t("clientDetail.identityDocs.viewer.loading")}
          </span>
        ) : state === "error" || !url ? (
          <span className="text-xs text-muted-foreground">
            {t("clientDetail.identityDocs.viewer.unavailable")}
          </span>
        ) : isPdf ? (
          <object data={url} type="application/pdf" className="h-full w-full">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline"
            >
              {t("clientDetail.identityDocs.viewer.openFile")}
            </a>
          </object>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      {meta ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {[
            meta.original_name,
            meta.mime_type,
            meta.size_bytes != null
              ? `${Math.max(1, Math.round(meta.size_bytes / 1024))} kB`
              : null,
            meta.created_at ? format.date(meta.created_at) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] underline text-muted-foreground hover:text-foreground"
        >
          {t("clientDetail.identityDocs.viewer.openFile")}
        </a>
      ) : null}
    </Faced>
  );
}

function Faced({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <header className="border-b border-border border-l-4 border-l-accent bg-accent/5 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {children}
    </dl>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn("text-sm text-foreground", mono && "font-mono tabular-nums")}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
