"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ClientPicker, type ClientOption } from "../../_components/ClientPicker";
import { getClient, type Client } from "@/lib/api/clients";
import {
  fetchAccountAvailableBalance,
  fetchCustomerAccounts,
  type CustomerAccount,
} from "@/lib/api/customer-accounts";
import { fetchLoans, type Loan } from "@/lib/api/loans";
import { fetchLoanProducts } from "@/lib/api/loan-products";
import { fetchGuarantors, type ClientGuarantor } from "@/lib/api/client-guarantors";
import { fetchProxies, type ClientProxy } from "@/lib/api/client-proxies";
import {
  fetchIdentityDocuments,
  type ClientIdentityDocument,
} from "@/lib/api/client-identity-documents";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { openBrandedReport } from "@/lib/print/report";
import { PageHeader } from "../../_components/PageHeader";
import { AuthenticatedImage } from "../../_components/AuthenticatedImage";

type Bundle = {
  client: Client;
  accounts: CustomerAccount[];
  loans: Loan[];
  guarantors: ClientGuarantor[];
  proxies: ClientProxy[];
  idDocs: ClientIdentityDocument[];
  productNameOf: (id: string | null) => string;
};

/**
 * P23 — Image globale client (vue 360° lecture seule). Recherche client puis
 * agrégation de sa fiche, comptes (+ solde disponible), prêts, garants,
 * mandataires et pièces d'identité, avec impression. Composé depuis les
 * endpoints existants (pas d'endpoint agrégé). NB : `/loans` n'a pas de filtre
 * client côté serveur (#23) → filtrage client-side sur la page chargée.
 */
