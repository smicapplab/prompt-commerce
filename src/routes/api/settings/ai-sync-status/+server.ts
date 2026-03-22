/**
 * GET /api/settings/ai-sync-status?store=<slug>
 *
 * Checks whether the gateway currently has a valid AI config for this store
 * (i.e. that the last push from settings/+server.ts reached the gateway).
 *
 * Returns: { synced: boolean }
 *
 * "synced" means the gateway's Retailer row has a non-null aiApiKey for this
 * store — a reliable proxy for whether the push succeeded.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store');
  if (!slug) return json({ error: 'store param required' }, { status: 400 });

  try {
    const registry = getDb();

    const gatewayUrlRow = registry
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('gateway_url') as { value: string } | undefined;
    const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');
    if (!gatewayUrl) return json({ synced: false });

    const storeRow = registry
      .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
      .get(slug) as { gateway_key: string | null } | undefined;
    if (!storeRow?.gateway_key) return json({ synced: false });

    // Ask the gateway for the store's current AI config status
    const res = await fetch(`${gatewayUrl}/api/stores/${slug}/ai-config/status`, {
      headers: { 'x-gateway-key': storeRow.gateway_key },
    });

    if (!res.ok) return json({ synced: false });
    const data = await res.json() as { hasApiKey: boolean };
    return json({ synced: !!data.hasApiKey });
  } catch {
    return json({ synced: false });
  }
};
