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
  createGuarantor,
  fetchGuarantors,
  updateGuarantor,
  updateGuarantorStatus,
  type ClientGuarantor,
  type GuarantorAction,
  type GuarantorVerificationStatus,
  type GuarantorWritePayload,
} from "@/lib/api/client-guarantors";
import { localizeApiError } from "@/lib/api/errors";
import { SubResourceActionDrawer } from "./SubResourceActionDrawer";

type Props = {
  clientPublicId: string;
  onCountChange?: (count: number) => void;
};

/**
 * Canonical guarantor-relationship catalog tuned for Cameroon microfinance.
 *
 * Stored value is the slug (locale-stable); the FR label comes from i18n.
 * Includes specific cases like `tontine_member` and `traditional_chief`
 * which are common community-based guarantor profiles locally.
 */
const RELATIONSHIP_SLUGS = [
  "father",
  "mother",
  "spouse",
  "sibling",
  "child",
  "uncle_aunt",
  "cousin",
  "grandparent",
  "parent_in_law",
  "friend",
  "neighbor",
  "colleague",
  "employer",
  "employee",
  "business_partner",
  "tontine_member",
  "traditional_chief",
  "religious_leader",
  "legal_guardian",
  "other",
] as const;

type RelationshipSlug = (typeof RELATIONSHIP_SLUGS)[number];

function isKnownRelationship(value: string): value is RelationshipSlug {
  return (RELATIONSHIP_SLUGS as readonly string[]).includes(value);
}

/**
 * Tones for the KYC review state shown in the "Statut" column. The lifecycle
 * states (inactive/archived) are handled directly in the column cell with a
 * muted treatment rather than via this map.
 */
const VERIFICATION_TONE: Record<
  GuarantorVerificationStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  pending: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
};

