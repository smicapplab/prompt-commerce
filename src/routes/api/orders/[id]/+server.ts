import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const id = parseInt(event.params.id);
  const db = getStoreDb(store);
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  if (!order) return json({ error: 'Order not found' }, { status: 404 });

  const items = db.prepare(`
    SELECT oi.*, p.title as product_title, p.images as product_images
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(id) as any[];

  const parsedItems = items.map((i) => ({
    ...i,
    product_images: i.product_images ? JSON.parse(i.product_images) : [],
  }));

  return json({ ...(order as any), items: parsedItems });
};

export const PATCH: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  const id = parseInt(event.params.id);

  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  if (!existing) return json({ error: 'Order not found' }, { status: 404 });

  const body = await event.request.json();
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['status', 'notes', 'total', 'buyer_ref', 'channel'];

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) return json({ error: 'No fields to update' }, { status: 400 });

  fields.push(`updated_at = ?`);
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  const items = db.prepare(`
    SELECT oi.*, p.title as product_title
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(id);

  return json({ ...(order as any), items });
};

export const DELETE: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const id = parseInt(event.params.id);
  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  if (!existing) return json({ error: 'Order not found' }, { status: 404 });

  db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
  return json({ success: true });
};
