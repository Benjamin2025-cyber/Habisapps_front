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
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import {
  createIdentityDocument,
  fetchIdentityDocuments,
  updateIdentityDocument,
  updateIdentityDocumentStatus,
  type ClientIdentityDocument,
  type IdentityDocumentAction,
  type IdentityDocumentVerificationStatus,
  type IdentityDocumentWritePayload,
} from "@/lib/api/client-identity-documents";
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
  /** Hoisted so the parent can show a badge count next to the tab. */
  onCountChange?: (count: number) => void;
};

/**
 * Backend keys that are NOT in the legacy local slug catalog but DO have a
 * French i18n label. Together with `isKnownIdentityDocumentType` they tell us
 * when to prefer an i18n label over the server-provided (English) one.
 */
const I18N_BACKEND_TYPE_KEYS = new Set(["national_id", "drivers_license"]);

function identityTypeLabel(
  key: string,
  t: (k: string) => string,
  catalogByKey: Map<string, IdentityDocumentType>,
): string {
  if (isKnownIdentityDocumentType(key) || I18N_BACKEND_TYPE_KEYS.has(key)) {
    return t(`clientDetail.identityDocs.types.${key}`);
  }
  return catalogByKey.get(key)?.label ?? key ?? "—";
}

/**
 * Common Cameroon issuing authorities offered as autocomplete suggestions on
 * the free-text `issuing_authority` field. The user can pick one or type any
 * value (e.g. a foreign authority for a non-national document).
 */
const ISSUING_AUTHORITY_SUGGESTIONS = [
  "Délégation Générale à la Sûreté Nationale (DGSN)",
  "Ministère des Transports",
  "Préfecture",
  "Sous-préfecture",
  "Mairie",
  "Consulat",
];


/**
 * Tones for the KYC review state shown in the "Statut" column. Archived
 * records are rendered with a muted treatment by the column cell rather than
 * via this map (archival is a lifecycle flag, not a verification state).
 */
const VERIFICATION_TONE: Record<
  IdentityDocumentVerificationStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  pending: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
};

