"use client";

/**
 * « Nous aimerions avoir la possibilité d'avoir un aperçu du spécimen de
 * signature pendant les opérations de caisse notamment les retraits, afin que
 * la caissière puisse comparer immédiatement la signature qui est sur le
 * bordereau avec celle qui a été enregistrée lors de la création du compte »
 * — CORRECTIONS HABISLOAN 14/09/2026, première préoccupation.
 *
 * The picker above it already names the signatory; what the counter cannot do
 * is *see* the stroke. So this shows the scanned specimen itself, next to the
 * picker, for the signature currently selected.
 */
import Image from "next/image";
import { useEffect, useState } from "react";

import type { CustomerAccountSignature } from "@/lib/api/account-signatures";
import { fetchDocumentObjectUrl } from "@/lib/api/documents";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  token: string;
  signature: CustomerAccountSignature | undefined;
};

export function SignatureSpecimenPanel({ token, signature }: Props) {
  const t = useTranslations();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const documentId = signature?.document_public_id ?? null;

  useEffect(() => {
    if (!documentId) {
      setUrl(null);
      setState("idle");
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState("loading");

    fetchDocumentObjectUrl(token, documentId)
      .then((blobUrl) => {
        objectUrl = blobUrl;
        // The teller may have moved to another signature while this was in
        // flight; dropping the late response avoids showing the wrong
        // specimen, which on a withdrawal is the one mistake that matters.
        if (cancelled) return;
        setUrl(blobUrl);
        setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, documentId]);

  if (!signature) return null;

  return (
    <div className="rounded-[var(--radius-field)] border border-border bg-surface-muted/40 p-3 sm:col-span-2">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("cashTx.fields.specimen")}
        </span>
        <span className="text-xs text-muted-foreground">
          {signature.signer_name ?? "—"}
          {signature.captured_on
            ? ` · ${t("cashTx.fields.specimenCapturedOn")} ${signature.captured_on}`
            : ""}
        </span>
      </div>

      {!documentId ? (
        <p className="text-xs text-muted-foreground">
          {t("cashTx.fields.specimenMissing")}
        </p>
      ) : state === "error" ? (
        <p className="text-xs text-danger">
          {t("cashTx.fields.specimenError")}
        </p>
      ) : url ? (
        <div className="relative h-40 w-full overflow-hidden rounded bg-white">
          <Image
            src={url}
            alt={t("cashTx.fields.specimen")}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-contain"
          />
        </div>
      ) : (
        <div className="h-40 w-full animate-pulse rounded bg-surface-muted" />
      )}
    </div>
  );
}
