"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Client, ClientKycStatus, ClientStatus } from "@/lib/api/clients";
import { AuthenticatedImage } from "../../../_components/AuthenticatedImage";

type Props = {
  client: Client;
  canEdit: boolean;
  onEdit: () => void;
};

const STATUS_TONE: Record<
  ClientStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  archived: "danger",
};

const KYC_TONE: Record<
  ClientKycStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  draft: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
  suspended: "warning",
  archived: "neutral",
};

export function IdentityTab({ client, canEdit, onEdit }: Props) {
  const t = useTranslations();

  const fullName =
    [client.last_name?.toUpperCase(), client.first_name, client.middle_name]
      .filter((value): value is string => !!value && value.length > 0)
      .join(" ") || "—";

  const initials =
    [client.last_name, client.first_name]
      .map((n) => (n && n.trim().length > 0 ? n.trim()[0] : ""))
      .join("")
      .toUpperCase() || "•";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            <AuthenticatedImage
              documentPublicId={client.profile_photo_document_public_id}
              alt={fullName}
              className="h-full w-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                  {initials}
                </div>
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("clientDetail.identity.summaryLabel")}
            </p>
            <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={STATUS_TONE[client.status]}>
                {t(`clients.status.${client.status}`)}
              </Badge>
              <Badge tone={KYC_TONE[client.kyc_status]}>
                {t("clientDetail.identity.kycPrefix", {
                  status: t(`clients.kyc.${client.kyc_status}`),
                })}
              </Badge>
              {client.client_reference ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {client.client_reference}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {canEdit ? (
          <Button variant="primary" size="sm" onClick={onEdit}>
            {t("clientDetail.identity.edit")}
          </Button>
        ) : null}
      </div>

      <Section title={t("clients.drawer.sectionIdentity")}>
        <Grid>
          <Field label={t("clients.fields.lastName")} value={client.last_name} />
          <Field label={t("clients.fields.firstName")} value={client.first_name} />
          <Field label={t("clients.fields.middleName")} value={client.middle_name} />
          <Field
            label={t("clients.fields.gender")}
            value={
              client.gender
                ? translateOrFallback(t, `clients.gender.${client.gender.toLowerCase()}`, client.gender)
                : null
            }
          />
          <Field
            label={t("clients.fields.dateOfBirth")}
            value={client.date_of_birth ? client.date_of_birth.slice(0, 10) : null}
          />
          <Field
            label={t("clients.fields.placeOfBirth")}
            value={client.place_of_birth}
          />
          <Field label={t("clients.fields.fatherName")} value={client.father_name} />
          <Field label={t("clients.fields.motherName")} value={client.mother_name} />
        </Grid>
      </Section>

      <Section title={t("clients.drawer.sectionContact")}>
        <Grid>
          <Field label={t("clients.fields.phone")} value={client.phone_number} mono />
          <Field
            label={t("clients.fields.homePhone")}
            value={client.home_phone_number}
            mono
          />
          <Field label={t("clients.fields.email")} value={client.email} wide />
          <Field
            label={t("clients.fields.addressLine1")}
            value={client.address_line_1}
            wide
          />
          <Field
            label={t("clients.fields.addressLine2")}
            value={client.address_line_2}
            wide
          />
          <Field label={t("clients.fields.city")} value={client.city} />
          <Field label={t("clients.fields.region")} value={client.region} />
        </Grid>
      </Section>

      <Section title={t("clients.drawer.sectionProfessional")}>
        <Grid>
          <Field label={t("clients.fields.occupation")} value={client.occupation} />
          <Field label={t("clients.fields.employerName")} value={client.employer_name} />
        </Grid>
      </Section>

      <Section title={t("clients.drawer.sectionCollection")}>
        <Grid>
          <Field label={t("clients.fields.collectionType")} value={client.collection_type} />
          <Field
            label={t("clients.fields.collectionFrequency")}
            value={
              client.collection_frequency
                ? translateOrFallback(
                    t,
                    `clients.frequency.${client.collection_frequency}`,
                    client.collection_frequency,
                  )
                : null
            }
          />
          <Field
            label={t("clients.fields.collectionTargetAmount")}
            value={
              client.collection_target_amount !== null
                ? `${client.collection_target_amount.toLocaleString("fr-FR")} FCFA`
                : null
            }
          />
        </Grid>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <header className="border-b border-border border-l-4 border-l-accent bg-accent/5 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {children}
    </dl>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}
