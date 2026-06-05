"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import {
  createProxy,
  fetchProxies,
  updateProxy,
  updateProxyStatus,
  type ClientProxy,
  type ProxyAction,
  type ProxyVerificationStatus,
  type ProxyWritePayload,
} from "@/lib/api/client-proxies";
import { localizeApiError } from "@/lib/api/errors";
import {
  fetchIdentityDocumentTypes,
  type IdentityDocumentType,
} from "@/lib/api/reference";
import { isKnownIdentityDocumentType } from "@/lib/catalogs/identity-document-types";
import { ImageUploadField } from "../../../_components/ImageUploadField";
import { SubResourceActionDrawer } from "./SubResourceActionDrawer";

type Props = {
  clientPublicId: string;
  /** Client's agency — sent on document upload (back-issue #11). */
  agencyPublicId?: string | null;
  onCountChange?: (count: number) => void;
};

/**
 * Backend identity-document keys not in the legacy local slug catalog but with
 * a French i18n label — mirrors IdentityDocumentsTab so proxy ID types render
 * the same labels.
 */
const I18N_BACKEND_TYPE_KEYS = new Set(["national_id", "drivers_license"]);

/**
 * Tones for the KYC review state shown in the "Statut" column. The lifecycle
 * states (inactive/expired/archived) are handled directly in the column cell
 * with a muted/warning treatment rather than via this map.
 */
const VERIFICATION_TONE: Record<
  ProxyVerificationStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  pending: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
};

