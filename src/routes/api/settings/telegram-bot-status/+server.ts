/**
 * GET /api/settings/telegram-bot-status?store=<slug>
 *
 * Proxies to the gateway's GET /api/bot/telegram/status endpoint so the seller
 * UI can show a live badge confirming the bot mode (polling vs webhook) after
 * saving Telegram settings.
 *
 * Returns the gateway's response verbatim:
 *   { mode: 'polling'|'webhook', webhookUrl: string|null, configuredUrl: string|null, ... }
 * or an error shape:
 *   { error: string, reason: string }
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
    if (!gatewayUrl) return json({ error: 'gateway not configured', reason: 'no_gateway_url' }, { status: 503 });

    const storeRow = registry
      .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
      .get(slug) as { gateway_key: string | null } | undefined;
    if (!storeRow?.gateway_key) return json({ error: 'store not linked', reason: 'no_gateway_key' }, { status: 503 });

    let res: Response;
    try {
      res = await fetch(`${gatewayUrl}/api/bot/telegram/status`, {
        headers: { 'x-gateway-key': storeRow.gateway_key },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return json({ error: 'gateway unreachable', reason: 'unreachable' }, { status: 503 });
    }

    if (!res.ok) {
      return json({ error: 'gateway error', reason: 'gateway_error' }, { status: 503 });
    }

    const data = await res.json();
    return json(data);
  } catch {
    return json({ error: 'unexpected error', reason: 'unreachable' }, { status: 503 });
  }
};
