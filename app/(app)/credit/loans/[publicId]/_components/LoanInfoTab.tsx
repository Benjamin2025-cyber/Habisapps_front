"use client";

import { clientDisplayName } from "@/lib/format/clientName";
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

  // Server-resolved: the local `clients` list is capped, so the lookup misses
  // for any holder past it and used to fall back to a raw ULID — and the join
  // below dropped the middle name even when it hit.
  const clientName =
    loan.client_display_name ??
    (client
      ? clientDisplayName(client) || client.client_reference || client.public_id
      : loan.client_public_id);

  // Server-resolved first, for the same reason as the holder above: each of
  // these catalogues is a separate privileged fetch. The product needs
  // `loan.products.view` (the accountant and compliance-officer lack it, yet
  // both sign a visa from this file, so they saw a ULID) and the sector lists
  // need `sectors.view` / `sub-sectors.view` (held only by the agency-manager
  // and kyc-officer, so for everyone else the fields rendered blank — reading
  // as « the sector was never saved » rather than as a lookup failure).
  const product = products.find(
    (p) => p.public_id === loan.loan_product_public_id,
  );
  const productLabel =
    loan.loan_product_label ??
    (product
      ? `${product.code} — ${product.name}`
      : loan.loan_product_public_id);

  const sector = sectors.find((s) => s.public_id === loan.sector_public_id);
  const subSector = subSectors.find(
    (s) => s.public_id === loan.sub_sector_public_id,
  );
  const sectorLabel =
    loan.sector_label ?? (sector ? `${sector.code} — ${sector.name}` : null);
  const subSectorLabel =
    loan.sub_sector_label ??
    (subSector ? `${subSector.code} — ${subSector.name}` : null);

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
            value={sectorLabel}
          />
          <PlainField
            label={t("loans.fields.subSector")}
            value={subSectorLabel}
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
