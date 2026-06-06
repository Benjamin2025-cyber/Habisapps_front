import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Client } from "@/lib/api/clients";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { kycStatusTone } from "./dashboard-status";

/** Compact clients table used by the KYC / compliance review queues. */
export function DashboardClientsTable({
  clients,
  loading,
  emptyLabel,
}: {
  clients: Client[] | null;
  loading: boolean;
  emptyLabel: string;
}) {
  const t = useTranslations();
  const format = useFormatter();

  if (loading && !clients) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }
  if (!clients || clients.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">{t("dashboard.common.clientColumns.client")}</th>
            <th className="pb-2 font-medium">{t("dashboard.common.clientColumns.kyc")}</th>
            <th className="pb-2 text-right font-medium">{t("dashboard.common.clientColumns.date")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {clients.map((client) => {
            const name =
              `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
              client.public_id.slice(0, 8);
            return (
              <tr key={client.public_id} className="hover:bg-muted/30">
                <td className="py-2.5">
                  <Link
                    href={`/clients/${client.public_id}`}
                    className="font-medium text-foreground hover:text-accent hover:underline"
                  >
                    {name}
                  </Link>
                </td>
                <td className="py-2.5">
                  <Badge tone={kycStatusTone(client.kyc_status)}>
                    {t(`dashboard.common.kycStatus.${client.kyc_status}`)}
                  </Badge>
                </td>
                <td className="py-2.5 text-right text-xs text-muted-foreground">
                  {client.onboarded_on ? format.date(client.onboarded_on) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
