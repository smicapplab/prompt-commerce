import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const DELETE: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const id = parseInt(event.params.id);
  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
  if (!existing) return json({ error: 'Review not found' }, { status: 404 });

  db.prepare(`DELETE FROM reviews WHERE id = ?`).run(id);
  return json({ success: true });
};
