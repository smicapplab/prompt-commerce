import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getRegistryDb, getStoreDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const id = Number(event.params.id);
  const registry = getRegistryDb();

  const store = registry.prepare('SELECT slug FROM stores WHERE id = ?').get(id) as { slug: string } | undefined;
  if (!store) return json({ error: 'Store not found' }, { status: 404 });

  if (user.role !== 'super_admin' && user.role !== 'admin') {
    const assigned = registry.prepare('SELECT role FROM user_stores WHERE user_id = ? AND store_slug = ?').get(user.sub, store.slug);
    if (!assigned) return json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getStoreDb(store.slug);
  const count = (table: string) =>
    (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

  // ── Revenue ──────────────────────────────────────────────────────────────
  const ACTIVE = `status NOT IN ('cancelled', 'refunded')`;

  const revenueTotal = (db.prepare(
    `SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE ${ACTIVE}`
  ).get() as { v: number }).v;

  const revenueThisMonth = (db.prepare(
    `SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE ${ACTIVE} AND created_at >= date('now', 'start of month')`
  ).get() as { v: number }).v;

  const revenueThisWeek = (db.prepare(
    `SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE ${ACTIVE} AND created_at >= date('now', '-6 days')`
  ).get() as { v: number }).v;

  const revenueToday = (db.prepare(
    `SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE ${ACTIVE} AND date(created_at) = date('now')`
  ).get() as { v: number }).v;

  const ordersThisMonth = (db.prepare(
    `SELECT COUNT(*) as v FROM orders WHERE created_at >= date('now', 'start of month')`
  ).get() as { v: number }).v;

  const ordersPending = (db.prepare(
    `SELECT COUNT(*) as v FROM orders WHERE status IN ('pending', 'paid', 'picking', 'packing', 'ready_for_pickup', 'in_transit')`
  ).get() as { v: number }).v;

  // ── Orders by status ─────────────────────────────────────────────────────
  const statusRows = db.prepare(
    `SELECT status, COUNT(*) as n FROM orders GROUP BY status ORDER BY n DESC`
  ).all() as { status: string; n: number }[];
  const ordersByStatus: Record<string, number> = {};
  for (const r of statusRows) ordersByStatus[r.status] = r.n;

  // ── Revenue trend: last 14 days ──────────────────────────────────────────
  const trendRows = db.prepare(`
    SELECT date(created_at) as d,
           COALESCE(SUM(CASE WHEN ${ACTIVE} THEN total ELSE 0 END), 0) as revenue,
           COUNT(*) as orders
    FROM orders
    WHERE created_at >= date('now', '-13 days')
    GROUP BY date(created_at)
    ORDER BY d ASC
  `).all() as { d: string; revenue: number; orders: number }[];

  // Fill in missing days with zeros
  const trendMap: Record<string, { revenue: number; orders: number }> = {};
  for (const r of trendRows) trendMap[r.d] = { revenue: r.revenue, orders: r.orders };

  const revenueTrend: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    revenueTrend.push({ date: key, ...(trendMap[key] ?? { revenue: 0, orders: 0 }) });
  }

  // ── Recent orders ────────────────────────────────────────────────────────
  const recentOrders = db.prepare(
    `SELECT id, buyer_ref, channel, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 6`
  ).all() as { id: number; buyer_ref: string | null; channel: string; status: string; total: number | null; created_at: string }[];

  // ── Top products ─────────────────────────────────────────────────────────
  const topProducts = db.prepare(`
    SELECT oi.title,
           SUM(oi.quantity) as units_sold,
           SUM(oi.price * oi.quantity) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled', 'refunded')
    GROUP BY oi.title
    ORDER BY units_sold DESC
    LIMIT 5
  `).all() as { title: string; units_sold: number; revenue: number }[];

  return json({
    // Counts
    products:      count('products'),
    categories:    count('categories'),
    promotions:    count('promotions'),
    reviews:       count('reviews'),
    orders:        count('orders'),
    conversations: count('conversations'),
    // Revenue
    revenueTotal,
    revenueThisMonth,
    revenueThisWeek,
    revenueToday,
    ordersThisMonth,
    ordersPending,
    // Breakdowns
    ordersByStatus,
    revenueTrend,
    recentOrders,
    topProducts,
  });
};
