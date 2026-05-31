"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsPanel, type TabItem } from "@/components/ui/Tabs";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  fetchLedgerAccounts,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { fetchClients, type Client } from "@/lib/api/clients";
import {
  fetchAccountProducts,
  type AccountProduct,
} from "@/lib/api/account-products";
import {
  getCustomerAccount,
  updateCustomerAccount,
  type CustomerAccount,
  type CustomerAccountWritePayload,
} from "@/lib/api/customer-accounts";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { AccountDrawer } from "../_components/AccountDrawer";
import { AccountInfoTab } from "./_components/AccountInfoTab";
import { AccountProxiesTab } from "./_components/AccountProxiesTab";
import { AccountBalancesTab } from "./_components/AccountBalancesTab";
import { AccountStatementTab } from "./_components/AccountStatementTab";
import { AccountSignaturesTab } from "./_components/AccountSignaturesTab";
import { AccountHoldsTab } from "./_components/AccountHoldsTab";

type TabId =
  | "infos"
  | "proxies"
  | "balances"
  | "statement"
  | "signatures"
  | "holds";

/**
 * P7 — Fiche compte client multi-onglets.
 *
 * Onglets : Infos (titulaire, lecture + édition), Mandataires (lecture seule),
 * Soldes, Relevé (mouvements paginés), Signatures (vérifier / révoquer), Mises
 * en attente (CRUD + libération).
 *
 * Note : le chargement de la fiche (`show`), soldes, relevé et les holds sont
 * réservés à `platform-admin` côté API — un autre profil obtient un 403 (géré
 * ci-dessous par l'alerte d'erreur).
 */
export default function AccountDetailPage(props: {
  params: Promise<{ publicId: string }>;
}) {
  const params = use(props.params);
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["customer.accounts.view"]);
  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canManage = isPlatformAdmin;
  const canScopeInstitution = useCan("crm.scope.institution.read");
  const canViewProxies = useCan("crm.proxies.view");
  const canViewSignaturesPerm = useCan("customer.account-signatures.view");
  const canViewSignatures = isPlatformAdmin || canViewSignaturesPerm;
  const canViewHolds = isPlatformAdmin;

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<CustomerAccount> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return getCustomerAccount(token, params.publicId);
    },
    [token, params.publicId],
  );

  const { data: account, loading, error, refetch } = useApi(fetcher, [
    token,
    params.publicId,
  ]);

  const [activeTab, setActiveTab] = useState<TabId>("infos");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [products, setProducts] = useState<AccountProduct[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchClients(token, {
        perPage: 100,
        scope: canScopeInstitution ? "all" : undefined,
      }).catch(() => null),
      fetchAgencies(token, { perPage: 100 }).catch(() => null),
      fetchAccountProducts(token, { perPage: 100 }).catch(() => null),
      fetchLedgerAccounts(token, { perPage: 100 }).catch(() => null),
    ]).then(([clientsResponse, agenciesResponse, productsResponse, ledgerResponse]) => {
      if (cancelled) return;
      setClients(clientsResponse?.data ?? []);
      setAgencies(agenciesResponse?.data ?? []);
      setProducts(productsResponse?.data ?? []);
      setLedgerAccounts(ledgerResponse?.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [token, canScopeInstitution]);

  async function handleEditSubmit(payload: CustomerAccountWritePayload) {
    if (!token || !account) return;
    await updateCustomerAccount(token, account.public_id, payload);
    toast.success(
      t("accounts.toast.updatedTitle"),
      t("accounts.toast.updatedBody", { number: account.account_number }),
    );
    setDrawerOpen(false);
    refetch();
  }

  if (session.status !== "authenticated" || !allowed) return null;

  const tabs: TabItem[] = [
    { id: "infos", label: t("accountDetail.tabs.infos") },
    {
      id: "proxies",
      label: t("accountDetail.tabs.proxies"),
      hidden: !canViewProxies,
    },
    { id: "balances", label: t("accountDetail.tabs.balances") },
    { id: "statement", label: t("accountDetail.tabs.statement") },
    {
      id: "signatures",
      label: t("accountDetail.tabs.signatures"),
      hidden: !canViewSignatures,
    },
    {
      id: "holds",
      label: t("accountDetail.tabs.holds"),
      hidden: !canViewHolds,
    },
  ];

  return (
    <>
      <PageHeader
        title={
          account
            ? account.account_title || account.account_number
            : t("accountDetail.loading")
        }
        description={
          account
            ? t("accountDetail.referenceLabel", {
                number: account.account_number,
              })
            : undefined
        }
        actions={
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            ← {t("accountDetail.backToList")}
          </Link>
        }
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("accountDetail.errorTitle")}
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

      {loading && !account ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : account ? (
        <>
          <Tabs
            items={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            ariaLabel={t("accountDetail.tabsAriaLabel")}
          />

          {activeTab === "infos" ? (
            <TabsPanel id="infos">
              <AccountInfoTab
                account={account}
                clients={clients}
                accountProducts={products}
                canEdit={canManage}
                onEdit={() => setDrawerOpen(true)}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "proxies" && canViewProxies ? (
            <TabsPanel id="proxies">
              <AccountProxiesTab
                accountPublicId={account.public_id}
                clientPublicId={account.client_public_id}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "balances" ? (
            <TabsPanel id="balances">
              <AccountBalancesTab
                accountPublicId={account.public_id}
                currency={account.currency}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "statement" ? (
            <TabsPanel id="statement">
              <AccountStatementTab
                accountPublicId={account.public_id}
                currency={account.currency}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "signatures" && canViewSignatures ? (
            <TabsPanel id="signatures">
              <AccountSignaturesTab accountPublicId={account.public_id} />
            </TabsPanel>
          ) : null}

          {activeTab === "holds" && canViewHolds ? (
            <TabsPanel id="holds">
              <AccountHoldsTab
                accountPublicId={account.public_id}
                currency={account.currency}
              />
            </TabsPanel>
          ) : null}
        </>
      ) : null}

      {account && canManage ? (
        <AccountDrawer
          open={drawerOpen}
          mode="edit"
          initial={account}
          clients={clients}
          agencies={agencies}
          accountProducts={products}
          ledgerAccounts={ledgerAccounts}
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </>
  );
}
