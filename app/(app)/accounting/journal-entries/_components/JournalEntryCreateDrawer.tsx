"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import type { Agency } from "@/lib/api/agencies";
import type { JournalEntryCreatePayload } from "@/lib/api/journal-entries";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  agencies: ReadonlyArray<Agency>;
  onClose: () => void;
  onSubmit: (payload: JournalEntryCreatePayload) => Promise<void>;
};

export function JournalEntryCreateDrawer({
  open,
  agencies,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();

  const [reference, setReference] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReference("");
    setBusinessDate("");
    setAgencyId(agencies.length === 1 ? agencies[0].public_id : "");
    setDescription("");
    setErrors({});
    setGeneralError(null);
  }, [open, agencies]);

  const agencyOptions = useMemo(
    () =>
      agencies.map((a) => ({
        value: a.public_id,
        label: `${a.code} — ${a.name}`,
      })),
    [agencies],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      await onSubmit({
        reference: reference.trim(),
        business_date: businessDate,
        agency_public_id: agencyId,
        description: description.trim() || null,
        source_module: "manual",
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        reference: t("journalEntries.fields.reference"),
        business_date: t("journalEntries.fields.date"),
        agency_public_id: t("journalEntries.fields.agency"),
        description: t("journalEntries.fields.description"),
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
      title={t("journalEntries.createDrawer.title")}
      description={t("journalEntries.createDrawer.hint")}
      widthClassName="sm:w-[30rem]"
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
            form="je-create-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("journalEntries.createDrawer.create")}
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
        id="je-create-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label={t("journalEntries.fields.reference")}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          error={errors.reference}
          required
          hint={t("journalEntries.fields.referenceHint")}
        />
        <TextField
          label={t("journalEntries.fields.date")}
          type="date"
          value={businessDate}
          onChange={(event) => setBusinessDate(event.target.value)}
          error={errors.business_date}
          required
        />
        <Select
          label={t("journalEntries.fields.agency")}
          value={agencyId}
          options={agencyOptions}
          placeholder={t("journalEntries.fields.agencyPlaceholder")}
          onChange={setAgencyId}
          error={errors.agency_public_id}
          required
        />
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("journalEntries.fields.description")}
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={1000}
            className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {t("journalEntries.createDrawer.afterHint")}
        </p>
      </form>
    </Drawer>
  );
}
