"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { createDatabaseBackup } from "@/lib/api/database";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateBackupDrawer({ open, token, onClose, onCreated }: Props) {
  const t = useTranslations("database.backups.createDrawer");
  const toast = useToast();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setNote("");
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDatabaseBackup(token, note);
      toast.success(t("toastTitle"), t("toastBody"));
      setNote("");
      onCreated();
      onClose();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      setError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        <TextField
          id="backup-note"
          name="note"
          label={t("noteLabel")}
          placeholder={t("notePlaceholder")}
          value={note}
          maxLength={255}
          hint={t("noteHint")}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </Drawer>
  );
}
