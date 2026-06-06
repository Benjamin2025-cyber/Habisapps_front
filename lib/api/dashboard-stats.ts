import { countClients, countLoans } from "./loans";

/**
 * Dashboard count fan-outs. The list endpoints expose no aggregate counts, so we
 * derive distributions by hitting `?per_page=1` once per status and reading
 * `meta.pagination.total`. Each probe is wrapped so a single failure yields `0`
 * rather than rejecting the whole distribution (a backend stats endpoint —
 * `/loans/stats`, `/clients/stats` — is requested in dashboard-request.md).
 *
 * Scoping is inherited from the list endpoints: `/loans` auto-applies
 * institution scope for `crm.scope.institution.read`; `/clients` requires an
 * explicit `scope=all` (pass it for institution-scope roles).
 */

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

export async function countLoansByStatus(
  token: string,
  statuses: readonly string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    statuses.map(
      async (status) =>
        [status, await safeCount(() => countLoans(token, { status }))] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export async function countClientsByKyc(
  token: string,
  kycStatuses: readonly string[],
  scope?: "all",
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    kycStatuses.map(
      async (kyc_status) =>
        [
          kyc_status,
          await safeCount(() => countClients(token, { kyc_status, scope })),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}
