"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsPanel, type TabItem } from "@/components/ui/Tabs";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  getClient,
  updateClient,
  type Client,
  type ClientWritePayload,
} from "@/lib/api/clients";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { ClientDrawer } from "../_components/ClientDrawer";
import { GuarantorsTab } from "./_components/GuarantorsTab";
import { IdentityDocumentsTab } from "./_components/IdentityDocumentsTab";
import { IdentityTab } from "./_components/IdentityTab";
import { ProxiesTab } from "./_components/ProxiesTab";
import { ClientAccountsTab } from "./_components/ClientAccountsTab";

type TabId =
  | "identity"
  | "identity-docs"
  | "guarantors"
  | "proxies"
  | "accounts"
  | "loans";

/**
 * P6.2 — Fiche client multi-onglets.
 *
 * Charge le client par `public_id` (depuis l'URL `[publicId]`), affiche un
 * header avec ses identifiants principaux + statut/KYC, puis 6 onglets :
 * Identité, Documents KYC, Garants, Mandataires, Comptes, Prêts.
 *
 * Les onglets Comptes et Prêts sont des placeholders en attendant les
 * écrans P7 (`customer-accounts`) et P11 (`loans`).
 */
export default function ClientDetailPage(props: {
  params: Promise<{ publicId: string }>;
}) {
  const params = use(props.params);
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["crm.clients.view"]);

  const canViewDocs = useCan("crm.identity_documents.view");
  const canViewGuarantors = useCan("crm.guarantors.view");
  const canViewProxies = useCan("crm.proxies.view");
  const canViewAccounts = useCan("customer.accounts.view");
  const canEditClient = useCan("crm.clients.update");

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<Client> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return getClient(token, params.publicId);
    },
    [token, params.publicId],
  );

  const { data: client, loading, error, refetch } = useApi(fetcher, [
    token,
    params.publicId,
  ]);

  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [guarantorsCount, setGuarantorsCount] = useState<number>(0);
  const [proxiesCount, setProxiesCount] = useState<number>(0);
  const [accountsCount, setAccountsCount] = useState<number>(0);

  // Load agencies for the edit drawer's agency picker.
  const [agencies, setAgencies] = useState<Agency[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAgencies(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setAgencies(response.data);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleEditSubmit(payload: ClientWritePayload) {
    if (!token || !client) return;
    await updateClient(token, client.public_id, payload);
    toast.success(
      t("clients.toast.updatedTitle"),
      t("clients.toast.updatedBody", {
        name:
          `${payload.last_name ?? client.last_name ?? ""} ${
            payload.first_name ?? client.first_name ?? ""
          }`.trim(),
      }),
    );
    setDrawerOpen(false);
    refetch();
  }

  if (session.status !== "authenticated" || !allowed) return null;

  const tabs: TabItem[] = [
    {
      id: "identity",
      label: t("clientDetail.tabs.identity"),
    },
    {
      id: "identity-docs",
      label: t("clientDetail.tabs.identityDocs"),
      hidden: !canViewDocs,
      badge: docsCount > 0 ? docsCount : undefined,
    },
    {
      id: "guarantors",
      label: t("clientDetail.tabs.guarantors"),
      hidden: !canViewGuarantors,
      badge: guarantorsCount > 0 ? guarantorsCount : undefined,
    },
    {
      id: "proxies",
      label: t("clientDetail.tabs.proxies"),
      hidden: !canViewProxies,
      badge: proxiesCount > 0 ? proxiesCount : undefined,
    },
    {
      id: "accounts",
      label: t("clientDetail.tabs.accounts"),
      hidden: !canViewAccounts,
      badge: accountsCount > 0 ? accountsCount : undefined,
    },
    {
      id: "loans",
      label: t("clientDetail.tabs.loans"),
    },
  ];

  return (
    <>
      <PageHeader
        title={
          client
            ? clientHeading(client) || t("clientDetail.untitled")
            : t("clientDetail.loading")
        }
        description={
          client?.client_reference
            ? t("clientDetail.referenceLabel", {
                reference: client.client_reference,
              })
            : undefined
        }
        actions={
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            ← {t("clientDetail.backToList")}
          </Link>
        }
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("clientDetail.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      {client?.pii_redacted ? (
        <Alert variant="info" title={t("clientDetail.piiRedactedTitle")}>
          {t("clientDetail.piiRedactedBody")}
        </Alert>
      ) : null}

      {loading && !client ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : client ? (
        <>
          <Tabs
            items={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            ariaLabel={t("clientDetail.tabsAriaLabel")}
          />

          {activeTab === "identity" ? (
            <TabsPanel id="identity">
              <IdentityTab
                client={client}
                canEdit={canEditClient}
                onEdit={() => setDrawerOpen(true)}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "identity-docs" && canViewDocs ? (
            <TabsPanel id="identity-docs">
              <IdentityDocumentsTab
                clientPublicId={client.public_id}
                agencyPublicId={client.agency_public_id}
                onCountChange={setDocsCount}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "guarantors" && canViewGuarantors ? (
            <TabsPanel id="guarantors">
              <GuarantorsTab
                clientPublicId={client.public_id}
                onCountChange={setGuarantorsCount}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "proxies" && canViewProxies ? (
            <TabsPanel id="proxies">
              <ProxiesTab
                clientPublicId={client.public_id}
                onCountChange={setProxiesCount}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "accounts" && canViewAccounts ? (
            <TabsPanel id="accounts">
              <ClientAccountsTab
                clientPublicId={client.public_id}
                onCountChange={setAccountsCount}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "loans" ? (
            <TabsPanel id="loans">
              <PlaceholderCard
                title={t("clientDetail.loans.title")}
                body={t("clientDetail.loans.comingSoon")}
              />
            </TabsPanel>
          ) : null}
        </>
      ) : null}

      {client ? (
        <ClientDrawer
          open={drawerOpen}
          mode="edit"
          initial={client}
          agencies={agencies}
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </>
  );
}

function clientHeading(client: Client): string {
  return [
    client.last_name?.toUpperCase(),
    client.first_name,
    client.middle_name,
  ]
    .filter((value): value is string => !!value && value.length > 0)
    .join(" ");
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
