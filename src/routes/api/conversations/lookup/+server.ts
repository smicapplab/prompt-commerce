import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireGatewayKey } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

/**
 * Quick lookup of a conversation by buyer_ref + channel.
 * Used by the gateway bot to find the seller-side ID for message mirroring.
 */
export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = requireGatewayKey(event, store);
  if (auth instanceof Response) return auth;

  const { buyer_ref, channel } = await event.request.json();
  if (!buyer_ref) return json({ error: 'buyer_ref is required' }, { status: 400 });

  const db = getStoreDb(store!);
  const conv = db.prepare(\`
    SELECT id, status, mode FROM conversations
    WHERE buyer_ref = ? AND channel = ? AND status = 'open'
    LIMIT 1
  \`).get(buyer_ref, channel || 'telegram');

  if (!conv) return json({ error: 'Conversation not found' }, { status: 404 });
  return json(conv);
};
