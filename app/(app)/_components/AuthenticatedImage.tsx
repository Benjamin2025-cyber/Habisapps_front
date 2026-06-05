"use client";

import { useEffect, useState } from "react";
import { fetchDocumentObjectUrl } from "@/lib/api/documents";
import { useSession } from "@/lib/auth/SessionProvider";
import { cn } from "@/lib/cn";

type Props = {
  /** Document public_id to display, or null/"" for the empty state. */
  documentPublicId: string | null | undefined;
  /**
   * A plain, non-authenticated URL (e.g. the signed `profile_photo_thumbnail_url`
   * from issue #6). When present it is rendered directly as `<img src>` — no
   * blob fetch, no per-row round-trip. If it errors (expired/revoked signature)
   * we fall back to the authenticated blob fetch on `documentPublicId`, then to
   * the placeholder. Pass it on list/aggregate views to avoid N auth fetches.
   */
  srcUrl?: string | null;
  alt: string;
  className?: string;
  /** Rendered while the bytes are loading. */
  fallback?: React.ReactNode;
};

/**
 * Renders an image served by the Bearer-authenticated `GET /documents/{id}/file`
 * endpoint (back-issues #10/#11). Because the endpoint needs an Authorization
 * header, we can't point an `<img src>` straight at it — we fetch the bytes as
 * a blob, expose them via an object URL, and revoke that URL on unmount / id
 * change. On 403/404 we fall back to the placeholder rather than a broken image.
 *
 * When a plain `srcUrl` is supplied (a signed thumbnail URL, issue #6) we render
 * it directly and skip the blob dance entirely — only falling back to the
 * authenticated fetch if that signed URL itself fails to load.
 */
export function AuthenticatedImage({
  documentPublicId,
  srcUrl,
  alt,
  className,
  fallback = null,
}: Props) {
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Tracks a signed `srcUrl` that failed to load, so we drop to the blob path.
  const [directFailed, setDirectFailed] = useState(false);

  const useDirect = !!srcUrl && !directFailed;

  useEffect(() => {
    setDirectFailed(false);
  }, [srcUrl]);

  useEffect(() => {
    setFailed(false);
    setUrl(null);
    // Skip the authenticated blob fetch while a plain signed URL is in play.
    if (useDirect || !token || !documentPublicId) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    fetchDocumentObjectUrl(token, documentPublicId)
      .then((next) => {
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, documentPublicId, useDirect]);

  if (useDirect) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={srcUrl as string} alt={alt} className={cn(className)} onError={() => setDirectFailed(true)} />;
  }

  if (!documentPublicId || failed || !url) {
    return <>{fallback}</>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cn(className)} />;
}
