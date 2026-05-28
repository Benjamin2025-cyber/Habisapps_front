"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Agency } from "@/lib/api/agencies";

type Props = {
  open: boolean;
  agency: Agency | null;
  onClose: () => void;
  onSubmit: (payload: {
    manager_public_id: string | null;
    role_at_agency: string | null;
  }) => Promise<void>;
};

/**
 * Lightweight drawer to assign / replace / clear an agency's manager.
 *
 * We accept a raw `manager_public_id` for now — a proper staff-user picker
 * will land with P5 (Référentiel Gestionnaires). The current manager (if any)
 * is shown so the user can compare.
 */
export function AgencyManagerDrawer({ open, agency, onClose, onSubmit }: Props) {
  const t = useTranslations();
  const [publicId, setPublicId] = useState("");
  const [roleAtAgency, setRoleAtAgency] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPublicId(agency?.manager_public_id ?? "");
    setRoleAtAgency("");
    setError(null);
  }, [open, agency]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        manager_public_id: publicId.trim().length === 0 ? null : publicId.trim(),
        role_at_agency:
          roleAtAgency.trim().length === 0 ? null : roleAtAgency.trim(),
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        manager_public_id: t("agencies.managerDrawer.publicIdLabel"),
        role_at_agency: t("agencies.managerDrawer.roleAtAgencyLabel"),
      });
      setError(fieldErrors.manager_public_id ?? generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={t("agencies.managerDrawer.title")}
      description={
        agency
          ? t("agencies.managerDrawer.subtitle", { code: agency.code, name: agency.name })
          : undefined
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="agency-manager-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="agency-manager-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {agency?.manager_name ? (
          <p className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t("agencies.managerDrawer.currentManager", {
              name: agency.manager_name,
            })}
          </p>
        ) : (
          <p className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t("agencies.managerDrawer.noManager")}
          </p>
        )}

        {error ? (
          <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <TextField
          label={t("agencies.managerDrawer.publicIdLabel")}
          value={publicId}
          onChange={(event) => setPublicId(event.target.value)}
          hint={t("agencies.managerDrawer.publicIdHint")}
          placeholder="usr_..."
        />

        <TextField
          label={t("agencies.managerDrawer.roleAtAgencyLabel")}
          value={roleAtAgency}
          onChange={(event) => setRoleAtAgency(event.target.value)}
          hint={t("agencies.managerDrawer.roleAtAgencyHint")}
          placeholder="agency-manager"
        />
      </form>
    </Drawer>
  );
}
