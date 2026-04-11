import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const rawPage = parseInt(event.url.searchParams.get('page') ?? '1');
  const rawLimit = parseInt(event.url.searchParams.get('limit') ?? '20');
  const page = Math.min(Math.max(1, isNaN(rawPage) ? 1 : rawPage), 10000);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 200);
  const q = event.url.searchParams.get('q') ?? '';
  const status = event.url.searchParams.get('status') ?? '';
  const deliveryType = event.url.searchParams.get('delivery_type') ?? '';
  const showDeleted = event.url.searchParams.get('show_deleted') === '1';
  const offset = (page - 1) * limit;

  const db = getStoreDb(store);

  let query = `SELECT * FROM orders WHERE 1=1`;
  const params: any[] = [];

  if (!showDeleted) {
    query += ` AND deleted_at IS NULL`;
  }
  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    query += ` AND (buyer_ref LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')`;
    const s = `%${escaped}%`;
    params.push(s, s);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (deliveryType) {
    query += ` AND delivery_type = ?`;
    params.push(deliveryType);
  }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const orders = db.prepare(query).all(...params) as any[];

  const orderIds = orders.map((o) => o.id);
  let itemCounts: Record<number, number> = {};
  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    const counts = db.prepare(
      `SELECT order_id, COUNT(*) as count FROM order_items WHERE order_id IN (${placeholders}) GROUP BY order_id`
    ).all(...orderIds) as any[];
    for (const row of counts) itemCounts[row.order_id] = row.count;
  }
  const enriched = orders.map((o) => ({ ...o, item_count: itemCounts[o.id] ?? 0 }));

  let countQuery = `SELECT COUNT(*) as count FROM orders WHERE 1=1`;
  const countParams: any[] = [];
  if (!showDeleted) {
    countQuery += ` AND deleted_at IS NULL`;
  }
  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    countQuery += ` AND (buyer_ref LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')`;
    const s = `%${escaped}%`;
    countParams.push(s, s);
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (deliveryType) {
    countQuery += ` AND delivery_type = ?`;
    countParams.push(deliveryType);
  }
  const { count } = db.prepare(countQuery).get(...countParams) as any;

  return json({ orders: enriched, totalCount: count });
};

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const body = await event.request.json();
  const { items, ...orderBody } = body;

  const VALID_STATUSES = [
    'pending_payment', 'pending', 'paid', 'picking', 'packing', 
    'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 
    'cancelled', 'refunded'
  ];
  if (orderBody.status && !VALID_STATUSES.includes(orderBody.status)) {
    return json({ error: 'Invalid status' }, { status: 400 });
  }

  const db = getStoreDb(store);
  const now = new Date().toISOString();

  const createOrder = db.transaction((orderData: any, itemsData: any[]) => {
    const result = db.prepare(`
      INSERT INTO orders (
        buyer_ref, channel, status, total, notes, 
        delivery_type, payment_provider, payment_instructions,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderData.buyer_ref || null,
      orderData.channel || 'manual',
      orderData.status || 'pending',
      orderData.total || null,
      orderData.notes || null,
      orderData.delivery_type || 'delivery',
      orderData.payment_provider || null,
      orderData.payment_instructions || null,
      now, now
    );

    const orderId = result.lastInsertRowid;
    let calculatedTotal = 0;

    if (Array.isArray(itemsData)) {
      for (const item of itemsData) {
        const price = item.price || 0;
        const qty = item.quantity || 1;
        db.prepare(`
          INSERT INTO order_items (order_id, product_id, title, price, quantity)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, item.product_id || null, item.title, price, qty);
        
        if (item.product_id) {
          // SEC-11: Atomic stock decrement with check to prevent negative stock.
          // We don't manually set updated_at here so that the products_sync_dirty 
          // trigger can catch the change and set is_synced = 0 automatically.
          const updateResult = db.prepare(
            'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?'
          ).run(qty, item.product_id, qty);
          
          if (updateResult.changes === 0) {
            // Check if product exists to give a better error message
            const p = db.prepare('SELECT title, stock_quantity FROM products WHERE id = ?').get(item.product_id) as any;
            if (!p) {
              throw new Error(`Product ID ${item.product_id} not found`);
            } else {
              throw new Error(`Insufficient stock for "${p.title}" (requested ${qty}, available ${p.stock_quantity})`);
            }
          }
        }
        
        calculatedTotal += price * qty;
      }

      // If no total was provided, use the calculated one
      if (orderData.total === undefined || orderData.total === null) {
        db.prepare(`UPDATE orders SET total = ? WHERE id = ?`).run(calculatedTotal, orderId);
      }
    }
    return orderId;
  });

  const orderId = createOrder(orderBody, items);
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
  const orderItems = db.prepare(`
    SELECT oi.*, p.title as product_title
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(orderId);

  return json({ ...(order as any), items: orderItems }, { status: 201 });
};
