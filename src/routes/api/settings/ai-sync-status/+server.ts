/**
 * GET /api/settings/ai-sync-status?store=<slug>
 *
 * Checks whether the gateway currently has a valid AI config for this store
 * (i.e. that the last push from settings/+server.ts reached the gateway).
 *
 * Returns: { synced: boolean, reason?: string }
 *
 * "synced" means the gateway's Retailer row has a non-null aiApiKey for this
 * store — a reliable proxy for whether the push succeeded.
 *
 * "reason" is set on failure to give the UI a clearer status message:
 *   "no_gateway_url"    — gateway URL not configured in server settings
 *   "no_gateway_key"    — store has no gateway key (not yet linked)
 *   "not_registered"    — gateway returned 404 (store not registered there)
 *   "auth_failed"       — gateway returned 401/403 (key mismatch / expired)
 *   "gateway_error"     — gateway returned 5xx
 *   "unreachable"       — network error (gateway not running)
 *   "no_api_key"        — gateway OK but no AI key stored yet
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
    if (!gatewayUrl) return json({ synced: false, reason: 'no_gateway_url' });

    const storeRow = registry
      .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
      .get(slug) as { gateway_key: string | null } | undefined;
    if (!storeRow?.gateway_key) return json({ synced: false, reason: 'no_gateway_key' });

    // Ask the gateway for the store's current AI config status
    let res: Response;
    try {
      res = await fetch(`${gatewayUrl}/api/stores/${slug}/ai-config/status`, {
        headers: { 'x-gateway-key': storeRow.gateway_key },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return json({ synced: false, reason: 'unreachable' });
    }

    if (res.status === 404) return json({ synced: false, reason: 'not_registered' });
    if (res.status === 401 || res.status === 403) return json({ synced: false, reason: 'auth_failed' });
    if (!res.ok) return json({ synced: false, reason: 'gateway_error' });

    const data = await res.json() as { hasApiKey: boolean };
    if (!data.hasApiKey) return json({ synced: false, reason: 'no_api_key' });
    return json({ synced: true });
  } catch {
    return json({ synced: false, reason: 'unreachable' });
  }
};
