"use client";

import { Button } from "@/components/ui/Button";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  delinquentLoans: number | null;
  inactiveUsers: number | null;
  lowCollectionFlag: number | null;
  loading?: boolean;
};

export function DashboardAlertsCard({
  delinquentLoans,
  inactiveUsers,
  lowCollectionFlag,
  loading,
}: Props) {
  const t = useTranslations();

  const rows: ReadonlyArray<{
    label: string;
    count: number | null;
    dotColor: string;
  }> = [
    {
      label: t("dashboard.alerts.delinquentLoans"),
      count: delinquentLoans,
      dotColor: "var(--color-danger)",
    },
    {
      label: t("dashboard.alerts.inactiveUsers"),
      count: inactiveUsers,
      dotColor: "var(--color-success)",
    },
    {
      label: t("dashboard.alerts.lowCollection"),
      count: lowCollectionFlag,
      dotColor: "var(--color-accent)",
    },
  ];

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5 shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]">
      <header className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-field)] bg-danger/15 text-danger">
          <BellAlertIcon />
        </span>
        <h2 className="text-base font-semibold text-foreground">
          {t("dashboard.alerts.title")}
        </h2>
      </header>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: row.dotColor }}
              />
              {row.label}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {loading || row.count === null
                  ? "—"
                  : row.count.toString().padStart(2, "0")}
              </span>
              <ChevronRightThin />
            </span>
          </li>
        ))}
      </ul>

      <Button variant="primary" size="sm" className="self-start">
        {t("dashboard.viewMore")}
      </Button>
    </article>
  );
}

function BellAlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ChevronRightThin() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 text-muted-foreground"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
