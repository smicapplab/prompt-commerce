import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const authResult = await requireStoreRole(event, store, ['admin', 'store_admin', 'ops']);
  if (authResult instanceof Response) return authResult;

  const conversationId = parseInt(event.params.id);
  const body = await event.request.json();
  const { body: messageBody, sender } = body;
  if (!messageBody) return json({ error: 'body is required' }, { status: 400 });

  const db = getStoreDb(store);
  const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId);
  if (!conversation) return json({ error: 'Conversation not found' }, { status: 404 });

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender, body, created_at)
    VALUES (?, ?, ?, ?)
  `).run(conversationId, sender || 'seller', messageBody, now);

  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);

  const message = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(result.lastInsertRowid);
  return json(message, { status: 201 });
};
