import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth } from '$lib/server/auth.js';

/**
 * GET /api/stores/lookup?key=<platform_key>
 *
 * Proxies to the gateway's GET /api/stores/lookup endpoint.
 * Returns { slug, name, mcpServerUrl } for a valid key,
 * or 404 if the key is invalid / revoked / store not active.
 */
export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const key = event.url.searchParams.get('key')?.trim();
  if (!key) {
    return json({ error: 'key query parameter is required.' }, { status: 400 });
  }

  const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3003';

  let res: Response;
  try {
    res = await fetch(`${gatewayUrl}/api/stores/lookup?key=${encodeURIComponent(key)}`);
  } catch {
    return json({ error: 'Could not reach the gateway. Is it running?' }, { status: 502 });
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return json({ error: data.message ?? 'Store not found for this key.' }, { status: res.status });
  }

  return json(data);
}
