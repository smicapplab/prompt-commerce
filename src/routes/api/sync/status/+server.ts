import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

// ─── GET /api/sync/status?store=<slug> ────────────────────────────────────────
// Returns count of dirty (unsynced) products and categories.
// Used by the Products page to show the badge on the Sync button.
export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store');
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
