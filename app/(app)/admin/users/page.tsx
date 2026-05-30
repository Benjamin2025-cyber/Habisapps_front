"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { fetchRoles, type Role } from "@/lib/api/roles";
import {
  createStaffUser,
  fetchStaffUsers,
  updateStaffUser,
  updateStaffUserRoles,
  updateStaffUserStatus,
  type PaginatedStaffUsers,
  type StaffUser,
  type StaffUserStatus,
  type StaffUserWritePayload,
} from "@/lib/api/staff-users";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import {
  EMPTY_STAFF_USERS_FILTERS,
  StaffUsersFilters,
  type StaffUsersFilterState,
} from "./_components/StaffUsersFilters";
import { StaffUsersTable } from "./_components/StaffUsersTable";
import {
  StaffUserDrawer,
  type StaffUserDrawerMode,
} from "./_components/StaffUserDrawer";
import { StaffUserRolesDrawer } from "./_components/StaffUserRolesDrawer";

/**
 * P5 — Référentiel Staff users (Gestion des utilisateurs).
 *
 * Admin-only CRUD over `/staff-users`. Reuses the agencies list for the
 * agency picker, and the canonical role catalog from `GET /roles` to drive
 * both the role filter and the role-assignment drawer.
 *
 * After creation the API issues an activation OTP — the new staff user
 * receives an SMS and finishes activation via `/activate`.
 */
export default function StaffUsersPage() {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["users.view"]);
  const canCreate = useCan("users.create");
  const canEdit = useCan("users.update");
  const canManageRoles = useCan("users.roles.manage");
  const canChangeStatus = useCan("users.status.manage");
  const [filters, setFilters] = useState<StaffUsersFilterState>(
    EMPTY_STAFF_USERS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerMode, setDrawerMode] = useState<StaffUserDrawerMode | null>(null);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [rolesDrawerUser, setRolesDrawerUser] = useState<StaffUser | null>(null);

  const token = session.status === "authenticated" ? session.token : null;

  // List + agencies + roles all share the same auth dependency. We could split
  // them, but a single fan-out keeps the orchestration shallow.
  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedStaffUsers> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchStaffUsers(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [
    token,
    page,
    pageSize,
  ]);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

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
    fetchRoles(token)
      .then((response) => {
        if (!cancelled) setRoles(response.roles);
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const roleLabels = useMemo<Record<string, string>>(() => {
    return roles.reduce<Record<string, string>>((acc, role) => {
      acc[role.name] = role.display_name;
      return acc;
    }, {});
  }, [roles]);

  // Filtering happens client-side because the index endpoint doesn't expose
  // query-builder filters today.
  const visibleStaffUsers = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLowerCase();
    return data.data.filter((user) => {
      if (filters.status && user.status !== filters.status) return false;
      if (
        filters.agencyPublicId &&
        user.agency_public_id !== filters.agencyPublicId
      ) {
        return false;
      }
      if (filters.role && !user.roles.includes(filters.role)) return false;
      if (needle.length === 0) return true;
      return (
        user.name.toLowerCase().includes(needle) ||
        user.phone_number.toLowerCase().includes(needle) ||
        (user.matricule ?? "").toLowerCase().includes(needle) ||
        (user.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, filters]);

  if (session.status !== "authenticated" || !allowed) return null;

  function openCreate() {
    setEditing(null);
    setDrawerMode("create");
  }

  function openEdit(user: StaffUser) {
    setEditing(user);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditing(null);
  }

  async function handleSubmit(
    payload: StaffUserWritePayload,
    selectedRoles: string[],
  ) {
    if (!token) return;
    if (drawerMode === "create") {
      const created = await createStaffUser(token, payload);

      // Chain role assignment when the admin checked at least one role. We
      // surface the role-attribution outcome separately from the creation
      // success so a partial failure isn't silent.
      let rolesAssigned = false;
      let rolesError: string | null = null;
      if (selectedRoles.length > 0) {
        try {
          await updateStaffUserRoles(token, created.public_id, selectedRoles);
          rolesAssigned = true;
        } catch (cause) {
          rolesError = localizeApiError(cause).generalMessage;
        }
      }

      if (rolesAssigned) {
        toast.success(
          t("staffUsers.toast.createdTitle"),
          t("staffUsers.toast.createdWithRolesBody", {
            name: created.name,
            count: selectedRoles.length,
          }),
        );
      } else if (rolesError) {
        toast.warning(
          t("staffUsers.toast.createdRolesFailedTitle"),
          t("staffUsers.toast.createdRolesFailedBody", {
            name: created.name,
            error: rolesError,
          }),
        );
      } else {
        toast.success(
          t("staffUsers.toast.createdTitle"),
          t("staffUsers.toast.createdBody", { name: created.name }),
        );
      }

      setFilters(EMPTY_STAFF_USERS_FILTERS);
      setPage(1);
    } else if (drawerMode === "edit" && editing) {
      await updateStaffUser(token, editing.public_id, payload);
      toast.success(
        t("staffUsers.toast.updatedTitle"),
        t("staffUsers.toast.updatedBody", {
          name: payload.name ?? editing.name,
        }),
      );
    }
    closeDrawer();
    refetch();
  }

  async function handleStatusChange(
    user: StaffUser,
    next: Exclude<StaffUserStatus, "pending_verification">,
  ) {
    if (!token) return;
    try {
      await updateStaffUserStatus(token, user.public_id, next);
      toast.success(
        t("staffUsers.toast.statusChangedTitle"),
        t("staffUsers.toast.statusChangedBody", {
          name: user.name,
          status: t(`staffUsers.status.${next}`),
        }),
      );
      refetch();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("staffUsers.toast.statusErrorTitle"), generalMessage);
    }
  }

  async function handleRolesSubmit(nextRoles: string[]) {
    if (!token || !rolesDrawerUser) return;
    await updateStaffUserRoles(token, rolesDrawerUser.public_id, nextRoles);
    toast.success(
      t("staffUsers.toast.rolesChangedTitle"),
      t("staffUsers.toast.rolesChangedBody", { name: rolesDrawerUser.name }),
    );
    setRolesDrawerUser(null);
    refetch();
  }

  const pageMeta = data?.meta.pagination;

  return (
    <>
      <PageHeader
        title={t("staffUsers.pageTitle")}
        description={t("staffUsers.pageDescription")}
        actions={
          canCreate ? (
            <Button variant="primary" size="md" onClick={openCreate}>
              <span className="inline-flex items-center gap-2">
                <PlusIcon /> {t("staffUsers.actions.create")}
              </span>
            </Button>
          ) : null
        }
      />

      <StaffUsersFilters
        value={filters}
        onChange={setFilters}
        agencies={agencies}
        roles={roles}
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("staffUsers.errorTitle")}
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

      <StaffUsersTable
        rows={visibleStaffUsers}
        loading={loading && !data}
        roleLabels={roleLabels}
        canEdit={canEdit}
        canManageRoles={canManageRoles}
        canChangeStatus={canChangeStatus}
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
        onEdit={openEdit}
        onManageRoles={(user) => setRolesDrawerUser(user)}
        onChangeStatus={handleStatusChange}
      />

      <StaffUserDrawer
        open={drawerMode !== null}
        mode={drawerMode ?? "create"}
        initial={editing}
        agencies={agencies}
        roles={roles}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
      />

      <StaffUserRolesDrawer
        open={rolesDrawerUser !== null}
        user={rolesDrawerUser}
        roles={roles}
        onClose={() => setRolesDrawerUser(null)}
        onSubmit={handleRolesSubmit}
      />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
