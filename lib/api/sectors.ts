import { notifyAuthExpired } from "./client";

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
