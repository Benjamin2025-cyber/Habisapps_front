"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Client } from "@/lib/api/clients";
import type { Loan } from "@/lib/api/loans";
import type { LoanProduct } from "@/lib/api/loan-products";
import type { Sector, SubSector } from "@/lib/api/sectors";
import { Field, Grid, PlainField, Section } from "./display";

type Props = {
  loan: Loan;
  client: Client | null;
  products: ReadonlyArray<LoanProduct>;
  sectors: ReadonlyArray<Sector>;
  subSectors: ReadonlyArray<SubSector>;
  creditAgentName: string | null;
  canEdit: boolean;
  onEdit: () => void;
};

export function LoanInfoTab({
  loan,
  client,
  products,
  sectors,
  subSectors,
  creditAgentName,
  canEdit,
  onEdit,
}: Props) {
  const t = useTranslations();

  const clientName = client
    ? [client.last_name?.toUpperCase(), client.first_name]
        .filter((part): part is string => !!part && part.length > 0)
        .join(" ") ||
      client.client_reference ||
      client.public_id
    : loan.client_public_id;

  const product = products.find(
    (p) => p.public_id === loan.loan_product_public_id,
  );
  const productLabel = product
    ? `${product.code} — ${product.name}`
    : loan.loan_product_public_id;

  const sector = sectors.find((s) => s.public_id === loan.sector_public_id);
  const subSector = subSectors.find(
    (s) => s.public_id === loan.sub_sector_public_id,
  );

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("loanDetail.sections.general")}
        action={
          canEdit ? (
            <Button variant="primary" size="sm" onClick={onEdit}>
              {t("loanDetail.edit")}
            </Button>
          ) : null
        }
      >
        <Grid>
          <Field label={t("loans.fields.client")}>
            {loan.client_public_id ? (
              <Link
                href={`/clients/${loan.client_public_id}`}
                className="text-accent hover:underline"
              >
                {clientName}
              </Link>
            ) : (
              "—"
            )}
          </Field>
          <PlainField label={t("loans.fields.product")} value={productLabel} />
          <PlainField
            label={t("loans.fields.creditAgent")}
            value={creditAgentName ?? loan.credit_agent_public_id}
          />
          <PlainField
            label={t("loans.fields.appliedOn")}
            value={loan.applied_on}
            mono
          />
          <PlainField
            label={t("loans.fields.purpose")}
            value={loan.purpose}
            wide
          />
        </Grid>
      </Section>

      <Section title={t("loanDetail.sections.activity")}>
        <Grid>
          <PlainField
            label={t("loans.fields.sector")}
            value={sector ? `${sector.code} — ${sector.name}` : null}
          />
          <PlainField
            label={t("loans.fields.subSector")}
            value={subSector ? `${subSector.code} — ${subSector.name}` : null}
          />
          <PlainField
            label={t("loans.fields.financedActivityCode")}
            value={loan.financed_activity_code}
            mono
          />
          <PlainField
            label={t("loans.fields.activityAddress")}
            value={loan.activity_address}
          />
          <PlainField
            label={t("loans.fields.entrepreneurAddress")}
            value={loan.entrepreneur_address}
            wide
          />
        </Grid>
      </Section>

      <Section title={t("loanDetail.sections.lifecycle")}>
        <Grid>
          <PlainField
            label={t("loans.fields.appliedOn")}
            value={loan.applied_on}
            mono
          />
          <PlainField
            label={t("loanDetail.fields.approvedOn")}
            value={loan.approved_on}
            mono
          />
          <PlainField
            label={t("loanDetail.fields.disbursedOn")}
            value={loan.disbursed_on}
            mono
          />
          <PlainField
            label={t("loanDetail.fields.closedOn")}
            value={loan.closed_on}
            mono
          />
        </Grid>
      </Section>
    </div>
  );
}
