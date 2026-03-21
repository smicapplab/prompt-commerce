import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const id = parseInt(event.params.id);
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const db = getStoreDb(store);
  const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
  if (!conversation) return json({ error: 'Conversation not found' }, { status: 404 });

  const messages = db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
  `).all(id);

  return json({ ...(conversation as any), messages });
};

export const PATCH: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const id = parseInt(event.params.id);
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
  if (!existing) return json({ error: 'Conversation not found' }, { status: 404 });

  const body = await event.request.json();
  const { status } = body;
  if (!status) return json({ error: 'status is required' }, { status: 400 });

  const now = new Date().toISOString();
  db.prepare(`UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, id);

  return json(db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id));
};
