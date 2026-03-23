import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getRegistryDb, getStoreDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const id = Number(event.params.id);
  const registry = getRegistryDb();

  const store = registry.prepare('SELECT slug FROM stores WHERE id = ?').get(id) as { slug: string } | undefined;
  if (!store) return json({ error: 'Store not found' }, { status: 404 });

  // Only global admins or users assigned to this store can see stats
  if (user.role !== 'super_admin' && user.role !== 'admin') {
     const assigned = registry.prepare('SELECT role FROM user_stores WHERE user_id = ? AND store_slug = ?').get(user.sub, store.slug);
     if (!assigned) return json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getStoreDb(store.slug);
  const count = (table: string) =>
    (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

  return json({
    products:      count('products'),
    categories:    count('categories'),
    promotions:    count('promotions'),
    reviews:       count('reviews'),
    orders:        count('orders'),
    conversations: count('conversations'),
  });
};