export default function GlobalClientImagePage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["crm.clients.view"]);
  const canView = isPlatformAdmin || viewPerm;

  const [selected, setSelected] = useState<ClientOption | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientPublicId = selected?.value ?? null;

  useEffect(() => {
    if (!token || !clientPublicId) {
      setBundle(null);
      setBalances({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getClient(token, clientPublicId),
      fetchCustomerAccounts(token, { clientPublicId, perPage: 100 }).then((r) => r.data).catch(() => []),
      fetchLoans(token, { perPage: 100 }).then((r) => r.data).catch(() => []),
      fetchGuarantors(token, clientPublicId, { perPage: 100 }).catch(() => []),
      fetchProxies(token, clientPublicId, { perPage: 100 }).catch(() => []),
      fetchIdentityDocuments(token, clientPublicId, { perPage: 100 }).catch(() => []),
      fetchLoanProducts(token, { perPage: 100 }).then((r) => r.data).catch(() => []),
    ])
      .then(([client, accounts, allLoans, guarantors, proxies, idDocs, products]) => {
        if (cancelled) return;
        const byId = new Map<string, string>();
        for (const p of products) byId.set(p.public_id, `${p.code} — ${p.name}`);
        setBundle({
          client,
          accounts,
          loans: allLoans.filter((l) => l.client_public_id === clientPublicId),
          guarantors,
          proxies,
          idDocs,
          productNameOf: (id) => (id ? (byId.get(id) ?? id) : "—"),
        });
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, clientPublicId]);

  // Available balance per account (bounded N).
  useEffect(() => {
    if (!token || !bundle || bundle.accounts.length === 0) return;
    let cancelled = false;
    Promise.all(
      bundle.accounts.map((a) =>
        fetchAccountAvailableBalance(token, a.public_id)
          .then((b) => [a.public_id, b.available_balance_minor] as const)
          .catch(() => [a.public_id, null] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setBalances(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [token, bundle]);

  const clientName = useMemo(() => {
    if (!bundle) return "";
    return (
      [bundle.client.first_name, bundle.client.last_name].filter(Boolean).join(" ") ||
      bundle.client.public_id
    );
  }, [bundle]);

  if (session.status !== "authenticated" || !canView) return null;

  function money(minor: number | null | undefined, currency = "XAF"): string {
    if (minor === null || minor === undefined) return "—";
    return format.currencyMinor(minor, { currency });
  }

  function handlePrint() {
    if (!bundle) return;
    openBrandedReport({
      documentTitle: `${t("globalClientImage.print.fileName")}-${clientName}`,
      heading: t("globalClientImage.print.heading"),
      subheading: clientName,
      meta: [
        { label: t("globalClientImage.identity.reference"), value: bundle.client.client_reference ?? "—" },
        { label: t("globalClientImage.identity.phone"), value: bundle.client.phone_number ?? "—" },
        { label: t("globalClientImage.identity.email"), value: bundle.client.email ?? "—" },
        { label: t("globalClientImage.identity.kyc"), value: bundle.client.kyc_status },
        { label: t("globalClientImage.identity.status"), value: bundle.client.status },
        { label: t("globalClientImage.accounts.title"), value: String(bundle.accounts.length) },
        { label: t("globalClientImage.loans.title"), value: String(bundle.loans.length) },
      ],
      columns: [
        t("globalClientImage.accounts.number"),
        t("globalClientImage.accounts.type"),
        t("globalClientImage.accounts.status"),
        t("globalClientImage.accounts.balance"),
      ],
      rows: bundle.accounts.map((a) => [
        a.account_number,
        a.account_type ?? "—",
        a.status,
        money(balances[a.public_id], a.currency ?? "XAF"),
      ]),
      numericColumns: [3],
      generatedLabel: t("common.generatedOn"),
      emptyLabel: t("globalClientImage.accounts.empty"),
    });
  }

  return (
    <>
      <PageHeader
        title={t("globalClientImage.pageTitle")}
        description={t("globalClientImage.pageDescription")}
        actions={
          bundle ? (
            <Button variant="outline" size="md" onClick={handlePrint}>
              {t("globalClientImage.print.action")}
            </Button>
          ) : null
        }
      />

      <section className="rounded-[var(--radius-card)] border border-border bg-background p-4 sm:max-w-md">
        <ClientPicker
          label={t("globalClientImage.searchLabel")}
          value={selected}
          onChange={setSelected}
          placeholder={t("globalClientImage.searchPlaceholder")}
        />
      </section>

      {!selected ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
          {t("globalClientImage.selectPrompt")}
        </div>
      ) : loading ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : error ? (
        <Alert variant="danger" title={t("globalClientImage.errorTitle")}>
          {error}
        </Alert>
      ) : bundle ? (
        <div className="flex flex-col gap-4">
          {/* Identity */}
          <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-accent/10">
                <AuthenticatedImage
                  documentPublicId={bundle.client.profile_photo_document_public_id}
                  srcUrl={bundle.client.profile_photo_thumbnail_url}
                  alt={clientName}
                  className="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-accent">
                      {clientName.slice(0, 2).toUpperCase()}
                    </div>
                  }
                />
              </div>
              <Link
                href={`/clients/${bundle.client.public_id}`}
                className="order-last ml-auto inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("globalClientImage.viewFullProfile")} →
              </Link>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-foreground">{clientName}</span>
                  <Badge tone={bundle.client.status === "active" ? "success" : "neutral"}>
                    {bundle.client.status}
                  </Badge>
                  <Badge tone={bundle.client.kyc_status === "verified" ? "success" : "warning"}>
                    {t("globalClientImage.identity.kyc")}: {bundle.client.kyc_status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("globalClientImage.identity.reference")}: {bundle.client.client_reference ?? "—"} ·{" "}
                  {bundle.client.phone_number ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {bundle.client.email ?? "—"}
                </span>
              </div>
            </div>
          </section>

          {/* Accounts */}
          <Panel title={t("globalClientImage.accounts.title")} count={bundle.accounts.length}>
            <SimpleTable
              head={[
                t("globalClientImage.accounts.number"),
                t("globalClientImage.accounts.type"),
                t("globalClientImage.accounts.status"),
                t("globalClientImage.accounts.balance"),
              ]}
              rows={bundle.accounts.map((a) => [
                a.account_number,
                a.account_type ?? "—",
                a.status,
                money(balances[a.public_id], a.currency ?? "XAF"),
              ])}
              numericLast
              empty={t("globalClientImage.accounts.empty")}
            />
          </Panel>

          {/* Loans */}
          <Panel title={t("globalClientImage.loans.title")} count={bundle.loans.length}>
            <SimpleTable
              head={[
                t("globalClientImage.loans.number"),
                t("globalClientImage.loans.product"),
                t("globalClientImage.loans.amount"),
                t("globalClientImage.loans.status"),
              ]}
              rows={bundle.loans.map((l) => [
                l.loan_number ?? "—",
                bundle.productNameOf(l.loan_product_public_id),
                money(l.approved_principal_minor ?? l.requested_amount_minor, l.currency ?? "XAF"),
                l.status,
              ])}
              numericThird
              empty={t("globalClientImage.loans.empty")}
            />
            <p className="px-4 pb-3 text-xs text-muted-foreground">
              {t("globalClientImage.loans.note")}
            </p>
          </Panel>

          {/* Guarantors + Proxies + Identity docs */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title={t("globalClientImage.guarantors.title")} count={bundle.guarantors.length}>
              <SimpleTable
                head={[t("globalClientImage.guarantors.name"), t("globalClientImage.guarantors.status")]}
                rows={bundle.guarantors.map((g) => [g.guarantor_full_name ?? "—", g.verification_status])}
                empty={t("globalClientImage.guarantors.empty")}
              />
            </Panel>
            <Panel title={t("globalClientImage.proxies.title")} count={bundle.proxies.length}>
              <SimpleTable
                head={[t("globalClientImage.proxies.name"), t("globalClientImage.proxies.status")]}
                rows={bundle.proxies.map((p) => [p.proxy_full_name ?? "—", p.verification_status])}
                empty={t("globalClientImage.proxies.empty")}
              />
            </Panel>
            <Panel title={t("globalClientImage.idDocs.title")} count={bundle.idDocs.length}>
              <SimpleTable
                head={[t("globalClientImage.idDocs.type"), t("globalClientImage.idDocs.status")]}
                rows={bundle.idDocs.map((d) => [d.document_type, d.verification_status])}
                empty={t("globalClientImage.idDocs.empty")}
              />
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
      <header className="flex items-center justify-between border-b border-border border-l-4 border-l-accent bg-accent/5 px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      {children}
    </section>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
  numericLast,
  numericThird,
}: {
  head: string[];
  rows: Array<Array<string>>;
  empty: string;
  numericLast?: boolean;
  numericThird?: boolean;
}) {
  const rightCol = numericLast ? head.length - 1 : numericThird ? 2 : -1;
  return (
    <table className="w-full text-sm">
      <thead className="bg-accent/5 text-xs">
        <tr className="text-left">
          {head.map((h, i) => (
            <th
              key={h}
              className={`px-4 py-2 font-semibold ${i === rightCol ? "text-right" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length} className="px-4 py-6 text-center text-muted-foreground">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-2.5 ${ci === rightCol ? "text-right tabular-nums" : ""} ${ci === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
