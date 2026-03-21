import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const page = parseInt(event.url.searchParams.get('page') ?? '1');
  const limit = parseInt(event.url.searchParams.get('limit') ?? '30');
  const q = event.url.searchParams.get('q') ?? '';
  const status = event.url.searchParams.get('status') ?? '';
  const offset = (page - 1) * limit;

  const db = getStoreDb(store);

  let query = `
    SELECT c.*,
      (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ` AND c.buyer_ref LIKE ?`;
    params.push(`%${q}%`);
  }
  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const conversations = db.prepare(query).all(...params);

  let countQuery = `SELECT COUNT(*) as count FROM conversations WHERE 1=1`;
  const countParams: any[] = [];
  if (q) {
    countQuery += ` AND buyer_ref LIKE ?`;
    countParams.push(`%${q}%`);
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  const { count } = db.prepare(countQuery).get(...countParams) as any;

  return json({ conversations, totalCount: count });
};
