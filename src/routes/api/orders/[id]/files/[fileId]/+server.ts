import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const DELETE: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['store_admin']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const fileId = parseInt(event.params.fileId);
  const orderId = parseInt(event.params.id);
  const db = getStoreDb(store);
  
  // SEC-1: Scope to order_id to prevent cross-order/cross-store deletion
  const result = db.prepare(`
    UPDATE order_files 
    SET deleted_at = ?, deleted_by = ?, is_synced = 0 
    WHERE id = ? AND order_id = ?
  `).run(new Date().toISOString(), auth.user.username, fileId, orderId);

  if (result.changes > 0) {
    // Mark order as dirty
    db.prepare('UPDATE orders SET updated_at = datetime(\'now\'), is_synced = 0 WHERE id = ?').run(orderId);
  }

  return json({ success: result.changes > 0 });
};