export function GuarantorsTab({ clientPublicId, onCountChange }: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const canCreate = useCan("crm.guarantors.create");
  const canEdit = useCan("crm.guarantors.update");
  const canSubmit = useCan("crm.guarantors.create");
  const canVerify = useCan("crm.guarantors.verify");
  const canReject = useCan("crm.guarantors.reject");
  const canArchive = useCan("crm.guarantors.archive");

  const token = session.status === "authenticated" ? session.token : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ClientGuarantor | null>(null);
  const [actionDrawer, setActionDrawer] = useState<{
    row: ClientGuarantor;
    action: GuarantorAction;
  } | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ClientGuarantor[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchGuarantors(token, clientPublicId);
    },
    [token, clientPublicId],
  );

  const { data, loading, refetch } = useApi(fetcher, [token, clientPublicId]);

  useEffect(() => {
    if (data) onCountChange?.(data.length);
  }, [data, onCountChange]);

  async function handleSubmit(payload: GuarantorWritePayload) {
    if (!token) return;
    if (editing) {
      await updateGuarantor(token, clientPublicId, editing.public_id, payload);
      toast.success(
        t("clientDetail.guarantors.toast.updatedTitle"),
        t("clientDetail.guarantors.toast.updatedBody"),
      );
    } else {
      await createGuarantor(token, clientPublicId, payload);
      toast.success(
        t("clientDetail.guarantors.toast.createdTitle"),
        t("clientDetail.guarantors.toast.createdBody"),
      );
    }
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  async function handleAction(payload: {
    action: GuarantorAction;
    reason: string | null;
    comment: string | null;
  }) {
    if (!token || !actionDrawer) return;
    await updateGuarantorStatus(
      token,
      clientPublicId,
      actionDrawer.row.public_id,
      payload,
    );
    toast.success(
      t("clientDetail.guarantors.toast.statusChangedTitle"),
      t("clientDetail.guarantors.toast.statusChangedBody", {
        action: t(`clientDetail.guarantors.action.title.${payload.action}`),
      }),
    );
    setActionDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<ClientGuarantor, unknown>[]>(
    () => [
      {
        accessorKey: "guarantor_full_name",
        header: t("clientDetail.guarantors.columns.name"),
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "relationship_type",
        header: t("clientDetail.guarantors.columns.relationship"),
        cell: ({ getValue }) => {
          const raw = (getValue() as string | null) ?? "";
          if (!raw) return <span className="text-muted-foreground">—</span>;
          const label = isKnownRelationship(raw)
            ? t(`clientDetail.guarantors.relationships.${raw}`)
            : raw;
          return <span className="text-muted-foreground">{label}</span>;
        },
      },
      {
        accessorKey: "guarantor_phone_number",
        header: t("clientDetail.guarantors.columns.phone"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "starts_on",
        header: t("clientDetail.guarantors.columns.startsOn"),
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
        header: t("clientDetail.guarantors.columns.endsOn"),
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
        header: t("clientDetail.guarantors.columns.status"),
        cell: ({ row, getValue }) => {
          // Inactive/archived records are out of the review flow — show the
          // lifecycle state muted rather than a stale verification badge.
          const lifecycle = row.original.status;
          if (lifecycle === "archived" || lifecycle === "inactive") {
            return (
              <Badge tone="neutral">
                {t(`clientDetail.guarantors.status.${lifecycle}`)}
              </Badge>
            );
          }
          const verification = getValue() as GuarantorVerificationStatus;
          return (
            <Badge tone={VERIFICATION_TONE[verification]}>
              {t(`clientDetail.guarantors.verificationStatus.${verification}`)}
            </Badge>
          );
        },
      },
      ...(canEdit || canSubmit || canVerify || canReject || canArchive
        ? [
            {
              id: "actions",
              header: t("clientDetail.guarantors.columns.actions"),
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
                    label: t("clientDetail.guarantors.actions.edit"),
                    onClick: () => {
                      setEditing(rec);
                      setDrawerOpen(true);
                    },
                  });
                }
                if (canSubmit && isLive && verification === "pending") {
                  items.push({
                    label: t("clientDetail.guarantors.actions.submit"),
                    onClick: () => setActionDrawer({ row: rec, action: "submit" }),
                  });
                }
                if (canVerify && isLive && verification === "pending_review") {
                  items.push({
                    label: t("clientDetail.guarantors.actions.verify"),
                    onClick: () => setActionDrawer({ row: rec, action: "verify" }),
                  });
                }
                if (canReject && isLive && verification === "pending_review") {
                  items.push({
                    label: t("clientDetail.guarantors.actions.reject"),
                    onClick: () => setActionDrawer({ row: rec, action: "reject" }),
                    destructive: true,
                  });
                }
                if (canArchive && isLive && verification === "verified") {
                  items.push({
                    label: t("clientDetail.guarantors.actions.deactivate"),
                    onClick: () => setActionDrawer({ row: rec, action: "deactivate" }),
                  });
                }
                if (canArchive && rec.status !== "archived") {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    label: t("clientDetail.guarantors.actions.archive"),
                    onClick: () => setActionDrawer({ row: rec, action: "archive" }),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("clientDetail.guarantors.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<ClientGuarantor, unknown>,
          ]
        : []),
    ],
    [t, canEdit, canSubmit, canVerify, canReject, canArchive],
  );

  return (
    <div className="flex flex-col gap-4">
      <DataTable<ClientGuarantor>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("clientDetail.guarantors.empty")}
        getRowId={(row) => row.public_id}
        title={t("clientDetail.guarantors.title")}
        titleAside={t("clientDetail.guarantors.count", { count: data?.length ?? 0 })}
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
            + {t("clientDetail.guarantors.actions.create")}
          </Button>
        </div>
      ) : null}

      <GuarantorDrawer
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
        targetLabel={actionDrawer?.row.guarantor_full_name ?? ""}
        i18nNamespace="clientDetail.guarantors"
        onClose={() => setActionDrawer(null)}
        onSubmit={handleAction}
      />
    </div>
  );
}

