"use client";

import { useCallback, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tabs, TabsPanel } from "@/components/ui/Tabs";
import {
  cancelDatabaseRestore,
  deleteDatabaseBackup,
  downloadDatabaseBackup,
  fetchDatabaseBackups,
  fetchDatabaseRestores,
  getDatabaseStorage,
  verifyDatabaseBackup,
  type DatabaseBackup,
  type DatabaseRestoreOperation,
  type DatabaseStorage,
  type PaginatedBackups,
  type PaginatedRestores,
} from "@/lib/api/database";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { BackupsTable } from "./_components/BackupsTable";
import { CreateBackupDrawer } from "./_components/CreateBackupDrawer";
import { RestoreDrawer } from "./_components/RestoreDrawer";
import { RestoresTable } from "./_components/RestoresTable";
import { StorageHealthCard } from "./_components/StorageHealthCard";

type TabId = "backups" | "restores";

/**
 * Database management — backups & restores (platform-admin only).
 *
 * Surfaces the HabisApi `/database/*` endpoints: create/list/verify/download/
 * delete backups, a guarded two-step restore flow, the restore history, and
 * storage/retention health. Every action is permission-gated with `useCan`;
 * the page itself is guarded by `system.database.view`.
 */
export default function DatabaseBackupsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["system.database.view"]);

  const canCreate = useCan("system.database.backup.create");
  const canDownload = useCan("system.database.backup.download");
  const canDelete = useCan("system.database.backup.delete");
  const canVerify = useCan("system.database.maintenance.manage");
  const canPlanRestore = useCan("system.database.restore.plan");
  const canExecuteRestore = useCan("system.database.restore.execute");

  const token = session.status === "authenticated" ? session.token : null;

  const [tab, setTab] = useState<TabId>("backups");
  const [backupsPage, setBackupsPage] = useState(1);
  const [backupsPageSize, setBackupsPageSize] = useState(25);
  const [restoresPage, setRestoresPage] = useState(1);
  const [restoresPageSize, setRestoresPageSize] = useState(25);

  const [createOpen, setCreateOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DatabaseBackup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DatabaseBackup | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const storageFetcher = useCallback(
    async (): Promise<DatabaseStorage> => {
      if (!token) throw new Error("Missing session token");
      return getDatabaseStorage(token);
    },
    [token],
  );
  const storage = useApi(storageFetcher, [token]);

  const backupsFetcher = useCallback(
    async (): Promise<PaginatedBackups> => {
      if (!token) throw new Error("Missing session token");
      return fetchDatabaseBackups(token, {
        page: backupsPage,
        perPage: backupsPageSize,
      });
    },
    [token, backupsPage, backupsPageSize],
  );
  const backups = useApi(backupsFetcher, [token, backupsPage, backupsPageSize]);

  const restoresFetcher = useCallback(
    async (): Promise<PaginatedRestores> => {
      if (!token) throw new Error("Missing session token");
      return fetchDatabaseRestores(token, {
        page: restoresPage,
        perPage: restoresPageSize,
      });
    },
    [token, restoresPage, restoresPageSize],
  );
  const restores = useApi(restoresFetcher, [
    token,
    restoresPage,
    restoresPageSize,
  ]);

  const refreshAll = useCallback(() => {
    backups.refetch();
    restores.refetch();
    storage.refetch();
  }, [backups, restores, storage]);

  const handleDownload = useCallback(
    async (backup: DatabaseBackup) => {
      if (!token) return;
      setBusyId(backup.public_id);
      try {
        await downloadDatabaseBackup(token, backup);
      } catch (cause) {
        const { generalMessage } = localizeApiError(cause);
        toast.error(t("database.backups.toast.downloadErrorTitle"), generalMessage);
      } finally {
        setBusyId(null);
      }
    },
    [token, toast, t],
  );

  const handleVerify = useCallback(
    async (backup: DatabaseBackup) => {
      if (!token) return;
      setBusyId(backup.public_id);
      try {
        const result = await verifyDatabaseBackup(token, backup.public_id);
        if (result.verification.passed) {
          toast.success(t("database.backups.toast.verifyPassedTitle"), backup.filename);
        } else {
          toast.warning(t("database.backups.toast.verifyFailedTitle"), backup.filename);
        }
        backups.refetch();
        storage.refetch();
      } catch (cause) {
        const { generalMessage } = localizeApiError(cause);
        toast.error(t("database.backups.toast.verifyErrorTitle"), generalMessage);
      } finally {
        setBusyId(null);
      }
    },
    [token, toast, t, backups, storage],
  );

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDatabaseBackup(token, deleteTarget.public_id);
      toast.success(
        t("database.backups.toast.deletedTitle"),
        deleteTarget.filename,
      );
      setDeleteTarget(null);
      backups.refetch();
      storage.refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("database.backups.toast.deleteErrorTitle"), generalMessage);
    } finally {
      setDeleting(false);
    }
  }, [token, deleteTarget, toast, t, backups, storage]);

  const handleCancelRestore = useCallback(
    async (op: DatabaseRestoreOperation) => {
      if (!token) return;
      setBusyId(op.public_id);
      try {
        await cancelDatabaseRestore(token, op.public_id);
        toast.info(t("database.restores.toast.cancelledTitle"), op.public_id);
        restores.refetch();
      } catch (cause) {
        const { generalMessage } = localizeApiError(cause);
        toast.error(t("database.restores.toast.cancelErrorTitle"), generalMessage);
      } finally {
        setBusyId(null);
      }
    },
    [token, toast, t, restores],
  );

  const tabItems = useMemo(
    () => [
      {
        id: "backups",
        label: t("database.backups.tab"),
        badge: backups.data?.meta.pagination.total,
      },
      {
        id: "restores",
        label: t("database.restores.tab"),
        badge: restores.data?.meta.pagination.total,
      },
    ],
    [t, backups.data, restores.data],
  );

  if (session.status !== "authenticated" || !allowed) return null;

  const listError = tab === "backups" ? backups.error : restores.error;

  return (
    <>
      <PageHeader
        title={t("database.title")}
        description={t("database.description")}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              {t("database.backups.createButton")}
            </Button>
          ) : null
        }
      />

      <StorageHealthCard storage={storage.data} loading={storage.loading} />

      <Tabs
        items={tabItems}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
        ariaLabel={t("database.title")}
        className="mt-2"
      />

      {listError ? (
        <Alert
          variant="danger"
          title={t("database.errorTitle")}
          action={
            <button
              type="button"
              onClick={refreshAll}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(listError.message)}
        </Alert>
      ) : null}

      {tab === "backups" ? (
        <TabsPanel id="backups">
          <BackupsTable
            rows={backups.data?.data ?? []}
            loading={backups.loading && !backups.data}
            busyId={busyId}
            canDownload={canDownload}
            canVerify={canVerify}
            canRestore={canPlanRestore}
            canDelete={canDelete}
            onDownload={handleDownload}
            onVerify={handleVerify}
            onRestore={(backup) => setRestoreTarget(backup)}
            onDelete={(backup) => setDeleteTarget(backup)}
            pagination={
              backups.data
                ? {
                    page: backups.data.meta.pagination.current_page,
                    pageSize: backups.data.meta.pagination.per_page,
                    total: backups.data.meta.pagination.total,
                    lastPage: backups.data.meta.pagination.last_page,
                    onPageChange: setBackupsPage,
                    onPageSizeChange: (size) => {
                      setBackupsPageSize(size);
                      setBackupsPage(1);
                    },
                  }
                : undefined
            }
          />
        </TabsPanel>
      ) : (
        <TabsPanel id="restores">
          <RestoresTable
            rows={restores.data?.data ?? []}
            loading={restores.loading && !restores.data}
            busyId={busyId}
            canCancel={canPlanRestore}
            onCancel={handleCancelRestore}
            pagination={
              restores.data
                ? {
                    page: restores.data.meta.pagination.current_page,
                    pageSize: restores.data.meta.pagination.per_page,
                    total: restores.data.meta.pagination.total,
                    lastPage: restores.data.meta.pagination.last_page,
                    onPageChange: setRestoresPage,
                    onPageSizeChange: (size) => {
                      setRestoresPageSize(size);
                      setRestoresPage(1);
                    },
                  }
                : undefined
            }
          />
        </TabsPanel>
      )}

      <CreateBackupDrawer
        open={createOpen}
        token={token}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshAll}
      />

      <RestoreDrawer
        key={`restore-${restoreTarget?.public_id ?? "none"}`}
        open={restoreTarget !== null}
        token={token}
        backup={restoreTarget}
        canExecute={canExecuteRestore}
        onClose={() => setRestoreTarget(null)}
        onDone={refreshAll}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("database.backups.deleteDialog.title")}
        description={t("database.backups.deleteDialog.description", {
          filename: deleteTarget?.filename ?? "",
        })}
        confirmLabel={t("database.backups.deleteDialog.confirm")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={deleting}
        busyLabel={t("database.backups.deleteDialog.deleting")}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
