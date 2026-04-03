import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const orderId = parseInt(event.params.id);
  const showDeleted = event.url.searchParams.get('show_deleted') === '1';
  
  const db = getStoreDb(store);
  let query = 'SELECT * FROM order_notes WHERE order_id = ?';
  if (!showDeleted) {
    query += ' AND deleted_at IS NULL';
  }
  query += ' ORDER BY created_at DESC';
  
  const notes = db.prepare(query).all(orderId);
  return json(notes);
};

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const orderId = parseInt(event.params.id);
  const body = await event.request.json();
  const { note } = body;

  if (!note) return json({ error: 'note is required' }, { status: 400 });

  const db = getStoreDb(store);
  const result = db.prepare(`
    INSERT INTO order_notes (order_id, note, created_by, created_at, is_synced)
    VALUES (?, ?, ?, ?, 0)
  `).run(orderId, note, auth.user.username, new Date().toISOString());

  // Also mark the order itself as dirty so the notes count/sync is triggered
  db.prepare('UPDATE orders SET updated_at = datetime(\'now\'), is_synced = 0 WHERE id = ?').run(orderId);

  const newNote = db.prepare('SELECT * FROM order_notes WHERE id = ?').get(result.lastInsertRowid);
  return json(newNote, { status: 201 });
};
