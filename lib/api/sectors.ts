import { apiRequest, notifyAuthExpired } from "./client";

export type SectorStatus = "active" | "inactive" | "archived";

/**
 * Secteurs / sous-secteurs d'activité économique (référentiel P17). Utilisés
 * ici comme pickers sur la mise en place de prêt (`loans.sector_public_id` /
 * `sub_sector_public_id`).
 *
 * Index shape: `data.sectors` / `data.sub_sectors` + `meta.pagination`. Aucun
 * filtre serveur — on filtre les sous-secteurs par secteur côté client via le
 * champ `sector_public_id` porté par chaque sous-secteur.
 */
export type Sector = {
  public_id: string;
  code: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SubSector = {
  public_id: string;
  sector_public_id: string | null;
  code: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

async function fetchList<T>(
  token: string,
  path: string,
  key: string,
  perPage: number,
): Promise<T[]> {
  const response = await fetch(`/api/v1/${path}?per_page=${perPage}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Version": process.env.NEXT_PUBLIC_API_VERSION ?? "1",
      Authorization: `Bearer ${token}`,
    },
    credentials: "omit",
  });

  const text = await response.text();
  if (!response.ok || text.length === 0) {
    if (response.status === 401) notifyAuthExpired();
    throw new Error(`Failed to fetch ${path} (HTTP ${response.status})`);
  }

  const envelope = JSON.parse(text) as {
    data?: Record<string, T[]> | T[];
  };
  if (Array.isArray(envelope.data)) return envelope.data;
  const nested = envelope.data?.[key];
  return Array.isArray(nested) ? nested : [];
}

export async function fetchSectors(
  token: string,
  options: { perPage?: number } = {},
): Promise<Sector[]> {
  return fetchList<Sector>(token, "sectors", "sectors", options.perPage ?? 100);
}

export async function fetchSubSectors(
  token: string,
  options: { perPage?: number } = {},
): Promise<SubSector[]> {
  return fetchList<SubSector>(
    token,
    "sub-sectors",
    "sub_sectors",
    options.perPage ?? 100,
  );
}

/* -------------------------------------------------------------------------- */
/* Write operations (platform-admin only, per the API policy).                */
/* `code` is immutable after creation — the update endpoints ignore it.       */
/* `destroy` is a hard delete (not an archive).                               */
/* -------------------------------------------------------------------------- */

export type SectorCreatePayload = {
  code: string;
  name: string;
  status?: SectorStatus;
};

export type SectorUpdatePayload = {
  name?: string;
  status?: SectorStatus;
};

export type SubSectorCreatePayload = {
  sector_public_id: string;
  code: string;
  name: string;
  status?: SectorStatus;
};

export type SubSectorUpdatePayload = {
  /** Move the sub-sector under a different sector. */
  sector_public_id?: string;
  name?: string;
  status?: SectorStatus;
};

export async function createSector(
  token: string,
  payload: SectorCreatePayload,
): Promise<Sector> {
  return apiRequest<Sector>("sectors", { method: "POST", token, body: payload });
}

export async function updateSector(
  token: string,
  publicId: string,
  payload: SectorUpdatePayload,
): Promise<Sector> {
  return apiRequest<Sector>(`sectors/${publicId}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteSector(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`sectors/${publicId}`, { method: "DELETE", token });
}

export async function createSubSector(
  token: string,
  payload: SubSectorCreatePayload,
): Promise<SubSector> {
  return apiRequest<SubSector>("sub-sectors", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateSubSector(
  token: string,
  publicId: string,
  payload: SubSectorUpdatePayload,
): Promise<SubSector> {
  return apiRequest<SubSector>(`sub-sectors/${publicId}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function deleteSubSector(
  token: string,
  publicId: string,
): Promise<null> {
  return apiRequest<null>(`sub-sectors/${publicId}`, {
    method: "DELETE",
    token,
  });
}
