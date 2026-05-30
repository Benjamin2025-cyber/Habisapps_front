"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Client } from "@/lib/api/clients";
import type { AccountProduct } from "@/lib/api/account-products";
import type {
  CustomerAccount,
  CustomerAccountStatus,
} from "@/lib/api/customer-accounts";

type Props = {
  account: CustomerAccount;
  clients: ReadonlyArray<Client>;
  accountProducts: ReadonlyArray<AccountProduct>;
  canEdit: boolean;
  onEdit: () => void;
};

const STATUS_TONE: Record<
  CustomerAccountStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  suspended: "warning",
  closed: "neutral",
  archived: "danger",
};

export function AccountInfoTab({
  account,
  clients,
  accountProducts,
  canEdit,
  onEdit,
}: Props) {
  const t = useTranslations();

  const holder = clients.find((c) => c.public_id === account.client_public_id);
  const holderName = holder
    ? [holder.last_name?.toUpperCase(), holder.first_name]
        .filter((part): part is string => !!part && part.length > 0)
        .join(" ") ||
      holder.client_reference ||
      holder.public_id
    : account.client_public_id;

  const product = accountProducts.find(
    (p) => p.public_id === account.account_product_public_id,
  );
  const productLabel = product
    ? `${product.name} — ${t(`accountProducts.family.${product.account_family}`)}`
    : account.account_product_public_id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("accountDetail.summaryLabel")}
          </p>
          <h2 className="text-xl font-bold tabular-nums text-foreground">
            {account.account_number}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={STATUS_TONE[account.status]}>
              {t(`accounts.status.${account.status}`)}
            </Badge>
            {account.currency ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {account.currency}
              </span>
            ) : null}
            {product ? (
              <span className="text-muted-foreground">{product.name}</span>
            ) : account.account_title ? (
              <span className="text-muted-foreground">
                {account.account_title}
              </span>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <Button variant="primary" size="sm" onClick={onEdit}>
            {t("accountDetail.edit")}
          </Button>
        ) : null}
      </div>

      <Section title={t("accounts.drawer.sectionHolder")}>
        <Grid>
          <Field label={t("accounts.fields.client")}>
            {account.client_public_id ? (
              <Link
                href={`/clients/${account.client_public_id}`}
                className="text-accent hover:underline"
              >
                {holderName}
              </Link>
            ) : (
              "—"
            )}
          </Field>
          <PlainField
            label={t("accounts.fields.agency")}
            value={account.agency_public_id}
            mono
          />
        </Grid>
      </Section>

      <Section title={t("accounts.drawer.sectionAccount")}>
        <Grid>
          <PlainField
            label={t("accounts.fields.number")}
            value={account.account_number}
            mono
          />
          <PlainField
            label={t("accounts.fields.product")}
            value={productLabel}
          />
          <PlainField
            label={t("accounts.fields.title")}
            value={account.account_title}
          />
          <PlainField
            label={t("accounts.fields.currency")}
            value={account.currency}
            mono
          />
          {account.account_type ? (
            <PlainField
              label={t("accounts.fields.legacyType")}
              value={account.account_type}
            />
          ) : null}
        </Grid>
      </Section>

      <Section title={t("accounts.drawer.sectionAccounting")}>
        <Grid>
          <PlainField
            label={t("accounts.fields.ledgerAccount")}
            value={account.ledger_account_public_id}
            mono
          />
        </Grid>
      </Section>

      <Section title={t("accounts.drawer.sectionLifecycle")}>
        <Grid>
          <PlainField
            label={t("accounts.fields.openedOn")}
            value={account.opened_on ? account.opened_on.slice(0, 10) : null}
            mono
          />
          <PlainField
            label={t("accounts.fields.closedOn")}
            value={account.closed_on ? account.closed_on.slice(0, 10) : null}
            mono
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
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function PlainField({
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
