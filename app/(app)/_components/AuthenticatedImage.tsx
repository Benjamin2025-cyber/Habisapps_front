"use client";

import { useEffect, useState } from "react";
import { fetchDocumentObjectUrl } from "@/lib/api/documents";
import { useSession } from "@/lib/auth/SessionProvider";
import { cn } from "@/lib/cn";

type Props = {
  /** Document public_id to display, or null/"" for the empty state. */
  documentPublicId: string | null | undefined;
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
 */
export function AuthenticatedImage({
  documentPublicId,
  alt,
  className,
  fallback = null,
}: Props) {
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setUrl(null);
    if (!token || !documentPublicId) return;

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
  }, [token, documentPublicId]);

  if (!documentPublicId || failed || !url) {
    return <>{fallback}</>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cn(className)} />;
}
