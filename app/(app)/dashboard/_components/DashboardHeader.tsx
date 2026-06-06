"use client";

import { useEffect, useState } from "react";
import { CalendarIcon } from "@/components/ui/icons";
import { PageHeader } from "../../_components/PageHeader";

/** Today's date, formatted client-side to avoid an SSR hydration mismatch. */
function useToday(): string {
  const [today, setToday] = useState("");
  useEffect(() => {
    const formatted = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    setToday(formatted.charAt(0).toUpperCase() + formatted.slice(1));
  }, []);
  return today;
}

/**
 * Standard dashboard header: greeting title + subtitle on the left, a "today"
 * date chip on the right. Shared by every role layout for a consistent top.
 */
export function DashboardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const today = useToday();
  return (
    <PageHeader
      title={title}
      description={subtitle}
      actions={
        today ? (
          <span className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-border bg-background px-3 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span className="tabular-nums">{today}</span>
          </span>
        ) : null
      }
    />
  );
}
