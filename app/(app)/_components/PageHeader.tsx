import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

type Props = {
  title: string;
  description?: string;
  /** Right-aligned slot for CTAs / filters. */
  actions?: ReactNode;
};

/**
 * Standard page header: breadcrumbs on top, then `<h1>` + optional description
 * + optional action slot on the right. Use on every authenticated page so
 * spacing and typography stay consistent (DESIGN_PRINCIPLES.md §2 + §8.3).
 */
export function PageHeader({ title, description, actions }: Props) {
  return (
    <header className="flex flex-col gap-3">
      <Breadcrumbs />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
