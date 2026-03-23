import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

// ─── GET /api/sync/status?store=<slug> ────────────────────────────────────────
export const GET: RequestHandler = async (event) => {
  const slug = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, slug, ['merchandising', 'ops']);
  if (auth instanceof Response) return auth;

  if (!slug) return json({ error: 'store query parameter required' }, { status: 400 });

  const db = getStoreDb(slug);

  const dirtyProducts = (db
    .prepare('SELECT COUNT(*) as n FROM products WHERE is_synced = 0')
    .get() as { n: number }).n;

  const dirtyCategories = (db
    .prepare('SELECT COUNT(*) as n FROM categories WHERE is_synced = 0')
    .get() as { n: number }).n;

  return json({
    dirty:      dirtyProducts + dirtyCategories,
    products:   dirtyProducts,
    categories: dirtyCategories,
  });
};
