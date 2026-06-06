import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Loan } from "@/lib/api/loans";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { loanStatusTone } from "./dashboard-status";

/** Compact recent-loans table used by the officer / regional / auditor layouts. */
export function DashboardLoansTable({
  loans,
  loading,
}: {
  loans: Loan[] | null;
  loading: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();

  if (loading && !loans) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }
  if (!loans || loans.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("dashboard.common.empty.loans")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">{t("dashboard.common.loanColumns.loan")}</th>
            <th className="pb-2 font-medium">{t("dashboard.common.loanColumns.status")}</th>
            <th className="pb-2 text-right font-medium">{t("dashboard.common.loanColumns.amount")}</th>
            <th className="pb-2 text-right font-medium">{t("dashboard.common.loanColumns.date")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loans.map((loan) => {
            const amount = loan.approved_principal_minor ?? loan.requested_amount_minor ?? 0;
            const date = loan.applied_on ?? loan.disbursed_on ?? loan.approved_on;
            return (
              <tr key={loan.public_id} className="hover:bg-muted/30">
                <td className="py-2.5">
                  <Link
                    href={`/credit/loans/${loan.public_id}`}
                    className="font-medium text-foreground hover:text-accent hover:underline"
                  >
                    {loan.loan_number ?? loan.public_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="py-2.5">
                  <Badge tone={loanStatusTone(loan.status)}>
                    {t(`dashboard.common.loanStatus.${loan.status}`)}
                  </Badge>
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums text-foreground">
                  {format.currencyMinor(amount, { currency: loan.currency ?? "XAF" })}
                </td>
                <td className="py-2.5 text-right text-xs text-muted-foreground">
                  {date ? format.date(date) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
