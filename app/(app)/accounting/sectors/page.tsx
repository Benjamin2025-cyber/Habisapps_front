"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createSector,
  createSubSector,
  deleteSector,
  deleteSubSector,
  fetchSectors,
  fetchSubSectors,
  updateSector,
  updateSubSector,
  type Sector,
  type SectorCreatePayload,
  type SectorUpdatePayload,
  type SubSector,
  type SubSectorCreatePayload,
  type SubSectorUpdatePayload,
} from "@/lib/api/sectors";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { SectorList } from "./_components/SectorList";
import { SubSectorPanel } from "./_components/SubSectorPanel";
import { SectorDrawer, type SectorDrawerMode } from "./_components/SectorDrawer";
import {
  SubSectorDrawer,
  type SubSectorDrawerMode,
} from "./_components/SubSectorDrawer";

type Combined = { sectors: Sector[]; subSectors: SubSector[] };

type DeleteTarget =
  | { kind: "sector"; item: Sector }
  | { kind: "subSector"; item: SubSector };

/**
 * P17 — Comptabilité › Secteurs / Sous-secteurs (référentiel d'activité
 * économique). Layout maître-détail : à gauche la liste des secteurs
 * (recherche + CRUD), à droite les sous-secteurs du secteur sélectionné.
 * Câblé sur `sectors` + `sub-sectors` (CRUD). API : platform-admin only.
 */