export function IdentityDocumentsTab({
  clientPublicId,
  agencyPublicId,
  onCountChange,
}: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const canCreate = useCan("crm.identity_documents.create");
  const canEdit = useCan("crm.identity_documents.update");
  const canSubmit = useCan("crm.identity_documents.create");
  const canVerify = useCan("crm.identity_documents.verify");
  const canReject = useCan("crm.identity_documents.reject");
  const canArchive = useCan("crm.identity_documents.archive");

  const token = session.status === "authenticated" ? session.token : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ClientIdentityDocument | null>(null);
  const [actionDrawer, setActionDrawer] = useState<{
    doc: ClientIdentityDocument;
    action: IdentityDocumentAction;
  } | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ClientIdentityDocument[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchIdentityDocuments(token, clientPublicId);
    },
    [token, clientPublicId],
  );

  const { data, loading, refetch } = useApi(fetcher, [token, clientPublicId]);

  // Accepted document-type catalog (back-issue #3). Drives the type select +
  // recto/verso & expiry requirements, and the column label resolution.
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

  const typeByKey = useMemo(
    () => new Map(docTypes.map((type) => [type.key, type])),
    [docTypes],
  );

  // Surface row count back up so the tab badge stays accurate.
  useEffect(() => {
    if (data) onCountChange?.(data.length);
  }, [data, onCountChange]);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(doc: ClientIdentityDocument) {
    setEditing(doc);
    setDrawerOpen(true);
  }

  async function handleSubmit(payload: IdentityDocumentWritePayload) {
    if (!token) return;
    if (editing) {
      await updateIdentityDocument(token, clientPublicId, editing.public_id, payload);
      toast.success(
        t("clientDetail.identityDocs.toast.updatedTitle"),
        t("clientDetail.identityDocs.toast.updatedBody"),
      );
    } else {
      await createIdentityDocument(token, clientPublicId, payload);
      toast.success(
        t("clientDetail.identityDocs.toast.createdTitle"),
        t("clientDetail.identityDocs.toast.createdBody"),
      );
    }
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  async function handleAction(payload: {
    action: IdentityDocumentAction;
    reason: string | null;
    comment: string | null;
    allow_self_verify: boolean;
  }) {
    if (!token || !actionDrawer) return;
    await updateIdentityDocumentStatus(
      token,
      clientPublicId,
      actionDrawer.doc.public_id,
      payload,
    );
    toast.success(
      t("clientDetail.identityDocs.toast.statusChangedTitle"),
      t("clientDetail.identityDocs.toast.statusChangedBody", {
        action: t(`clientDetail.identityDocs.action.title.${payload.action}`),
      }),
    );
    setActionDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<ClientIdentityDocument, unknown>[]>(
    () => [
      {
        accessorKey: "document_type",
        header: t("clientDetail.identityDocs.columns.type"),
        cell: ({ getValue }) => {
          const raw = String(getValue() ?? "");
          const label = raw ? identityTypeLabel(raw, t, typeByKey) : "—";
          return <span className="font-semibold text-foreground">{label}</span>;
        },
      },
      {
        accessorKey: "document_number",
        header: t("clientDetail.identityDocs.columns.number"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        accessorKey: "issuing_authority",
        header: t("clientDetail.identityDocs.columns.authority"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "issued_on",
        header: t("clientDetail.identityDocs.columns.issuedOn"),
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
        accessorKey: "expires_on",
        header: t("clientDetail.identityDocs.columns.expiresOn"),
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
        header: t("clientDetail.identityDocs.columns.status"),
        cell: ({ row, getValue }) => {
          // Archived records are out of the review flow — show the lifecycle
          // state muted rather than a stale verification badge.
          if (row.original.status === "archived") {
            return (
              <Badge tone="neutral">
                {t("clientDetail.identityDocs.status.archived")}
              </Badge>
            );
          }
          const verification = getValue() as IdentityDocumentVerificationStatus;
          const reason = row.original.rejection_reason;
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={VERIFICATION_TONE[verification]}>
                {t(`clientDetail.identityDocs.verificationStatus.${verification}`)}
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
      ...(canEdit || canSubmit || canVerify || canReject || canArchive
        ? [
            {
              id: "actions",
              header: t("clientDetail.identityDocs.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const doc = row.original;
                const items: DropdownMenuItem[] = [];
                // Review actions only apply to live (non-archived) records and
                // are gated on the KYC review state, not the lifecycle flag.
                const isArchived = doc.status === "archived";
                const verification = doc.verification_status;
                if (
                  canEdit &&
                  !isArchived &&
                  (verification === "pending" || verification === "rejected")
                ) {
                  items.push({
                    label: t("clientDetail.identityDocs.actions.edit"),
                    onClick: () => openEdit(doc),
                  });
                }
                if (
                  canSubmit &&
                  !isArchived &&
                  (verification === "pending" || verification === "rejected")
                ) {
                  items.push({
                    label: t("clientDetail.identityDocs.actions.submit"),
                    onClick: () => setActionDrawer({ doc, action: "submit" }),
                  });
                }
                if (canVerify && !isArchived && verification === "pending_review") {
                  items.push({
                    label: t("clientDetail.identityDocs.actions.verify"),
                    onClick: () => setActionDrawer({ doc, action: "verify" }),
                  });
                }
                if (canReject && !isArchived && verification === "pending_review") {
                  items.push({
                    label: t("clientDetail.identityDocs.actions.reject"),
                    onClick: () => setActionDrawer({ doc, action: "reject" }),
                    destructive: true,
                  });
                }
                if (canArchive && !isArchived) {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    label: t("clientDetail.identityDocs.actions.archive"),
                    onClick: () => setActionDrawer({ doc, action: "archive" }),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("clientDetail.identityDocs.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<ClientIdentityDocument, unknown>,
          ]
        : []),
    ],
    [t, typeByKey, canEdit, canSubmit, canVerify, canReject, canArchive],
  );

  return (
    <div className="flex flex-col gap-4">
      <DataTable<ClientIdentityDocument>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("clientDetail.identityDocs.empty")}
        getRowId={(row) => row.public_id}
        title={t("clientDetail.identityDocs.title")}
        titleAside={t("clientDetail.identityDocs.count", { count: data?.length ?? 0 })}
      />

      {canCreate ? (
        <div>
          <Button variant="primary" size="sm" onClick={openCreate}>
            + {t("clientDetail.identityDocs.actions.create")}
          </Button>
        </div>
      ) : null}

      <IdentityDocumentDrawer
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
        targetLabel={
          actionDrawer
            ? `${actionDrawer.doc.document_type} — ${actionDrawer.doc.document_number}`
            : ""
        }
        i18nNamespace="clientDetail.identityDocs"
        onClose={() => setActionDrawer(null)}
        onSubmit={handleAction}
      />
    </div>
  );
}

function IdentityDocumentDrawer({
  open,
  editing,
  docTypes,
  agencyPublicId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ClientIdentityDocument | null;
  docTypes: IdentityDocumentType[];
  agencyPublicId?: string | null;
  onClose: () => void;
  onSubmit: (payload: IdentityDocumentWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const [form, setForm] = useState({
    document_type: "",
    document_number: "",
    issuing_authority: "",
    issued_on: "",
    expires_on: "",
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
        document_type: editing.document_type,
        document_number: editing.document_number,
        issuing_authority: editing.issuing_authority ?? "",
        issued_on: editing.issued_on ? editing.issued_on.slice(0, 10) : "",
        expires_on: editing.expires_on ? editing.expires_on.slice(0, 10) : "",
        document_public_id: editing.document_public_id ?? "",
        back_document_public_id: editing.back_document_public_id ?? "",
      });
    } else {
      setForm({
        document_type: "",
        document_number: "",
        issuing_authority: "",
        issued_on: "",
        expires_on: "",
        document_public_id: "",
        back_document_public_id: "",
      });
    }
  }, [open, editing]);

  const documentTypeOptions = useMemo<
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
    // If editing a record whose type isn't in the catalog (legacy free text),
    // surface it as an additional option so the form doesn't silently clear.
    const currentValue = editing?.document_type;
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

  const selectedType = docTypes.find((type) => type.key === form.document_type);
  const requiresBackFace = (selectedType?.required_faces ?? 1) >= 2;
  const requiresExpiry = selectedType?.requires_expiry ?? false;

  function changeType(next: string) {
    const nextType = docTypes.find((type) => type.key === next);
    const nextRequiresBack = (nextType?.required_faces ?? 1) >= 2;
    setForm((c) => ({
      ...c,
      document_type: next,
      // Drop a previously-captured verso when switching to a single-face type
      // so we never submit a stale back document.
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
        document_type: form.document_type.trim(),
        document_number: form.document_number.trim(),
        issuing_authority: nullable(form.issuing_authority),
        issued_on: nullable(form.issued_on),
        expires_on: nullable(form.expires_on),
        document_public_id: nullable(form.document_public_id),
        back_document_public_id: requiresBackFace
          ? nullable(form.back_document_public_id)
          : null,
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        document_type: t("clientDetail.identityDocs.fields.type"),
        document_number: t("clientDetail.identityDocs.fields.number"),
        issuing_authority: t("clientDetail.identityDocs.fields.authority"),
        issued_on: t("clientDetail.identityDocs.fields.issuedOn"),
        expires_on: t("clientDetail.identityDocs.fields.expiresOn"),
        document_public_id: t("clientDetail.identityDocs.fields.document"),
        back_document_public_id: t("clientDetail.identityDocs.fields.documentBack"),
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
          ? t("clientDetail.identityDocs.drawer.titleEdit")
          : t("clientDetail.identityDocs.drawer.titleCreate")
      }
      description={t("clientDetail.identityDocs.drawer.hint")}
      footer={
        <>
          <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="identity-document-form"
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
      <form
        id="identity-document-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Select
          label={t("clientDetail.identityDocs.fields.type")}
          value={form.document_type}
          options={documentTypeOptions}
          placeholder={t("clientDetail.identityDocs.fields.typePlaceholder")}
          onChange={changeType}
          error={errors.document_type}
        />
        <TextField
          label={t("clientDetail.identityDocs.fields.number")}
          value={form.document_number}
          onChange={(event) => setForm((c) => ({ ...c, document_number: event.target.value }))}
          error={errors.document_number}
          required
        />
        <TextField
          label={t("clientDetail.identityDocs.fields.authority")}
          value={form.issuing_authority}
          onChange={(event) => setForm((c) => ({ ...c, issuing_authority: event.target.value }))}
          error={errors.issuing_authority}
          hint={t("clientDetail.identityDocs.fields.authorityHint")}
          list="kyc-issuing-authorities"
        />
        <datalist id="kyc-issuing-authorities">
          {ISSUING_AUTHORITY_SUGGESTIONS.map((authority) => (
            <option key={authority} value={authority} />
          ))}
        </datalist>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("clientDetail.identityDocs.fields.issuedOn")}
            type="date"
            value={form.issued_on}
            onChange={(event) => setForm((c) => ({ ...c, issued_on: event.target.value }))}
            error={errors.issued_on}
          />
          <TextField
            label={t("clientDetail.identityDocs.fields.expiresOn")}
            type="date"
            value={form.expires_on}
            onChange={(event) => setForm((c) => ({ ...c, expires_on: event.target.value }))}
            error={errors.expires_on}
            hint={
              requiresExpiry
                ? t("clientDetail.identityDocs.fields.expiryRequiredHint")
                : undefined
            }
          />
        </div>
        {/* An expired (or same-day) document can't be verified by the API
            (expires_on < now), so warn before the user submits it. */}
        {form.expires_on &&
        form.expires_on <= new Date().toISOString().slice(0, 10) ? (
          <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("clientDetail.identityDocs.fields.expiredWarning")}
          </p>
        ) : null}
        <ImageUploadField
          category="identity"
          value={form.document_public_id}
          agencyPublicId={agencyPublicId}
          onChange={(id) => setForm((c) => ({ ...c, document_public_id: id }))}
          label={t("clientDetail.identityDocs.fields.document")}
          hint={t("clientDetail.identityDocs.fields.documentHint")}
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
            label={t("clientDetail.identityDocs.fields.documentBack")}
            hint={t("clientDetail.identityDocs.fields.documentBackHint")}
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
