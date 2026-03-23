import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const PATCH: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  const id = parseInt(event.params.id);
  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(id);
  if (!existing) return json({ error: 'Promotion not found' }, { status: 404 });

  const body = await event.request.json();
  const fields: string[] = [];
  const values: any[] = [];

  const allowed = ['title', 'product_id', 'voucher_code', 'discount_type', 'discount_value', 'start_date', 'end_date', 'active'];
  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key] === '' ? null : body[key]);
    }
  }

  if (fields.length === 0) return json({ error: 'No fields to update' }, { status: 400 });
  values.push(id);

  try {
    db.prepare(`UPDATE promotions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return json({ error: 'Voucher code already exists' }, { status: 400 });
    }
    throw e;
  }

  const promotion = db.prepare(`
    SELECT pr.*, p.title as product_title
    FROM promotions pr
    LEFT JOIN products p ON pr.product_id = p.id
    WHERE pr.id = ?
  `).get(id);

  return json(promotion);
};

export const DELETE: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  const id = parseInt(event.params.id);
  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(id);
  if (!existing) return json({ error: 'Promotion not found' }, { status: 404 });

  db.prepare(`DELETE FROM promotions WHERE id = ?`).run(id);
  return json({ success: true });
};
