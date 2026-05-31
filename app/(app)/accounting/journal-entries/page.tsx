"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import {
  createJournalEntry,
  fetchJournalEntries,
  type JournalEntry,
  type JournalEntryCreatePayload,
  type JournalEntryStatus,
  type PaginatedJournalEntries,
} from "@/lib/api/journal-entries";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { JournalEntriesTable } from "./_components/JournalEntriesTable";
import { JournalEntryCreateDrawer } from "./_components/JournalEntryCreateDrawer";
import { JournalEntryDetailDrawer } from "./_components/JournalEntryDetailDrawer";
import { JOURNAL_FILTER_STATUSES } from "./_components/status";

/**
 * P18 — Comptabilité › Opérations diverses (OD). Worklist des écritures de
 * journal manuelles : filtre par statut, création d'en-tête, gestion des
 * lignes en brouillon, et workflow de validation
 * (soumettre / approuver / rejeter / comptabiliser / extourner).
 * Câblé sur `journal-entries` + `journal-lines`. Permissions `journal.entries.*`.
 */
export default function JournalEntriesPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["journal.entries.view"]);
  const createPerm = useCanAny(["journal.entries.create"]);
  const reviewPerm = useCanAny(["journal.entries.review"]);
  const postPerm = useCanAny(["journal.entries.post"]);
  const reversePerm = useCanAny(["journal.entries.reverse"]);
  const canView = isPlatformAdmin || viewPerm;
  const canCreate = isPlatformAdmin || createPerm;
  const canReview = isPlatformAdmin || reviewPerm;
  const canPost = isPlatformAdmin || postPerm;
  const canReverse = isPlatformAdmin || reversePerm;
  // Journal-line CRUD is platform-admin only per the API policy.
  const canManageLines = isPlatformAdmin;

  const [statusFilter, setStatusFilter] = useState<JournalEntryStatus | "all">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedJournalEntries> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchJournalEntries(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
  ]);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAgencies(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setAgencies(response.data);
      })
      .catch(() => {
        if (!cancelled) setAgencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data.data;
    return data.data.filter((e) => e.status === statusFilter);
  }, [data, statusFilter]);

  if (session.status !== "authenticated" || !canView) return null;

  async function handleCreate(payload: JournalEntryCreatePayload) {
    if (!token) return;
    const created: JournalEntry = await createJournalEntry(token, payload);
    toast.success(
      t("journalEntries.toast.createdTitle"),
      t("journalEntries.toast.createdBody", { reference: created.reference }),
    );
    setCreateOpen(false);
    refetch();
    // Drop straight into the detail drawer so the user adds lines.
    setDetailId(created.public_id);
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("journalEntries.pageTitle")}
        description={t("journalEntries.pageDescription")}
        actions={
          canCreate ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              {t("journalEntries.actions.create")}
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-background p-4 sm:max-w-xs">
        <label
          htmlFor="je-status"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("journalEntries.filterLabel")}
        </label>
        <Select
          id="je-status"
          value={statusFilter}
          options={[
            { value: "all", label: t("journalEntries.filterAll") },
            ...JOURNAL_FILTER_STATUSES.map((s) => ({
              value: s,
              label: t(`journalEntries.status.${s}`),
            })),
          ]}
          onChange={(next) => setStatusFilter(next as JournalEntryStatus | "all")}
        />
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("journalEntries.errorTitle")}
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

      <JournalEntriesTable
        rows={visibleRows}
        loading={loading && !data}
        pagination={
          pageMeta
            ? {
                page: pageMeta.current_page,
                pageSize: pageMeta.per_page,
                total: pageMeta.total,
                lastPage: pageMeta.last_page,
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }
            : undefined
        }
        onOpen={(entry) => setDetailId(entry.public_id)}
      />

      {canCreate ? (
        <JournalEntryCreateDrawer
          open={createOpen}
          agencies={agencies}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      <JournalEntryDetailDrawer
        open={detailId !== null}
        entryPublicId={detailId}
        currentUserPublicId={session.user.public_id}
        canManageLines={canManageLines}
        canReview={canReview}
        canPost={canPost}
        canReverse={canReverse}
        onClose={() => setDetailId(null)}
        onChanged={refetch}
      />
    </>
  );
}
