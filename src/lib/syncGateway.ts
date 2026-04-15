/**
 * Shared gateway-sync helpers used by Products and Categories pages.
 */

import type { SyncStatus, SyncResult } from "$lib/types/sync.js";

function authHeader() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('pc_token') : null;
  return { Authorization: `Bearer ${token ?? ''}` };
}

/** Returns the number of unsynced items for this store. */
export async function fetchSyncStatus(slug: string): Promise<SyncStatus> {
  const res = await fetch(`/api/sync/status?store=${slug}`, { 
    headers: authHeader(),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return { dirty: 0, products: 0, categories: 0, variants: 0 };
  return res.json();
}

/**
 * Pushes all dirty rows to the gateway.
 * Returns a human-readable summary string on success, or throws on error.
 */
export async function syncToGateway(slug: string): Promise<string> {
  const res = await fetch(`/api/sync?store=${slug}`, {
    method: 'POST',
    headers: authHeader(),
    signal: AbortSignal.timeout(35000) // Slightly longer than server-side 30s
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? 'Sync failed');

  if (d.message === 'Nothing to sync.') return 'Already up to date';

  const parts: string[] = [];
  const u = d.detail?.upserted;
  const del = d.detail?.deleted;
  if (u?.products)   parts.push(`${u.products} product${u.products !== 1 ? 's' : ''} updated`);
  if (u?.categories) parts.push(`${u.categories} categor${u.categories !== 1 ? 'ies' : 'y'} updated`);
  if (del?.products)   parts.push(`${del.products} product${del.products !== 1 ? 's' : ''} removed`);
  if (del?.categories) parts.push(`${del.categories} categor${del.categories !== 1 ? 'ies' : 'y'} removed`);
  return parts.length ? parts.join(', ') : 'Synced';
}
