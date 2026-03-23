import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const page = parseInt(event.url.searchParams.get('page') ?? '1');
  const limit = parseInt(event.url.searchParams.get('limit') ?? '20');
  const q = event.url.searchParams.get('q') ?? '';
  const active = event.url.searchParams.get('active') ?? '';
  const offset = (page - 1) * limit;

  const db = getStoreDb(store);

  let query = `
    SELECT pr.*, p.title as product_title
    FROM promotions pr
    LEFT JOIN products p ON pr.product_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ` AND (pr.title LIKE ? OR pr.voucher_code LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (active !== '') {
    query += ` AND pr.active = ?`;
    params.push(active === '1' ? 1 : 0);
  }
  query += ` ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const promotions = db.prepare(query).all(...params);

  let countQuery = `SELECT COUNT(*) as count FROM promotions WHERE 1=1`;
  const countParams: any[] = [];
  if (q) {
    countQuery += ` AND (title LIKE ? OR voucher_code LIKE ?)`;
    countParams.push(`%${q}%`, `%${q}%`);
  }
  if (active !== '') {
    countQuery += ` AND active = ?`;
    countParams.push(active === '1' ? 1 : 0);
  }
  const { count } = db.prepare(countQuery).get(...countParams) as any;

  return json({ promotions, totalCount: count });
};

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const body = await event.request.json();
  const { title, product_id, voucher_code, discount_type, discount_value, start_date, end_date, active } = body;

  if (!title) return json({ error: 'title is required' }, { status: 400 });
  if (discount_value == null) return json({ error: 'discount_value is required' }, { status: 400 });

  const db = getStoreDb(store);
  const now = new Date().toISOString();

  try {
    const result = db.prepare(`
      INSERT INTO promotions (title, product_id, voucher_code, discount_type, discount_value, start_date, end_date, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      product_id || null,
      voucher_code || null,
      discount_type || 'percentage',
      parseFloat(discount_value),
      start_date || null,
      end_date || null,
      active !== false ? 1 : 0,
      now
    );

    const promotion = db.prepare(`
      SELECT pr.*, p.title as product_title
      FROM promotions pr
      LEFT JOIN products p ON pr.product_id = p.id
      WHERE pr.id = ?
    `).get(result.lastInsertRowid);

    return json(promotion, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return json({ error: 'Voucher code already exists' }, { status: 400 });
    }
    throw e;
  }
};
