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
  IDENTITY_DOCUMENT_TYPE_SLUGS,
  isKnownIdentityDocumentType,
} from "@/lib/catalogs/identity-document-types";
import { SubResourceActionDrawer } from "./SubResourceActionDrawer";

type Props = {
  clientPublicId: string;
  /** Hoisted so the parent can show a badge count next to the tab. */
  onCountChange?: (count: number) => void;
};


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
          const label = isKnownIdentityDocumentType(raw)
            ? t(`clientDetail.identityDocs.types.${raw}`)
            : raw || "—";
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
          return (
            <Badge tone={VERIFICATION_TONE[verification]}>
              {t(`clientDetail.identityDocs.verificationStatus.${verification}`)}
            </Badge>
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
                if (canSubmit && !isArchived && verification === "pending") {
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
    [t, canEdit, canSubmit, canVerify, canReject, canArchive],
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
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ClientIdentityDocument | null;
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
      });
    } else {
      setForm({
        document_type: "",
        document_number: "",
        issuing_authority: "",
        issued_on: "",
        expires_on: "",
      });
    }
  }, [open, editing]);

  const documentTypeOptions = useMemo<
    Array<{ value: string; label: string }>
  >(() => {
    const options: Array<{ value: string; label: string }> =
      IDENTITY_DOCUMENT_TYPE_SLUGS.map((slug) => ({
        value: slug,
        label: t(`clientDetail.identityDocs.types.${slug}`),
      }));
    // If editing a record whose type isn't in our catalog (legacy free text),
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
  }, [editing, t]);

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
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        document_type: t("clientDetail.identityDocs.fields.type"),
        document_number: t("clientDetail.identityDocs.fields.number"),
        issuing_authority: t("clientDetail.identityDocs.fields.authority"),
        issued_on: t("clientDetail.identityDocs.fields.issuedOn"),
        expires_on: t("clientDetail.identityDocs.fields.expiresOn"),
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
          onChange={(next) => setForm((c) => ({ ...c, document_type: next }))}
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
        />
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
          />
        </div>
      </form>
    </Drawer>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
