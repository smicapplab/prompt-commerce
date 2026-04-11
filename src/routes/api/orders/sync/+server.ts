import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { apiError } from '$lib/server/response.js';
import { getDb, getStoreDb } from '$lib/server/db.js';

export const POST: RequestHandler = async (event) => {
  const slug = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, slug, ['ops']);
  if (auth instanceof Response) return auth;

  if (!slug) return apiError(400, 'store query parameter required');

  // ── 1. Get gateway configuration ──────────────────────────────────────────
  const registry = getDb();
  const publicUrlSetting = (registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seller_public_url') as { value: string } | undefined)?.value;

  let sellerPublicUrl = process.env.SELLER_PUBLIC_URL ?? publicUrlSetting;
  if (sellerPublicUrl) {
    try {
      sellerPublicUrl = new URL(sellerPublicUrl).origin;
    } catch {
      sellerPublicUrl = undefined;
    }
  }

  const store = registry
    .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
    .get(slug) as { gateway_key: string | null } | undefined;

  if (!store?.gateway_key) return apiError(400, 'Store missing or not verified');

  const gatewayUrlRow = registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('gateway_url') as { value: string } | undefined;
  const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');
  if (!gatewayUrl) return apiError(400, 'gateway_url not configured');

  // ── 2. Fetch dirty rows ────────────────────────────────────────────────────
  const storeDb = getStoreDb(slug);

  // GAP-9: Apply 500-row limit to prevent memory issues with large dirty sets
  const dirtyOrders = storeDb.prepare('SELECT * FROM orders WHERE is_synced = 0 LIMIT 500').all() as any[];
  const dirtyNotes = storeDb.prepare('SELECT * FROM order_notes WHERE is_synced = 0 LIMIT 500').all() as any[];
  const dirtyFiles = storeDb.prepare('SELECT * FROM order_files WHERE is_synced = 0 LIMIT 500').all() as any[];

  if (dirtyOrders.length === 0 && dirtyNotes.length === 0 && dirtyFiles.length === 0) {
    return json({ success: true, message: 'Nothing to sync.' });
  }

  // ── 3. Build payload ───────────────────────────────────────────────────────
  const payload = {
    upsert: {
      orders: dirtyOrders.map(o => ({
        id: o.id,
        status: o.status,
        delivery_type: o.delivery_type,
        tracking_number: o.tracking_number,
        courier_name: o.courier_name,
        tracking_url: o.tracking_url,
        cancellation_reason: o.cancellation_reason,
        payment_provider: o.payment_provider,
        payment_instructions: o.payment_instructions,
        buyer_ref: o.buyer_ref,
        total: o.total,
        created_at: o.created_at,
        updated_at: o.updated_at,
        deleted_at: o.deleted_at
      })),
      orderNotes: dirtyNotes.map(n => ({
        id: n.id,
        order_id: n.order_id,
        note: n.note,
        created_by: n.created_by,
        created_at: n.created_at,
        deleted_at: n.deleted_at,
        deleted_by: n.deleted_by
      })),
      orderFiles: dirtyFiles.map(f => ({
        id: f.id,
        order_id: f.order_id,
        filename: f.filename,
        original_name: f.original_name,
        file_url: (f.file_url.startsWith('/') && sellerPublicUrl) ? `${sellerPublicUrl}${f.file_url}` : f.file_url,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
        uploaded_by: f.uploaded_by,
        uploaded_at: f.uploaded_at,
        deleted_at: f.deleted_at,
        deleted_by: f.deleted_by
      }))
    }
  };

  // ── 4. POST to gateway ────────────────────────────────────────────────────
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
    const text = await response.text().catch(() => '');
    return apiError(502, `Gateway sync failed: ${text}`);
  }

  // ── 5. Mark synced ────────────────────────────────────────────────────────
  storeDb.transaction(() => {
    if (dirtyOrders.length > 0) {
      const stmt = storeDb.prepare('UPDATE orders SET is_synced = 1 WHERE id = ? AND updated_at = ?');
      for (const o of dirtyOrders) stmt.run(o.id, o.updated_at);
    }
    if (dirtyNotes.length > 0) {
      const stmt = storeDb.prepare('UPDATE order_notes SET is_synced = 1 WHERE id = ?');
      for (const n of dirtyNotes) stmt.run(n.id);
    }
    if (dirtyFiles.length > 0) {
      const stmt = storeDb.prepare('UPDATE order_files SET is_synced = 1 WHERE id = ?');
      for (const f of dirtyFiles) stmt.run(f.id);
    }
  })();

  return json({ success: true, message: 'Order sync complete' });
};
