import { Badge } from "@/components/ui/Badge";
import type { JournalEntry } from "@/lib/api/journal-entries";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { journalStatusTone } from "./dashboard-status";

/** Compact journal-entries table for the accountant queue card. */
export function DashboardJournalTable({
  entries,
  loading,
  emptyLabel,
}: {
  entries: JournalEntry[] | null;
  loading: boolean;
  emptyLabel: string;
}) {
  const t = useTranslations();
  const format = useFormatter();

  if (loading && !entries) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }
  if (!entries || entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">{t("dashboard.common.journalColumns.reference")}</th>
            <th className="pb-2 font-medium">{t("dashboard.common.journalColumns.status")}</th>
            <th className="pb-2 text-right font-medium">{t("dashboard.common.journalColumns.date")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr key={entry.public_id} className="hover:bg-muted/30">
              <td className="py-2.5">
                <span className="font-mono text-xs font-medium text-foreground">
                  {entry.reference}
                </span>
                {entry.description ? (
                  <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                ) : null}
              </td>
              <td className="py-2.5">
                <Badge tone={journalStatusTone(entry.status)}>
                  {t(`dashboard.common.journalStatus.${entry.status}`)}
                </Badge>
              </td>
              <td className="py-2.5 text-right text-xs text-muted-foreground">
                {entry.business_date ? format.date(entry.business_date) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
