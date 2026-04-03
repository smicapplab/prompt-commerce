import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';

// ─── Types ─────────────────────────────────────────────────────────────────
interface OrderRow {
  id: number;
  buyer_ref: string | null;
  channel: string;
  status: string;
  total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number | null;
  title: string;
  price: number;
  quantity: number;
}

interface ProductRow {
  id: number;
  title: string;
  price: number | null;
  stock_quantity: number;
  active: number;
}

// ─── Register tools ─────────────────────────────────────────────────────────
export function registerOrderTools(server: McpServer, db: Database.Database): void {

  // ── create_order ──────────────────────────────────────────────────────────
  server.tool(
    'create_order',
    'Place a customer order for one or more products. Deducts stock on confirm. Returns a preview by default — set confirm=true to place the order.',
    {
      items: z.array(z.object({
        product_id: z.number().int().describe('Product ID'),
        quantity: z.number().int().min(1).describe('Quantity'),
      })).min(1).describe('Items to order'),
      buyer_ref: z.string().optional().describe('Customer identifier (e.g. Telegram user ID)'),
      channel: z.string().default('telegram').describe('Sales channel: telegram, web, etc.'),
      notes: z.string().optional().describe('Delivery notes, name, address, etc.'),
      confirm: z.boolean().default(false).describe('Set true to actually place the order. False returns a preview.'),
    },
    async ({ items, buyer_ref, channel, notes, confirm }) => {
      // Resolve products and validate stock
      const resolved: Array<{ product: ProductRow; quantity: number }> = [];
      const errors: string[] = [];

      for (const item of items) {
        const product = db.prepare(
          'SELECT id, title, price, stock_quantity, active FROM products WHERE id = ?'
        ).get(item.product_id) as ProductRow | undefined;

        if (!product) {
          errors.push(`Product ID ${item.product_id} not found.`);
          continue;
        }
        if (!product.active) {
          errors.push(`"${product.title}" is not available.`);
          continue;
        }
        if (product.stock_quantity < item.quantity) {
          errors.push(`"${product.title}" only has ${product.stock_quantity} in stock (requested ${item.quantity}).`);
          continue;
        }
        resolved.push({ product, quantity: item.quantity });
      }

      if (errors.length > 0) {
        return {
          content: [{ type: 'text', text: `❌ Order validation failed:\n${errors.map(e => `• ${e}`).join('\n')}` }],
        };
      }

      const total = resolved.reduce(
        (sum, { product, quantity }) => sum + (product.price ?? 0) * quantity,
        0
      );

      const preview = {
        items: resolved.map(({ product, quantity }) => ({
          product_id: product.id,
          title: product.title,
          price: product.price,
          quantity,
          subtotal: (product.price ?? 0) * quantity,
        })),
        total,
        buyer_ref: buyer_ref ?? null,
        channel,
        notes: notes ?? null,
      };

      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 Order Preview\n\n${preview.items.map(i => `• ${i.title} × ${i.quantity} = ₱${i.subtotal.toFixed(2)}`).join('\n')}\n\nTotal: ₱${total.toFixed(2)}\n\nSet confirm=true to place this order.`,
          }],
        };
      }

      // Place the order in a transaction
      const placeOrder = db.transaction(() => {
        const orderResult = db.prepare(`
          INSERT INTO orders (buyer_ref, channel, status, total, notes)
          VALUES (?, ?, 'pending', ?, ?)
        `).run(buyer_ref ?? null, channel, total, notes ?? null);

        const orderId = orderResult.lastInsertRowid as number;

        for (const { product, quantity } of resolved) {
          db.prepare(`
            INSERT INTO order_items (order_id, product_id, title, price, quantity)
            VALUES (?, ?, ?, ?, ?)
          `).run(orderId, product.id, product.title, product.price ?? 0, quantity);

          // Deduct stock
          db.prepare(
            'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime(\'now\') WHERE id = ?'
          ).run(quantity, product.id);
        }

        return orderId;
      });

      const orderId = placeOrder();

      return {
        content: [
          {
            type: 'text',
            text: `✅ Order #${orderId} placed!\n\n${preview.items.map(i => `• ${i.title} × ${i.quantity}`).join('\n')}\n\nTotal: ₱${total.toFixed(2)}\nChannel: ${channel}\n${notes ? `Notes: ${notes}` : ''}`,
          },
          {
            type: 'text',
            text: JSON.stringify({ order_id: orderId, success: true }),
          }
        ],
      };
    },
  );

  // ── get_order ─────────────────────────────────────────────────────────────
  server.tool(
    'get_order',
    'Get order details and status by order ID.',
    {
      id: z.number().int().describe('Order ID'),
    },
    async ({ id }) => {
      const order = db.prepare(
        'SELECT * FROM orders WHERE id = ?'
      ).get(id) as OrderRow | undefined;

      if (!order) {
        return { content: [{ type: 'text', text: `Order #${id} not found.` }] };
      }

      const orderItems = db.prepare(
        'SELECT * FROM order_items WHERE order_id = ?'
      ).all(id) as OrderItemRow[];

      const itemLines = orderItems.map(
        i => `  • ${i.title} × ${i.quantity} @ ₱${i.price.toFixed(2)}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Order #${order.id}\nStatus: ${order.status}\nChannel: ${order.channel}\nTotal: ₱${(order.total ?? 0).toFixed(2)}\n${order.notes ? `Notes: ${order.notes}\n` : ''}Created: ${order.created_at}\n\nItems:\n${itemLines}`,
        }],
      };
    },
  );

  // ── list_orders ───────────────────────────────────────────────────────────
  server.tool(
    'list_orders',
    'List recent orders for this store. Optionally filter by status or channel.',
    {
      status: z.enum(['pending', 'paid', 'picking', 'packing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled', 'refunded']).optional(),
      channel: z.string().optional().describe('Filter by channel (telegram, web, etc.)'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ status, channel, limit }) => {
      let query = 'SELECT * FROM orders WHERE 1=1';
      const params: unknown[] = [];

      if (status) { query += ' AND status = ?'; params.push(status); }
      if (channel) { query += ' AND channel = ?'; params.push(channel); }
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const orders = db.prepare(query).all(...params) as OrderRow[];

      if (!orders.length) {
        return { content: [{ type: 'text', text: 'No orders found.' }] };
      }

      const lines = orders.map(
        o => `#${o.id} | ${o.status} | ₱${(o.total ?? 0).toFixed(2)} | ${o.channel} | ${o.created_at.slice(0, 10)}`
      ).join('\n');

      return {
        content: [{ type: 'text', text: `Orders (${orders.length}):\n\n${lines}` }],
      };
    },
  );

  // ── update_order_status ───────────────────────────────────────────────────
  server.tool(
    'update_order_status',
    'Update the status of an order (pending → confirmed → shipped → delivered, or cancelled).',
    {
      id: z.number().int().describe('Order ID'),
      status: z.enum(['pending', 'paid', 'picking', 'packing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled', 'refunded']).describe('New status'),
    },
    async ({ id, status }) => {
      const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id) as { id: number } | undefined;
      if (!order) {
        return { content: [{ type: 'text', text: `Order #${id} not found.` }] };
      }

      db.prepare(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(status, id);

      return {
        content: [{ type: 'text', text: `✅ Order #${id} status updated to "${status}".` }],
      };
    },
  );
}
