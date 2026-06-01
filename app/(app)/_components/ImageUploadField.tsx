"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadDocument } from "@/lib/api/documents";
import { localizeApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { AuthenticatedImage } from "./AuthenticatedImage";

type Props = {
  /** Linked document public_id ("" = none). */
  value: string;
  onChange: (documentPublicId: string) => void;
  /** Document category sent on upload (e.g. "client_profile_photo"). */
  category: string;
  /**
   * Target agency for the uploaded document. Required for platform/institution
   * actors with no current agency, and must match the linked entity's agency
   * (back-issue #11).
   */
  agencyPublicId?: string | null;
  label?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
};

/**
 * Image upload field backed by `POST /documents`. Uploads on file select and
 * reports the resulting document public_id via `onChange`. A previously-linked
 * image (edit mode) is rendered via `AuthenticatedImage` using the
 * `GET /documents/{id}/file` endpoint (back-issues #10/#11).
 */
export function ImageUploadField({
  value,
  onChange,
  category,
  agencyPublicId,
  label,
  hint,
  error,
  disabled,
}: Props) {
  const t = useTranslations();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File) {
    if (!token) return;
    setUploadError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setFileName(file.name);
    setUploading(true);
    try {
      const doc = await uploadDocument(token, file, {
        category,
        title: file.name,
        agencyPublicId,
      });
      onChange(doc.public_id);
    } catch (cause) {
      setUploadError(localizeApiError(cause).generalMessage);
      onChange("");
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setUploadError(null);
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  // Edit mode: a document is linked but no local preview from this session.
  const linkedWithoutPreview = !!value && !previewUrl;

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <span className="text-sm font-medium text-foreground">{label}</span>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-field)] border border-input bg-muted/30">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={fileName ?? ""}
              className="h-full w-full object-cover"
            />
          ) : value ? (
            <AuthenticatedImage
              documentPublicId={value}
              alt={label ?? ""}
              className="h-full w-full object-cover"
              fallback={<PhotoIcon className="h-7 w-7 text-muted-foreground/60" />}
            />
          ) : (
            <PhotoIcon className="h-7 w-7 text-muted-foreground/60" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading
                ? t("common.loading")
                : previewUrl || value
                  ? t("imageUpload.replace")
                  : t("imageUpload.choose")}
            </Button>
            {previewUrl || value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || uploading}
                onClick={clear}
              >
                {t("imageUpload.remove")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {fileName
              ? fileName
              : linkedWithoutPreview
                ? t("imageUpload.linked")
                : t("imageUpload.hint")}
          </p>
        </div>
      </div>

      {uploadError || error ? (
        <p className="text-xs text-danger">{uploadError ?? error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.5-3.5L9 20" />
    </svg>
  );
}
