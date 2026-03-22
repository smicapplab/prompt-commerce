import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getDb, getStoreDb } from '$lib/server/db.js';

// ─── POST /api/sync?store=<slug> ──────────────────────────────────────────────
// Pushes only dirty records (is_synced = 0) to the gateway as a delta payload.
//
// Delta payload format:
//   {
//     upsert: { categories: [...], products: [...] },   ← new / updated rows
//     delete: { categoryIds: [...], productIds: [...] } ← soft-deleted rows
//   }
//
// On gateway 2xx: marks all pushed rows as is_synced = 1.
// Auth: seller admin JWT (this endpoint), gateway platform key (to gateway).
export const POST: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store');
  if (!slug) return json({ error: 'store query parameter required' }, { status: 400 });

  // ── 1. Get gateway URL + platform key from registry ────────────────────────
  const registry = getDb();
  const store = registry
    .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
    .get(slug) as { gateway_key: string | null } | undefined;

  if (!store)             return json({ error: `Store "${slug}" not found` }, { status: 404 });
  if (!store.gateway_key) return json({ error: 'Store has no gateway key — verify the store first' }, { status: 400 });

  const gatewayUrlRow = registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('gateway_url') as { value: string } | undefined;
  const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');
  if (!gatewayUrl) return json({ error: 'gateway_url not configured in server settings' }, { status: 400 });

  // ── 2. Fetch dirty rows from store SQLite ──────────────────────────────────
  const storeDb = getStoreDb(slug);

  type RawCategory = { id: number; name: string; parent_id: number | null; deleted_at: string | null };
  type RawProduct  = {
    id: number; title: string; description: string | null; sku: string | null;
    price: number | null; stock_quantity: number; category_id: number | null;
    tags: string | null; images: string | null; active: number; deleted_at: string | null;
  };

  const dirtyCategories = storeDb
    .prepare('SELECT id, name, parent_id, deleted_at FROM categories WHERE is_synced = 0')
    .all() as RawCategory[];

  const dirtyProducts = storeDb
    .prepare(`
      SELECT id, title, description, sku, price, stock_quantity,
             category_id, tags, images, active, deleted_at
      FROM products WHERE is_synced = 0
    `)
    .all() as RawProduct[];

  // Nothing to do
  if (dirtyCategories.length === 0 && dirtyProducts.length === 0) {
    return json({ success: true, synced: { categories: 0, products: 0 }, message: 'Nothing to sync.' });
  }

  // ── 3. Split into upsert (active) and delete (soft-deleted) ───────────────
  const upsertCategories = dirtyCategories
    .filter(c => c.deleted_at === null)
    .map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id }));

  const deleteCategoryIds = dirtyCategories
    .filter(c => c.deleted_at !== null)
    .map(c => c.id);

  const upsertProducts = dirtyProducts
    .filter(p => p.deleted_at === null)
    .map(p => ({
      id:             p.id,
      title:          p.title,
      description:    p.description,
      sku:            p.sku,
      price:          p.price,
      stock_quantity: p.stock_quantity,
      category_id:    p.category_id,
      tags:           p.tags   ? JSON.parse(p.tags)   : [],
      images:         p.images ? JSON.parse(p.images) : [],
      active:         Boolean(p.active),
    }));

  const deleteProductIds = dirtyProducts
    .filter(p => p.deleted_at !== null)
    .map(p => p.id);

  const payload = {
    upsert: { categories: upsertCategories, products: upsertProducts },
    delete: { categoryIds: deleteCategoryIds, productIds: deleteProductIds },
  };

  // ── 4. POST delta to gateway ───────────────────────────────────────────────
  const response = await fetch(`${gatewayUrl}/api/stores/${slug}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gateway-key': store.gateway_key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return json(
      { error: `Gateway sync failed (${response.status}): ${errorText}` },
      { status: 502 },
    );
  }

  // ── 5. Mark all pushed rows as synced ─────────────────────────────────────
  const markSynced = storeDb.transaction(() => {
    if (dirtyCategories.length > 0) {
      const ids = dirtyCategories.map(c => c.id);
      storeDb
        .prepare(`UPDATE categories SET is_synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`)
        .run(...ids);
    }
    if (dirtyProducts.length > 0) {
      const ids = dirtyProducts.map(p => p.id);
      storeDb
        .prepare(`UPDATE products SET is_synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`)
        .run(...ids);
    }
  });
  markSynced();

  const result = await response.json();
  return json({
    success: true,
    synced: {
      categories: (upsertCategories.length + deleteCategoryIds.length),
      products:   (upsertProducts.length   + deleteProductIds.length),
    },
    detail: {
      upserted: { categories: upsertCategories.length, products: upsertProducts.length },
      deleted:  { categories: deleteCategoryIds.length, products: deleteProductIds.length },
    },
    message: result.message,
  });
};
