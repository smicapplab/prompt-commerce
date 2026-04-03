import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole, requireGatewayKey } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const page = parseInt(event.url.searchParams.get('page') ?? '1');
  const limit = parseInt(event.url.searchParams.get('limit') ?? '30');
  const q = event.url.searchParams.get('q') ?? '';
  const status = event.url.searchParams.get('status') ?? '';
  const offset = (page - 1) * limit;

  const db = getStoreDb(store);

  let query = `
    SELECT c.*
    FROM conversations c
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ` AND (c.buyer_ref LIKE ? OR c.buyer_name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
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
    countQuery += ` AND (buyer_ref LIKE ? OR buyer_name LIKE ?)`;
    countParams.push(`%${q}%`, `%${q}%`);
  }

  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  const { count } = db.prepare(countQuery).get(...countParams) as any;

  return json({ conversations, totalCount: count });
};

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = requireGatewayKey(event, store);
  if (auth instanceof Response) return auth;

  const body = await event.request.json();
  const { buyer_ref, buyer_name, channel, gateway_id } = body;
  if (!buyer_ref) return json({ error: 'buyer_ref is required' }, { status: 400 });

  const db = getStoreDb(store!);

  // Find existing open conversation
  let conv = db.prepare(`
    SELECT * FROM conversations
    WHERE buyer_ref = ? AND channel = ? AND status = 'open'
    LIMIT 1
  `).get(buyer_ref, channel || 'telegram') as any;

  if (!conv) {
    const result = db.prepare(`
      INSERT INTO conversations (buyer_ref, buyer_name, channel, gateway_id, status, mode)
      VALUES (?, ?, ?, ?, 'open', 'ai')
    `).run(buyer_ref, buyer_name || null, channel || 'telegram', gateway_id || null);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
  } else {
    // Update name and gateway_id if they changed
    const updates: string[] = [];
    const params: any[] = [];
    if (buyer_name && conv.buyer_name !== buyer_name) {
      updates.push('buyer_name = ?');
      params.push(buyer_name);
    }
    if (gateway_id && conv.gateway_id !== gateway_id) {
      updates.push('gateway_id = ?');
      params.push(gateway_id);
    }

    if (updates.length > 0) {
      updates.push('updated_at = datetime(\'now\')');
      params.push(conv.id);
      db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conv.id);
    }
  }

  return json(conv);
};
