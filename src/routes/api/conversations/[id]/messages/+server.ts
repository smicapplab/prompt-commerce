import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole, requireGatewayKey } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';
import { deliverToTelegram } from '$lib/server/gateway.js';

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  // Allow either store role (human seller) or gateway key (bot/system)
  let authResult: any = await requireStoreRole(event, store, ['admin', 'store_admin', 'ops']);
  let isSeller = true;
  if (authResult instanceof Response) {
    const gatewayAuth = requireGatewayKey(event, store);
    if (gatewayAuth instanceof Response) {
      return json({ error: 'Unauthorized: Invalid session or platform key' }, { status: 401 });
    }
    authResult = { user: { username: 'system' } };
    isSeller = false;
  }

  const conversationId = parseInt(event.params.id);
  const body = await event.request.json();
  const { body: messageBody, sender, sender_name } = body;
  if (!messageBody) return json({ error: 'body is required' }, { status: 400 });

  const db = getStoreDb(store);
  const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId) as any;
  if (!conversation) return json({ error: 'Conversation not found' }, { status: 404 });

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender, sender_name, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(conversationId, sender || (isSeller ? 'seller' : 'ai'), sender_name || null, messageBody, now);

  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);

  // If this is from a human seller, fire-and-forget to the gateway for Telegram delivery
  if (isSeller && (sender === 'seller' || !sender)) {
    const username = authResult.user?.username || 'Seller';
    deliverToTelegram(store, conversation.buyer_ref, messageBody, sender_name || username)
      .catch(err => console.error(`[Inbox] Failed to deliver message to Telegram: ${err}`));
  }

  const message = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(result.lastInsertRowid);
  return json(message, { status: 201 });
};