function GuarantorDrawer({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ClientGuarantor | null;
  onClose: () => void;
  onSubmit: (payload: GuarantorWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const [form, setForm] = useState({
    guarantor_full_name: "",
    guarantor_phone_number: "",
    relationship_type: "",
    starts_on: "",
    ends_on: "",
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
        guarantor_full_name: editing.guarantor_full_name ?? "",
        guarantor_phone_number: editing.guarantor_phone_number ?? "",
        relationship_type: editing.relationship_type ?? "",
        starts_on: editing.starts_on ? editing.starts_on.slice(0, 10) : "",
        ends_on: editing.ends_on ? editing.ends_on.slice(0, 10) : "",
      });
    } else {
      setForm({
        guarantor_full_name: "",
        guarantor_phone_number: "",
        relationship_type: "",
        starts_on: "",
        ends_on: "",
      });
    }
  }, [open, editing]);

  const relationshipOptions = useMemo<
    Array<{ value: string; label: string }>
  >(() => {
    const options: Array<{ value: string; label: string }> =
      RELATIONSHIP_SLUGS.map((slug) => ({
        value: slug,
        label: t(`clientDetail.guarantors.relationships.${slug}`),
      }));
    // Preserve any legacy free-text relationship that isn't in the catalog so
    // we don't silently lose it on edit.
    const currentValue = editing?.relationship_type;
    if (
      currentValue &&
      !options.some((option) => option.value === currentValue)
    ) {
      options.push({
        value: currentValue,
        label: `${currentValue} (${t("clientDetail.guarantors.relationships.legacyTag")})`,
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
        guarantor_full_name: nullable(form.guarantor_full_name),
        guarantor_phone_number: nullable(form.guarantor_phone_number),
        relationship_type: nullable(form.relationship_type),
        starts_on: nullable(form.starts_on),
        ends_on: nullable(form.ends_on),
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        guarantor_full_name: t("clientDetail.guarantors.fields.name"),
        guarantor_phone_number: t("clientDetail.guarantors.fields.phone"),
        relationship_type: t("clientDetail.guarantors.fields.relationship"),
        starts_on: t("clientDetail.guarantors.fields.startsOn"),
        ends_on: t("clientDetail.guarantors.fields.endsOn"),
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
          ? t("clientDetail.guarantors.drawer.titleEdit")
          : t("clientDetail.guarantors.drawer.titleCreate")
      }
      description={t("clientDetail.guarantors.drawer.hint")}
      footer={
        <>
          <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="guarantor-form"
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
        id="guarantor-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label={t("clientDetail.guarantors.fields.name")}
          value={form.guarantor_full_name}
          onChange={(event) => setForm((c) => ({ ...c, guarantor_full_name: event.target.value }))}
          error={errors.guarantor_full_name}
          required
        />
        <TextField
          label={t("clientDetail.guarantors.fields.phone")}
          type="tel"
          value={form.guarantor_phone_number}
          onChange={(event) =>
            setForm((c) => ({ ...c, guarantor_phone_number: event.target.value }))
          }
          error={errors.guarantor_phone_number}
        />
        <Select
          label={t("clientDetail.guarantors.fields.relationship")}
          value={form.relationship_type}
          options={relationshipOptions}
          placeholder={t("clientDetail.guarantors.fields.relationshipPlaceholder")}
          isClearable
          onChange={(next) => setForm((c) => ({ ...c, relationship_type: next }))}
          error={errors.relationship_type}
          hint={t("clientDetail.guarantors.fields.relationshipHint")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("clientDetail.guarantors.fields.startsOn")}
            type="date"
            value={form.starts_on}
            onChange={(event) => setForm((c) => ({ ...c, starts_on: event.target.value }))}
            error={errors.starts_on}
          />
          <TextField
            label={t("clientDetail.guarantors.fields.endsOn")}
            type="date"
            value={form.ends_on}
            onChange={(event) => setForm((c) => ({ ...c, ends_on: event.target.value }))}
            error={errors.ends_on}
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
