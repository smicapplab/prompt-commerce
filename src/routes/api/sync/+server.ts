import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { apiError } from '$lib/server/response.js';
import { getDb, getStoreDb } from '$lib/server/db.js';
import { filterSecureImageUrls } from '$lib/server/images.js';

// ─── POST /api/sync?store=<slug>&type=<catalog|orders> ──────────────────────
export const POST: RequestHandler = async (event) => {
  const slug = event.url.searchParams.get('store');
  const type = event.url.searchParams.get('type') ?? 'catalog';
  
  const auth = await requireStoreRole(event, slug, ['merchandising', 'ops']);
  if (auth instanceof Response) return auth;

  if (!slug) return apiError(400, 'store query parameter required');

  // ── 1. Get gateway URL + platform key from registry ────────────────────────
  const registry = getDb();

  // SEC-4: Validate seller public base URL to prevent Host header spoofing.
  const publicUrlSetting = (registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seller_public_url') as { value: string } | undefined)?.value;

  let sellerPublicUrl = process.env.SELLER_PUBLIC_URL ?? publicUrlSetting;

  if (sellerPublicUrl) {
    try {
      const url = new URL(sellerPublicUrl);
      sellerPublicUrl = url.origin;
    } catch {
      sellerPublicUrl = undefined;
    }
  } else {
    sellerPublicUrl = undefined;
  }

  // Required for image absolutization during catalog sync
  if (type === 'catalog' && !sellerPublicUrl) {
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

  const storeDb = getStoreDb(slug);

  if (type === 'orders') {
    // ── 2a. Fetch dirty order-related rows ──────────────────────────────────
    type RawOrder = { 
      id: number; status: string; delivery_type: string; tracking_number: string | null;
      courier_name: string | null; tracking_url: string | null; cancellation_reason: string | null;
      payment_instructions: string | null; created_at: string; updated_at: string;
    };
    type RawNote = { id: number; order_id: number; note: string; created_by: string; created_at: string; deleted_at: string | null; updated_at: string };
    type RawFile = { 
      id: number; order_id: number; filename: string; original_name: string; file_url: string;
      mime_type: string; size_bytes: number; uploaded_by: string; uploaded_at: string; 
      deleted_at: string | null; updated_at: string;
    };

    const dirtyOrders = storeDb
      .prepare('SELECT id, status, delivery_type, tracking_number, courier_name, tracking_url, cancellation_reason, payment_instructions, created_at, updated_at FROM orders WHERE is_synced = 0')
      .all() as RawOrder[];

    const dirtyNotes = storeDb
      .prepare('SELECT id, order_id, note, created_by, created_at, deleted_at, updated_at FROM order_notes WHERE is_synced = 0')
      .all() as RawNote[];

    const dirtyFiles = storeDb
      .prepare('SELECT id, order_id, filename, original_name, file_url, mime_type, size_bytes, uploaded_by, uploaded_at, deleted_at, updated_at FROM order_files WHERE is_synced = 0')
      .all() as RawFile[];

    if (dirtyOrders.length === 0 && dirtyNotes.length === 0 && dirtyFiles.length === 0) {
      return json({ success: true, synced: { orders: 0, notes: 0, files: 0 }, message: 'Nothing to sync.' });
    }

    const payload = {
      upsert: {
        orders: dirtyOrders,
        orderNotes: dirtyNotes,
        orderFiles: dirtyFiles,
      }
    };

    const response = await fetch(`${gatewayUrl}/api/stores/${slug}/orders/sync`, {
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
      return apiError(502, `Gateway order sync failed (${response.status}): ${errorText}`);
    }

    // Mark synced
    const markSynced = storeDb.transaction(() => {
      if (dirtyOrders.length > 0) {
        const stmt = storeDb.prepare(`UPDATE orders SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
        for (const r of dirtyOrders) stmt.run(r.id, r.updated_at);
      }
      if (dirtyNotes.length > 0) {
        const stmt = storeDb.prepare(`UPDATE order_notes SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
        for (const r of dirtyNotes) stmt.run(r.id, r.updated_at);
      }
      if (dirtyFiles.length > 0) {
        const stmt = storeDb.prepare(`UPDATE order_files SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
        for (const r of dirtyFiles) stmt.run(r.id, r.updated_at);
      }
    });
    markSynced();

    return json({
      success: true,
      synced: {
        orders: dirtyOrders.length,
        notes: dirtyNotes.length,
        files: dirtyFiles.length,
      },
      message: `Order sync complete for "${slug}".`,
    });

  } else {
    // ── 2b. Fetch dirty catalog rows ────────────────────────────────────────
    type RawCategory = { id: number; name: string; parent_id: number | null; deleted_at: string | null; updated_at: string };
    type RawProduct = {
      id: number; title: string; description: string | null; sku: string | null;
      product_type: string; price: number | null; stock_quantity: number | null;
      metadata: string | null; category_id: number | null;
      tags: string | null; images: string | null; active: number; deleted_at: string | null;
      updated_at: string;
    };
    type RawVariant = {
      id: number; product_id: number; sku: string | null; price: number;
      stock: number; attributes: string; active: number; updated_at: string;
    };

    const dirtyCategories = storeDb
      .prepare('SELECT id, name, parent_id, deleted_at, updated_at FROM categories WHERE is_synced = 0')
      .all() as RawCategory[];

    const dirtyProducts = storeDb
      .prepare(`
        SELECT id, title, description, sku, product_type, price, stock_quantity,
               metadata, category_id, tags, images, active, deleted_at, updated_at
        FROM products WHERE is_synced = 0
      `)
      .all() as RawProduct[];

    const dirtyVariants = storeDb
      .prepare('SELECT * FROM product_variants WHERE is_synced = 0')
      .all() as RawVariant[];

    if (dirtyCategories.length === 0 && dirtyProducts.length === 0 && dirtyVariants.length === 0) {
      return json({ success: true, synced: { categories: 0, products: 0, variants: 0 }, message: 'Nothing to sync.' });
    }

    const upsertCategories = dirtyCategories
      .filter(c => c.deleted_at === null)
      .map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id }));

    const deleteCategoryIds = dirtyCategories
      .filter(c => c.deleted_at !== null)
      .map(c => c.id);

    const upsertProducts = dirtyProducts
      .filter(p => p.deleted_at === null)
      .map(p => {
        let rawImages: string[] = [];
        try {
          rawImages = p.images ? JSON.parse(p.images) : [];
        } catch (e) {
          console.warn(`[Sync] Failed to parse images for product ${p.id}:`, e);
        }

        const validImages: string[] = [];
        for (const img of rawImages) {
          if (img.startsWith('/')) {
            // Local uploads are inherently trusted; just absolutize them.
            if (sellerPublicUrl) validImages.push(`${sellerPublicUrl}${img}`);
          } else {
            // External images must pass security checks (HTTPS, no SSRF).
            validImages.push(...filterSecureImageUrls([img]));
          }
        }

        // Fetch variants for this product
        const variants = storeDb.prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1').all(p.id) as RawVariant[];

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          sku: p.sku,
          product_type: p.product_type,
          price: p.price,
          stock_quantity: p.stock_quantity,
          metadata: (() => {
            try { return p.metadata ? JSON.parse(p.metadata) : {}; } catch { return {}; }
          })(),
          category_id: p.category_id,
          tags: (() => {
            try { return p.tags ? JSON.parse(p.tags) : []; } catch { return []; }
          })(),
          images: validImages,
          active: Boolean(p.active),
          variants: variants.map(v => ({
            id: v.id,
            sku: v.sku,
            price: v.price,
            stock: v.stock,
            attributes: (() => {
              try { return v.attributes ? JSON.parse(v.attributes) : {}; } catch { return {}; }
            })(),
            active: Boolean(v.active),
          })),
        };
      });

    const deleteProductIds = dirtyProducts
      .filter(p => p.deleted_at !== null)
      .map(p => p.id);

    // Variants are soft-deleted by setting active=0, which is handled in upsertProducts.
    // If we have explicit variant deletions (hard delete), they would go here.
    // But our MCP tool uses soft-delete (active=0).

    const payload = {
      upsert: { categories: upsertCategories, products: upsertProducts },
      delete: { categoryIds: deleteCategoryIds, productIds: deleteProductIds },
    };

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

    const markSynced = storeDb.transaction(() => {
      if (dirtyCategories.length > 0) {
        const stmt = storeDb.prepare(`UPDATE categories SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
        for (const cat of dirtyCategories) stmt.run(cat.id, cat.updated_at);
      }
      if (dirtyProducts.length > 0) {
        const stmt = storeDb.prepare(`UPDATE products SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
        for (const prod of dirtyProducts) stmt.run(prod.id, prod.updated_at);
      }
      if (dirtyVariants.length > 0) {
        const stmt = storeDb.prepare(`UPDATE product_variants SET is_synced = 1 WHERE id = ? AND updated_at = ?`);
        for (const v of dirtyVariants) stmt.run(v.id, v.updated_at);
      }
    });
    markSynced();

    return json({
      success: true,
      synced: {
        categories: (upsertCategories.length + deleteCategoryIds.length),
        products: (upsertProducts.length + deleteProductIds.length),
        variants: dirtyVariants.length,
      },
      message: `Catalog sync complete for "${slug}".`,
    });
  }
};

