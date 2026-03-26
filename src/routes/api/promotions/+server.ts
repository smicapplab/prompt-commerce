import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { apiError } from '$lib/server/response.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  if (!store) return apiError(400, 'store is required');

  // SEC-8: Clamp pagination parameters
  const rawPage = parseInt(event.url.searchParams.get('page') ?? '1');
  const rawLimit = parseInt(event.url.searchParams.get('limit') ?? '20');
  const page = Math.min(Math.max(1, isNaN(rawPage) ? 1 : rawPage), 10000);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 200);
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

  if (!store) return apiError(400, 'store is required');

  const body = await event.request.json();
  const { title, product_id, voucher_code, discount_type, discount_value, start_date, end_date, active } = body;

  if (!title) return apiError(400, 'title is required');
  if (discount_value == null) return apiError(400, 'discount_value is required');

  // SEC-7: Numeric bounds and NaN checks
  const dValue = parseFloat(discount_value);
  if (!Number.isFinite(dValue) || dValue < 0) {
    return apiError(400, 'Invalid discount_value: must be a non-negative number');
  }

  if (product_id != null && (!Number.isFinite(product_id) || product_id < 0)) {
    return apiError(400, 'Invalid product_id');
  }

  // GAP-4: Enum validation for discount_type
  const VALID_DISCOUNT_TYPES = ['percentage', 'fixed'];
  if (discount_type && !VALID_DISCOUNT_TYPES.includes(discount_type)) {
    return apiError(400, 'Invalid discount_type: must be "percentage" or "fixed"');
  }

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
      dValue,
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
      return apiError(400, 'Voucher code already exists');
    }
    throw e;
  }
};
