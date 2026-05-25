"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "@/components/ui/icons";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { flatNavItems } from "./nav-config";

/**
 * Builds the breadcrumb trail from the current pathname by matching each
 * cumulative segment against the nav config. Unknown segments fall back to
 * a humanized version of the URL piece.
 */
export function Breadcrumbs() {
  const t = useTranslations();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const items = flatNavItems();
  const trail: Array<{ href: string; label: string }> = [];

  let cursor = "";
  for (const segment of segments) {
    cursor += `/${segment}`;
    const match = items.find((item) => item.href === cursor);
    const label = match
      ? t(`shell.sidebar.items.${match.labelKey}`)
      : humanize(segment);
    trail.push({ href: cursor, label });
  }

  return (
    <nav aria-label="Breadcrumbs" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            {t("shell.breadcrumbs.home")}
          </Link>
        </li>
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={entry.href} className="flex items-center gap-1">
              <ChevronRightIcon className="h-3 w-3 opacity-60" />
              {isLast ? (
                <span aria-current="page" className="font-semibold text-foreground">
                  {entry.label}
                </span>
              ) : (
                <Link
                  href={entry.href}
                  className="hover:text-foreground transition-colors"
                >
                  {entry.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function humanize(segment: string): string {
  const decoded = decodeURIComponent(segment).replace(/[-_]+/g, " ");
  return decoded.charAt(0).toUpperCase() + decoded.slice(1);
}
