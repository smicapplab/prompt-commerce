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
  const rating = event.url.searchParams.get('rating') ?? '';
  const offset = (page - 1) * limit;

  const db = getStoreDb(store);

  let query = `
    SELECT r.*, p.title as product_title
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ` AND (r.customer_name LIKE ? OR r.comment LIKE ? OR p.title LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (rating) {
    query += ` AND r.rating = ?`;
    params.push(parseInt(rating));
  }
  query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const reviews = db.prepare(query).all(...params);

  let countQuery = `SELECT COUNT(*) as count FROM reviews r LEFT JOIN products p ON r.product_id = p.id WHERE 1=1`;
  const countParams: any[] = [];
  if (q) {
    countQuery += ` AND (r.customer_name LIKE ? OR r.comment LIKE ? OR p.title LIKE ?)`;
    countParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (rating) {
    countQuery += ` AND r.rating = ?`;
    countParams.push(parseInt(rating));
  }
  const { count } = db.prepare(countQuery).get(...countParams) as any;

  return json({ reviews, totalCount: count });
};

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['merchandising']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const body = await event.request.json();
  const { product_id, customer_name, rating, comment } = body;

  if (!product_id) return json({ error: 'product_id is required' }, { status: 400 });
  if (!rating || rating < 1 || rating > 5) return json({ error: 'rating must be 1–5' }, { status: 400 });

  const db = getStoreDb(store);
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO reviews (product_id, customer_name, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(product_id, customer_name || null, rating, comment || null, now);

  const review = db.prepare(`
    SELECT r.*, p.title as product_title
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  return json(review, { status: 201 });
};