export default function SectorsPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canViewPerm = useCanAny(["sectors.view", "sub-sectors.view"]);
  const canManagePerm = useCanAny([
    "sectors.create",
    "sectors.update",
    "sectors.archive",
    "sub-sectors.create",
    "sub-sectors.update",
    "sub-sectors.archive",
  ]);
  const canView = isPlatformAdmin || canViewPerm;
  const canManage = isPlatformAdmin || canManagePerm;

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sectorDrawer, setSectorDrawer] = useState<{
    mode: SectorDrawerMode;
    initial: Sector | null;
  } | null>(null);
  const [subDrawer, setSubDrawer] = useState<{
    mode: SubSectorDrawerMode;
    initial: SubSector | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<Combined> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      const [sectors, subSectors] = await Promise.all([
        fetchSectors(token, { perPage: 100 }),
        fetchSubSectors(token, { perPage: 100 }),
      ]);
      return { sectors, subSectors };
    },
    [token],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [token]);

  const sectors = useMemo(() => data?.sectors ?? [], [data]);
  const subSectors = useMemo(() => data?.subSectors ?? [], [data]);

  // Auto-select the first sector once data arrives (or when the selection
  // disappears after a delete).
  useEffect(() => {
    if (sectors.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!sectors.some((s) => s.public_id === selectedId)) {
      setSelectedId(sectors[0].public_id);
    }
  }, [sectors, selectedId]);

  const countOf = useCallback(
    (sectorPublicId: string) =>
      subSectors.filter((s) => s.sector_public_id === sectorPublicId).length,
    [subSectors],
  );

  const filteredSectors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) return sectors;
    return sectors.filter(
      (s) =>
        s.code.toLowerCase().includes(needle) ||
        s.name.toLowerCase().includes(needle),
    );
  }, [sectors, search]);

  const selectedSector = useMemo(
    () => sectors.find((s) => s.public_id === selectedId) ?? null,
    [sectors, selectedId],
  );

  const subSectorsOfSelected = useMemo(
    () => subSectors.filter((s) => s.sector_public_id === selectedId),
    [subSectors, selectedId],
  );

  if (session.status !== "authenticated" || !canView) return null;

  async function handleSectorSubmit(
    payload: SectorCreatePayload | SectorUpdatePayload,
  ) {
    if (!token || !sectorDrawer) return;
    if (sectorDrawer.mode === "create") {
      const created = await createSector(token, payload as SectorCreatePayload);
      toast.success(
        t("sectors.toast.sectorCreatedTitle"),
        t("sectors.toast.sectorCreatedBody", { name: created.name }),
      );
      setSelectedId(created.public_id);
    } else if (sectorDrawer.initial) {
      await updateSector(
        token,
        sectorDrawer.initial.public_id,
        payload as SectorUpdatePayload,
      );
      toast.success(
        t("sectors.toast.sectorUpdatedTitle"),
        t("sectors.toast.sectorUpdatedBody", {
          name: sectorDrawer.initial.name,
        }),
      );
    }
    setSectorDrawer(null);
    refetch();
  }

  async function handleSubSectorSubmit(
    payload: SubSectorCreatePayload | SubSectorUpdatePayload,
  ) {
    if (!token || !subDrawer) return;
    if (subDrawer.mode === "create") {
      const created = await createSubSector(
        token,
        payload as SubSectorCreatePayload,
      );
      toast.success(
        t("sectors.toast.subCreatedTitle"),
        t("sectors.toast.subCreatedBody", { name: created.name }),
      );
    } else if (subDrawer.initial) {
      await updateSubSector(
        token,
        subDrawer.initial.public_id,
        payload as SubSectorUpdatePayload,
      );
      toast.success(
        t("sectors.toast.subUpdatedTitle"),
        t("sectors.toast.subUpdatedBody", { name: subDrawer.initial.name }),
      );
    }
    setSubDrawer(null);
    refetch();
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "sector") {
        await deleteSector(token, deleteTarget.item.public_id);
        toast.success(
          t("sectors.toast.sectorDeletedTitle"),
          t("sectors.toast.sectorDeletedBody", { name: deleteTarget.item.name }),
        );
      } else {
        await deleteSubSector(token, deleteTarget.item.public_id);
        toast.success(
          t("sectors.toast.subDeletedTitle"),
          t("sectors.toast.subDeletedBody", { name: deleteTarget.item.name }),
        );
      }
      setDeleteTarget(null);
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("sectors.toast.errorTitle"), generalMessage);
    } finally {
      setDeleting(false);
    }
  }

  const deleteIsSector = deleteTarget?.kind === "sector";
  const deleteSubCount =
    deleteTarget?.kind === "sector" ? countOf(deleteTarget.item.public_id) : 0;

  return (
    <>
      <PageHeader
        title={t("sectors.pageTitle")}
        description={t("sectors.pageDescription")}
      />

      {error ? (
        <Alert variant="danger" title={t("sectors.errorTitle")}>
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <SectorList
          sectors={filteredSectors}
          loading={loading && !data}
          selectedId={selectedId}
          search={search}
          canManage={canManage}
          countOf={countOf}
          onSearchChange={setSearch}
          onSelect={(sector) => setSelectedId(sector.public_id)}
          onCreate={() => setSectorDrawer({ mode: "create", initial: null })}
          onEdit={(sector) => setSectorDrawer({ mode: "edit", initial: sector })}
          onDelete={(sector) =>
            setDeleteTarget({ kind: "sector", item: sector })
          }
        />

        <SubSectorPanel
          sector={selectedSector}
          subSectors={subSectorsOfSelected}
          loading={loading && !data}
          canManage={canManage}
          onCreate={() => setSubDrawer({ mode: "create", initial: null })}
          onEdit={(sub) => setSubDrawer({ mode: "edit", initial: sub })}
          onDelete={(sub) => setDeleteTarget({ kind: "subSector", item: sub })}
        />
      </div>

      {canManage ? (
        <>
          <SectorDrawer
            open={sectorDrawer !== null}
            mode={sectorDrawer?.mode ?? "create"}
            initial={sectorDrawer?.initial}
            onClose={() => setSectorDrawer(null)}
            onSubmit={handleSectorSubmit}
          />
          <SubSectorDrawer
            open={subDrawer !== null}
            mode={subDrawer?.mode ?? "create"}
            initial={subDrawer?.initial}
            sectors={sectors}
            defaultSectorPublicId={selectedId}
            onClose={() => setSubDrawer(null)}
            onSubmit={handleSubSectorSubmit}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteIsSector
            ? t("sectors.delete.sectorTitle")
            : t("sectors.delete.subTitle")
        }
        description={
          deleteIsSector
            ? deleteSubCount > 0
              ? t("sectors.delete.sectorBodyWithChildren", {
                  name: deleteTarget?.item.name ?? "",
                  count: deleteSubCount,
                })
              : t("sectors.delete.sectorBody", {
                  name: deleteTarget?.item.name ?? "",
                })
            : t("sectors.delete.subBody", {
                name: deleteTarget?.item.name ?? "",
              })
        }
        confirmLabel={t("sectors.delete.confirm")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={deleting}
        busyLabel={t("common.loading")}
        onConfirm={confirmDelete}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
      />
    </>
  );
}
