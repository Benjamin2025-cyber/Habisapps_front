"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import {
  fetchAccountSignatures,
  revokeAccountSignature,
  verifyAccountSignature,
  type CustomerAccountSignature,
  type SignatureStatus,
} from "@/lib/api/account-signatures";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  accountPublicId: string;
};

const STATUS_TONE: Record<SignatureStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  superseded: "neutral",
  revoked: "danger",
  archived: "neutral",
};

export function AccountSignaturesTab({ accountPublicId }: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canVerifyPerm = useCan("customer.account-signatures.verify");
  const canRevokePerm = useCan("customer.account-signatures.revoke");
  const canVerify = isPlatformAdmin || canVerifyPerm;
  const canRevoke = isPlatformAdmin || canRevokePerm;

  const [action, setAction] = useState<{
    signature: CustomerAccountSignature;
    kind: "verify" | "revoke";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<CustomerAccountSignature[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchAccountSignatures(token, accountPublicId, { perPage: 100 });
    },
    [token, accountPublicId],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    accountPublicId,
  ]);

  function openAction(
    signature: CustomerAccountSignature,
    kind: "verify" | "revoke",
  ) {
    setReason("");
    setDrawerError(null);
    setAction({ signature, kind });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !action) return;
    if (action.kind === "revoke" && reason.trim().length === 0) {
      setDrawerError(t("accountDetail.signatures.reasonRequired"));
      return;
    }
    setSubmitting(true);
    setDrawerError(null);
    try {
      if (action.kind === "verify") {
        await verifyAccountSignature(token, accountPublicId, action.signature.public_id);
        toast.success(t("accountDetail.signatures.verifiedTitle"));
      } else {
        await revokeAccountSignature(
          token,
          accountPublicId,
          action.signature.public_id,
          reason.trim(),
        );
        toast.success(t("accountDetail.signatures.revokedTitle"));
      }
      setAction(null);
      refetch();
    } catch (cause) {
      setDrawerError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo<ColumnDef<CustomerAccountSignature, unknown>[]>(
    () => [
      {
        accessorKey: "signature_type",
        header: t("accountDetail.signatures.columns.type"),
        cell: ({ getValue }) => {
          const type = getValue() as CustomerAccountSignature["signature_type"];
          return <Badge tone="info">{t(`accountDetail.signatures.types.${type}`)}</Badge>;
        },
      },
      {
        accessorKey: "signer_name",
        header: t("accountDetail.signatures.columns.signer"),
        cell: ({ getValue }) => (
          <span className="text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "signer_role",
        header: t("accountDetail.signatures.columns.role"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("accountDetail.signatures.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as SignatureStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`accountDetail.signatures.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "verified_at",
        header: t("accountDetail.signatures.columns.verified"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="tabular-nums text-muted-foreground">
              {value.slice(0, 10)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      ...(canVerify || canRevoke
        ? [
            {
              id: "actions",
              header: t("accountDetail.signatures.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const sig = row.original;
                const items: DropdownMenuItem[] = [];
                if (canVerify && sig.status === "active" && !sig.verified_at) {
                  items.push({
                    label: t("accountDetail.signatures.actions.verify"),
                    onClick: () => openAction(sig, "verify"),
                  });
                }
                if (canRevoke && sig.status === "active") {
                  items.push({
                    label: t("accountDetail.signatures.actions.revoke"),
                    onClick: () => openAction(sig, "revoke"),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("accountDetail.signatures.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<CustomerAccountSignature, unknown>,
          ]
        : []),
    ],
    [t, canVerify, canRevoke],
  );

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert
          variant="danger"
          title={t("accountDetail.signatures.errorTitle")}
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

      <DataTable<CustomerAccountSignature>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("accountDetail.signatures.empty")}
        getRowId={(row) => row.public_id}
        title={t("accountDetail.signatures.title")}
        titleAside={t("accountDetail.signatures.count", { count: data?.length ?? 0 })}
      />

      <p className="text-xs text-muted-foreground">
        {t("accountDetail.signatures.addHint")}
      </p>

      <Drawer
        open={action !== null}
        onClose={submitting ? () => undefined : () => setAction(null)}
        title={
          action?.kind === "verify"
            ? t("accountDetail.signatures.verifyTitle")
            : t("accountDetail.signatures.revokeTitle")
        }
        widthClassName="sm:w-[28rem]"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setAction(null)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={action?.kind === "revoke" ? "danger" : "primary"}
              size="md"
              type="submit"
              form="signature-action-form"
              disabled={submitting}
            >
              {submitting
                ? t("common.loading")
                : action?.kind === "verify"
                  ? t("accountDetail.signatures.actions.verify")
                  : t("accountDetail.signatures.actions.revoke")}
            </Button>
          </>
        }
      >
        {drawerError ? (
          <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {drawerError}
          </p>
        ) : null}
        <form id="signature-action-form" onSubmit={handleSubmit} noValidate>
          <p className="mb-4 text-sm text-muted-foreground">
            {action?.kind === "verify"
              ? t("accountDetail.signatures.verifyIntro", {
                  signer: action?.signature.signer_name ?? "—",
                })
              : t("accountDetail.signatures.revokeIntro", {
                  signer: action?.signature.signer_name ?? "—",
                })}
          </p>
          {action?.kind === "revoke" ? (
            <TextField
              label={t("accountDetail.signatures.reasonLabel")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          ) : null}
        </form>
      </Drawer>
    </div>
  );
}
