import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { apiError } from '$lib/server/response.js';
import { getDb, getStoreDb } from '$lib/server/db.js';
import { filterSecureImageUrls } from '$lib/server/images.js';

// ─── POST /api/sync?store=<slug> ──────────────────────────────────────────────
export const POST: RequestHandler = async (event) => {
  const slug = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, slug, ['merchandising']);
  if (auth instanceof Response) return auth;

  if (!slug) return apiError(400, 'store query parameter required');

  // ── 1. Get gateway URL + platform key from registry ────────────────────────
  const registry = getDb();

  // SEC-4: Validate seller public base URL to prevent Host header spoofing.
  const publicUrlSetting = (registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seller_public_url') as { value: string } | undefined)?.value;

  let sellerPublicUrl = process.env.SELLER_PUBLIC_URL ?? publicUrlSetting;

  // SEC-4 Fix: Verify if it's a valid URL, otherwise fallback to null (images won't be prefixed)
  if (sellerPublicUrl) {
    try {
      const url = new URL(sellerPublicUrl);
      sellerPublicUrl = url.origin;
    } catch {
      sellerPublicUrl = undefined;
    }
  } else {
    // If no config, don't fallback to spoofable Host header
    sellerPublicUrl = undefined;
  }

  if (!sellerPublicUrl) {
    return apiError(400, 'Server configuration error: seller_public_url is missing or invalid.');
  }

  const store = registry
    .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
    .get(slug) as { gateway_key: string | null } | undefined;

  if (!store) return apiError(404, `Store "${slug}" not found`);
  if (!store.gateway_key) return apiError(400, 'Store has no gateway key — verify the store first');

  const gatewayUrlRow = registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('gateway_url') as { value: string } | undefined;
  const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');
  if (!gatewayUrl) return apiError(400, 'gateway_url not configured in server settings');

  // ── 2. Fetch dirty rows from store SQLite ──────────────────────────────────
  const storeDb = getStoreDb(slug);

  type RawCategory = { id: number; name: string; parent_id: number | null; deleted_at: string | null; updated_at: string };
  type RawProduct = {
    id: number; title: string; description: string | null; sku: string | null;
    price: number | null; stock_quantity: number; category_id: number | null;
    tags: string | null; images: string | null; active: number; deleted_at: string | null;
    updated_at: string;
  };

  const dirtyCategories = storeDb
    .prepare('SELECT id, name, parent_id, deleted_at, updated_at FROM categories WHERE is_synced = 0')
    .all() as RawCategory[];

  const dirtyProducts = storeDb
    .prepare(`
      SELECT id, title, description, sku, price, stock_quantity,
             category_id, tags, images, active, deleted_at, updated_at
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
    .map(p => {
      // SEC-2: Wrap JSON.parse in try-catch blocks.
      let rawImages: string[] = [];
      try {
        rawImages = p.images ? JSON.parse(p.images) : [];
      } catch (e) {
        console.warn(`[Sync] Failed to parse images for product ${p.id}:`, e);
      }

      // Absolutize relative /uploads/ paths
      const imagesPrefix = rawImages.map(img =>
        (img.startsWith('/') && sellerPublicUrl) ? `${sellerPublicUrl}${img}` : img
      );

      // SEC-5: Filter to secure URLs only
      const images = filterSecureImageUrls(imagesPrefix);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        sku: p.sku,
        price: p.price,
        stock_quantity: p.stock_quantity,
        category_id: p.category_id,
        tags: (() => {
          try {
            return p.tags ? JSON.parse(p.tags) : [];
          } catch {
            return [];
          }
        })(),
        images,
        active: Boolean(p.active),
      };
    });

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
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return apiError(502, `Gateway sync failed (${response.status}): ${errorText}`);
  }

  // ── 5. Parse response before committing local sync ────────────────────────
  let result: any;
  try {
    result = await response.json();
  } catch (err) {
    return apiError(502, `Gateway returned non-JSON response: ${err}`);
  }

  // ── 6. Mark all pushed rows as synced (only if not modified since) ─────────
  // We use the snapshot updated_at to ensure that if a row was edited 
  // DURING the network call, it stays dirty (is_synced=0).
  const markSynced = storeDb.transaction(() => {
    if (dirtyCategories.length > 0) {
      const stmt = storeDb.prepare(`UPDATE categories SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
      for (const cat of dirtyCategories) {
        stmt.run(cat.id, cat.updated_at);
      }
    }
    if (dirtyProducts.length > 0) {
      const stmt = storeDb.prepare(`UPDATE products SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
      for (const prod of dirtyProducts) {
        stmt.run(prod.id, prod.updated_at);
      }
    }
  });
  markSynced();

  return json({
    success: true,
    synced: {
      categories: (upsertCategories.length + deleteCategoryIds.length),
      products: (upsertProducts.length + deleteProductIds.length),
    },
    detail: {
      upserted: { categories: upsertCategories.length, products: upsertProducts.length },
      deleted: { categories: deleteCategoryIds.length, products: deleteProductIds.length },
    },
    message: result?.message ?? `Sync complete for "${slug}".`,
  });
};