export function ProxiesTab({
  clientPublicId,
  agencyPublicId,
  onCountChange,
}: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const canCreate = useCan("crm.proxies.create");
  const canEdit = useCan("crm.proxies.update");
  const canSubmit = useCan("crm.proxies.create");
  const canVerify = useCan("crm.proxies.verify");
  const canReject = useCan("crm.proxies.reject");
  const canArchive = useCan("crm.proxies.archive");
  const canExpire = useCan("crm.proxies.expire");

  const token = session.status === "authenticated" ? session.token : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ClientProxy | null>(null);
  const [actionDrawer, setActionDrawer] = useState<{
    row: ClientProxy;
    action: ProxyAction;
  } | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ClientProxy[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchProxies(token, clientPublicId);
    },
    [token, clientPublicId],
  );

  const { data, loading, refetch } = useApi(fetcher, [token, clientPublicId]);

  // Accepted identity-document catalog (back-issue #3) — drives the proxy
  // ID-type select + recto/verso requirement, from the same source the client
  // identity documents use so the keys pass backend validation (issue #4).
  const [docTypes, setDocTypes] = useState<IdentityDocumentType[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchIdentityDocumentTypes(token)
      .then((types) => {
        if (!cancelled) setDocTypes(types);
      })
      .catch(() => {
        if (!cancelled) setDocTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (data) onCountChange?.(data.length);
  }, [data, onCountChange]);

  async function handleSubmit(payload: ProxyWritePayload) {
    if (!token) return;
    if (editing) {
      await updateProxy(token, clientPublicId, editing.public_id, payload);
      toast.success(
        t("clientDetail.proxies.toast.updatedTitle"),
        t("clientDetail.proxies.toast.updatedBody"),
      );
    } else {
      await createProxy(token, clientPublicId, payload);
      toast.success(
        t("clientDetail.proxies.toast.createdTitle"),
        t("clientDetail.proxies.toast.createdBody"),
      );
    }
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  async function handleAction(payload: {
    action: ProxyAction;
    reason: string | null;
    comment: string | null;
    allow_self_verify: boolean;
  }) {
    if (!token || !actionDrawer) return;
    await updateProxyStatus(
      token,
      clientPublicId,
      actionDrawer.row.public_id,
      payload,
    );
    toast.success(
      t("clientDetail.proxies.toast.statusChangedTitle"),
      t("clientDetail.proxies.toast.statusChangedBody", {
        action: t(`clientDetail.proxies.action.title.${payload.action}`),
      }),
    );
    setActionDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<ClientProxy, unknown>[]>(
    () => [
      {
        accessorKey: "proxy_full_name",
        header: t("clientDetail.proxies.columns.name"),
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "mandate_type",
        header: t("clientDetail.proxies.columns.mandate"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "proxy_phone_number",
        header: t("clientDetail.proxies.columns.phone"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "starts_on",
        header: t("clientDetail.proxies.columns.startsOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="tabular-nums text-muted-foreground">{value.slice(0, 10)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "ends_on",
        header: t("clientDetail.proxies.columns.endsOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="tabular-nums text-muted-foreground">{value.slice(0, 10)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "verification_status",
        header: t("clientDetail.proxies.columns.status"),
        cell: ({ row, getValue }) => {
          // Out-of-flow lifecycle states (inactive/expired/archived) take
          // precedence over the verification badge. Expired reads as a warning.
          const lifecycle = row.original.status;
          if (lifecycle !== "active") {
            return (
              <Badge tone={lifecycle === "expired" ? "warning" : "neutral"}>
                {t(`clientDetail.proxies.status.${lifecycle}`)}
              </Badge>
            );
          }
          const verification = getValue() as ProxyVerificationStatus;
          const reason = row.original.rejection_reason;
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={VERIFICATION_TONE[verification]}>
                {t(`clientDetail.proxies.verificationStatus.${verification}`)}
              </Badge>
              {verification === "rejected" && reason ? (
                <span
                  className="max-w-[18rem] text-xs text-danger"
                  title={reason}
                >
                  {t("common.rejectionReason", { reason })}
                </span>
              ) : null}
            </div>
          );
        },
      },
      ...(canEdit || canSubmit || canVerify || canReject || canArchive || canExpire
        ? [
            {
              id: "actions",
              header: t("clientDetail.proxies.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const rec = row.original;
                const items: DropdownMenuItem[] = [];
                // Review actions only apply to live (active) records and are
                // gated on the KYC review state, not the lifecycle flag.
                const isLive = rec.status === "active";
                const verification = rec.verification_status;
                if (
                  canEdit &&
                  isLive &&
                  (verification === "pending" || verification === "rejected")
                ) {
                  items.push({
                    label: t("clientDetail.proxies.actions.edit"),
                    onClick: () => {
                      setEditing(rec);
                      setDrawerOpen(true);
                    },
                  });
                }
                if (
                  canSubmit &&
                  isLive &&
                  (verification === "pending" || verification === "rejected")
                ) {
                  items.push({
                    label: t("clientDetail.proxies.actions.submit"),
                    onClick: () => setActionDrawer({ row: rec, action: "submit" }),
                  });
                }
                if (canVerify && isLive && verification === "pending_review") {
                  items.push({
                    label: t("clientDetail.proxies.actions.verify"),
                    onClick: () => setActionDrawer({ row: rec, action: "verify" }),
                  });
                }
                if (canReject && isLive && verification === "pending_review") {
                  items.push({
                    label: t("clientDetail.proxies.actions.reject"),
                    onClick: () => setActionDrawer({ row: rec, action: "reject" }),
                    destructive: true,
                  });
                }
                if (canExpire && isLive && verification === "verified") {
                  items.push({
                    label: t("clientDetail.proxies.actions.expire"),
                    onClick: () => setActionDrawer({ row: rec, action: "expire" }),
                  });
                }
                if (canArchive && isLive && verification === "verified") {
                  items.push({
                    label: t("clientDetail.proxies.actions.deactivate"),
                    onClick: () => setActionDrawer({ row: rec, action: "deactivate" }),
                  });
                }
                if (canArchive && rec.status !== "archived") {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    label: t("clientDetail.proxies.actions.archive"),
                    onClick: () => setActionDrawer({ row: rec, action: "archive" }),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("clientDetail.proxies.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<ClientProxy, unknown>,
          ]
        : []),
    ],
    [t, canEdit, canSubmit, canVerify, canReject, canArchive, canExpire],
  );

  return (
    <div className="flex flex-col gap-4">
      <DataTable<ClientProxy>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("clientDetail.proxies.empty")}
        getRowId={(row) => row.public_id}
        title={t("clientDetail.proxies.title")}
        titleAside={t("clientDetail.proxies.count", { count: data?.length ?? 0 })}
      />

      {canCreate ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            + {t("clientDetail.proxies.actions.create")}
          </Button>
        </div>
      ) : null}

      <ProxyDrawer
        open={drawerOpen}
        editing={editing}
        docTypes={docTypes}
        agencyPublicId={agencyPublicId}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <SubResourceActionDrawer
        open={actionDrawer !== null}
        action={actionDrawer?.action ?? null}
        targetLabel={actionDrawer?.row.proxy_full_name ?? ""}
        i18nNamespace="clientDetail.proxies"
        onClose={() => setActionDrawer(null)}
        onSubmit={handleAction}
      />
    </div>
  );
}

function ProxyDrawer({
  open,
  editing,
  docTypes,
  agencyPublicId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ClientProxy | null;
  docTypes: IdentityDocumentType[];
  agencyPublicId?: string | null;
  onClose: () => void;
  onSubmit: (payload: ProxyWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const [form, setForm] = useState({
    proxy_full_name: "",
    proxy_phone_number: "",
    proxy_email: "",
    proxy_id_document_type: "",
    proxy_id_document_number: "",
    mandate_type: "",
    starts_on: "",
    ends_on: "",
    document_public_id: "",
    back_document_public_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (editing) {
      setForm({
        proxy_full_name: editing.proxy_full_name ?? "",
        proxy_phone_number: editing.proxy_phone_number ?? "",
        proxy_email: editing.proxy_email ?? "",
        proxy_id_document_type: editing.proxy_id_document_type ?? "",
        proxy_id_document_number: editing.proxy_id_document_number ?? "",
        mandate_type: editing.mandate_type ?? "",
        starts_on: editing.starts_on ? editing.starts_on.slice(0, 10) : "",
        ends_on: editing.ends_on ? editing.ends_on.slice(0, 10) : "",
        document_public_id: editing.document_public_id ?? "",
        back_document_public_id: editing.back_document_public_id ?? "",
      });
    } else {
      setForm({
        proxy_full_name: "",
        proxy_phone_number: "",
        proxy_email: "",
        proxy_id_document_type: "",
        proxy_id_document_number: "",
        mandate_type: "",
        starts_on: "",
        ends_on: "",
        document_public_id: "",
        back_document_public_id: "",
      });
    }
  }, [open, editing]);

  // A proxy is a natural person, so the accepted identity-document catalog
  // applies. Sourced from the backend (issue #4) so the keys validate and the
  // recto/verso requirement is driven by `required_faces`; labels are shared
  // with the identity-documents tab (single i18n source).
  const idDocumentTypeOptions = useMemo<
    Array<{ value: string; label: string }>
  >(() => {
    const options: Array<{ value: string; label: string }> = docTypes.map(
      (type) => ({
        value: type.key,
        label:
          isKnownIdentityDocumentType(type.key) ||
          I18N_BACKEND_TYPE_KEYS.has(type.key)
            ? t(`clientDetail.identityDocs.types.${type.key}`)
            : type.label,
      }),
    );
    // Preserve any legacy free-text value on an existing record so editing
    // doesn't silently clear it.
    const currentValue = editing?.proxy_id_document_type;
    if (
      currentValue &&
      !options.some((option) => option.value === currentValue)
    ) {
      options.push({
        value: currentValue,
        label: `${currentValue} (${t("clientDetail.identityDocs.types.legacyTag")})`,
      });
    }
    return options;
  }, [docTypes, editing, t]);

  const selectedDocType = docTypes.find(
    (type) => type.key === form.proxy_id_document_type,
  );
  const requiresBackFace = (selectedDocType?.required_faces ?? 1) >= 2;

  function changeDocType(next: string) {
    const nextType = docTypes.find((type) => type.key === next);
    const nextRequiresBack = (nextType?.required_faces ?? 1) >= 2;
    setForm((c) => ({
      ...c,
      proxy_id_document_type: next,
      // Drop a captured verso when switching to a single-face type.
      back_document_public_id: nextRequiresBack ? c.back_document_public_id : "",
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      await onSubmit({
        proxy_full_name: form.proxy_full_name.trim(),
        proxy_phone_number: nullable(form.proxy_phone_number),
        proxy_email: nullable(form.proxy_email),
        proxy_id_document_type: nullable(form.proxy_id_document_type),
        proxy_id_document_number: nullable(form.proxy_id_document_number),
        mandate_type: form.mandate_type.trim(),
        starts_on: nullable(form.starts_on),
        ends_on: nullable(form.ends_on),
        document_public_id: nullable(form.document_public_id),
        back_document_public_id: requiresBackFace
          ? nullable(form.back_document_public_id)
          : null,
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        proxy_full_name: t("clientDetail.proxies.fields.name"),
        proxy_phone_number: t("clientDetail.proxies.fields.phone"),
        proxy_email: t("clientDetail.proxies.fields.email"),
        proxy_id_document_type: t("clientDetail.proxies.fields.idType"),
        proxy_id_document_number: t("clientDetail.proxies.fields.idNumber"),
        mandate_type: t("clientDetail.proxies.fields.mandateType"),
        starts_on: t("clientDetail.proxies.fields.startsOn"),
        ends_on: t("clientDetail.proxies.fields.endsOn"),
        document_public_id: t("clientDetail.proxies.fields.document"),
        back_document_public_id: t("clientDetail.proxies.fields.documentBack"),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        editing
          ? t("clientDetail.proxies.drawer.titleEdit")
          : t("clientDetail.proxies.drawer.titleCreate")
      }
      description={t("clientDetail.proxies.drawer.hint")}
      widthClassName="sm:w-[34rem]"
      footer={
        <>
          <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="proxy-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("common.save")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {generalError}
        </p>
      ) : null}
      <form id="proxy-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t("clientDetail.proxies.fields.name")}
          value={form.proxy_full_name}
          onChange={(event) => setForm((c) => ({ ...c, proxy_full_name: event.target.value }))}
          error={errors.proxy_full_name}
          required
        />
        <TextField
          label={t("clientDetail.proxies.fields.mandateType")}
          value={form.mandate_type}
          onChange={(event) => setForm((c) => ({ ...c, mandate_type: event.target.value }))}
          error={errors.mandate_type}
          required
          hint={t("clientDetail.proxies.fields.mandateTypeHint")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("clientDetail.proxies.fields.phone")}
            type="tel"
            value={form.proxy_phone_number}
            onChange={(event) =>
              setForm((c) => ({ ...c, proxy_phone_number: event.target.value }))
            }
            error={errors.proxy_phone_number}
          />
          <TextField
            label={t("clientDetail.proxies.fields.email")}
            type="email"
            value={form.proxy_email}
            onChange={(event) => setForm((c) => ({ ...c, proxy_email: event.target.value }))}
            error={errors.proxy_email}
          />
          <Select
            label={t("clientDetail.proxies.fields.idType")}
            value={form.proxy_id_document_type}
            options={idDocumentTypeOptions}
            placeholder={t("clientDetail.proxies.fields.idTypePlaceholder")}
            isClearable
            onChange={changeDocType}
            error={errors.proxy_id_document_type}
          />
          <TextField
            label={t("clientDetail.proxies.fields.idNumber")}
            value={form.proxy_id_document_number}
            onChange={(event) =>
              setForm((c) => ({ ...c, proxy_id_document_number: event.target.value }))
            }
            error={errors.proxy_id_document_number}
          />
          <TextField
            label={t("clientDetail.proxies.fields.startsOn")}
            type="date"
            value={form.starts_on}
            onChange={(event) => setForm((c) => ({ ...c, starts_on: event.target.value }))}
            error={errors.starts_on}
          />
          <TextField
            label={t("clientDetail.proxies.fields.endsOn")}
            type="date"
            value={form.ends_on}
            onChange={(event) => setForm((c) => ({ ...c, ends_on: event.target.value }))}
            error={errors.ends_on}
          />
        </div>
        <ImageUploadField
          category="identity"
          value={form.document_public_id}
          agencyPublicId={agencyPublicId}
          onChange={(id) => setForm((c) => ({ ...c, document_public_id: id }))}
          label={t("clientDetail.proxies.fields.document")}
          hint={t("clientDetail.proxies.fields.documentHint")}
          error={errors.document_public_id}
        />
        {requiresBackFace ? (
          <ImageUploadField
            category="identity"
            value={form.back_document_public_id}
            agencyPublicId={agencyPublicId}
            onChange={(id) =>
              setForm((c) => ({ ...c, back_document_public_id: id }))
            }
            label={t("clientDetail.proxies.fields.documentBack")}
            hint={t("clientDetail.proxies.fields.documentBackHint")}
            error={errors.back_document_public_id}
          />
        ) : null}
      </form>
    </Drawer>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
