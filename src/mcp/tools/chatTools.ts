/**
 * chatTools.ts
 *
 * Provides store-aware tool definitions and an executor for use in the AI
 * Assistant chat.  Works with both Anthropic (tool_use) and Google Gemini
 * (functionDeclarations) formats.
 *
 * All write tools default confirm=false, which returns a PREVIEW and forces
 * the user (or model) to call again with confirm=true to actually commit.
 */

import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUploadDir } from '../db/client.js';

// ─── Shared JSON-Schema helpers ──────────────────────────────────────────────

type JSProp = {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  minimum?: number;
  maximum?: number;
  default?: unknown;
};

interface ToolDef {
  name: string;
  description: string;
  properties: Record<string, JSProp>;
  required?: string[];
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOL_DEFS: ToolDef[] = [
  // ── Read tools ──────────────────────────────────────────────────────────────
  {
    name: 'get_store_stats',
    description: 'Returns a high-level overview of the store: product counts, order totals, revenue, low-stock items, and pending reviews.',
    properties: {},
    required: [],
  },
  {
    name: 'search_products',
    description: 'Search the product catalog by keyword, category, stock status, or price range.',
    properties: {
      query:      { type: 'string',  description: 'Search keyword (title, description, tags)' },
      category:   { type: 'string',  description: 'Filter by category name' },
      min_price:  { type: 'number',  description: 'Minimum price filter' },
      max_price:  { type: 'number',  description: 'Maximum price filter' },
      active_only:{ type: 'boolean', description: 'When true (default) only return active products', default: true },
      limit:      { type: 'integer', description: 'Max results (default 20)', minimum: 1, maximum: 100, default: 20 },
    },
  },
  {
    name: 'get_product',
    description: 'Fetch full details for a single product by ID or SKU.',
    properties: {
      id:  { type: 'integer', description: 'Product ID' },
      sku: { type: 'string',  description: 'Product SKU' },
    },
  },
  {
    name: 'list_categories',
    description: 'List all product categories with their product counts.',
    properties: {},
    required: [],
  },
  {
    name: 'list_orders',
    description: 'List recent orders with optional status and date filters.',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by order status',
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      },
      limit:      { type: 'integer', description: 'Max results (default 20)', minimum: 1, maximum: 100, default: 20 },
      days_back:  { type: 'integer', description: 'Limit to orders from the last N days', minimum: 1 },
    },
  },
  {
    name: 'get_order',
    description: 'Fetch full details for a single order by ID, including line items.',
    properties: {
      id: { type: 'integer', description: 'Order ID', },
    },
    required: ['id'],
  },
  {
    name: 'list_promotions',
    description: 'List promotions and voucher codes. By default only returns active, non-expired ones.',
    properties: {
      include_expired: { type: 'boolean', description: 'Include expired or inactive promotions', default: false },
    },
  },
  {
    name: 'get_reviews',
    description: 'Fetch customer reviews for a product with summary stats.',
    properties: {
      product_id: { type: 'integer', description: 'Product ID to fetch reviews for' },
      limit:      { type: 'integer', description: 'Max reviews (default 10)', minimum: 1, maximum: 50, default: 10 },
    },
    required: ['product_id'],
  },
  // ── Write tools (always preview unless confirm=true) ─────────────────────
  {
    name: 'add_product',
    description: 'Add a new product to the catalog. Returns a preview by default — set confirm=true to actually save.',
    properties: {
      title:          { type: 'string',  description: 'Product title (required)' },
      description:    { type: 'string',  description: 'Product description' },
      sku:            { type: 'string',  description: 'Stock-keeping unit (unique identifier)' },
      category:       { type: 'string',  description: 'Category name — will be created if it does not exist' },
      price:          { type: 'number',  description: 'Price in local currency', minimum: 0 },
      stock_quantity: { type: 'integer', description: 'Initial stock level', minimum: 0, default: 0 },
      confirm:        { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['title'],
  },
  {
    name: 'update_product',
    description: 'Update one or more fields of an existing product by ID. Returns a preview by default — set confirm=true to save.',
    properties: {
      id:             { type: 'integer', description: 'ID of the product to update' },
      title:          { type: 'string',  description: 'New title' },
      description:    { type: 'string',  description: 'New description' },
      price:          { type: 'number',  description: 'New price', minimum: 0 },
      stock_quantity: { type: 'integer', description: 'New stock level', minimum: 0 },
      active:         { type: 'boolean', description: 'Set to false to delist the product' },
      category:       { type: 'string',  description: 'New category name' },
      confirm:        { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['id'],
  },
  {
    name: 'update_inventory',
    description: 'Update the stock quantity for a product by ID or SKU. Returns a preview by default — set confirm=true to save.',
    properties: {
      id:       { type: 'integer', description: 'Product ID' },
      sku:      { type: 'string',  description: 'Product SKU' },
      quantity: { type: 'integer', description: 'New total stock quantity', minimum: 0 },
      confirm:  { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['quantity'],
  },
  {
    name: 'create_category',
    description: 'Create a new product category. Returns a preview by default — set confirm=true to save.',
    properties: {
      name:      { type: 'string',  description: 'Category name (e.g. "Laptops")' },
      parent_id: { type: 'integer', description: 'Optional ID of the parent category' },
      confirm:   { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['name'],
  },
  {
    name: 'delete_category',
    description: 'Remove a category by ID. Products in this category will become uncategorized.',
    properties: {
      id:      { type: 'integer', description: 'ID of the category to delete' },
      confirm: { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['id'],
  },
  {
    name: 'update_category',
    description: 'Update a category name or parent ID.',
    properties: {
      id:        { type: 'integer', description: 'Category ID' },
      name:      { type: 'string',  description: 'New name' },
      parent_id: { type: 'integer', description: 'New parent ID' },
      confirm:   { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['id'],
  },
  {
    name: 'download_image',
    description: 'Download an image from a URL and attach it to a product.',
    properties: {
      product_id: { type: 'integer', description: 'The product ID to attach the image to' },
      url:        { type: 'string',  description: 'The public URL of the image' },
      confirm:    { type: 'boolean', description: 'Set to true to actually download. Default false (preview only).', default: false },
    },
    required: ['product_id', 'url'],
  },
  {
    name: 'search_images',
    description:
      'Search Google Images for a product and return direct image URLs. ' +
      'Use this to automatically find product images — e.g. when the seller says "find an image for iPhone 15" or "add images to my products". ' +
      'Returns image URLs you can immediately pass to download_image to attach to a product. ' +
      'Requires a Serper API key configured in Settings → AI/LLM.',
    properties: {
      query: { type: 'string',  description: 'Product name or description to search for images of' },
      num:   { type: 'integer', description: 'Number of image results to return (default 5, max 10)', minimum: 1, maximum: 10, default: 5 },
    },
    required: ['query'],
  },
  {
    name: 'fetch_url',
    description:
      'Fetch any public URL and return its text content and any image URLs found on the page. ' +
      'Use this to visit product pages (e.g. Amazon, Shopee, Lazada) and extract product info, descriptions, or image URLs. ' +
      'Image URLs found can be passed to download_image to attach to a product.',
    properties: {
      url: { type: 'string', description: 'The full URL to fetch (must start with https://)' },
    },
    required: ['url'],
  },
  {
    name: 'create_promotion',
    description: 'Create a new promotion or voucher code.',
    properties: {
      title:          { type: 'string',  description: 'Promotion title (e.g. "Summer Sale")' },
      discount_type:  { type: 'string',  description: 'Type of discount', enum: ['percentage', 'fixed'] },
      discount_value: { type: 'number',  description: 'Value of the discount' },
      voucher_code:   { type: 'string',  description: 'Optional unique voucher code' },
      product_id:     { type: 'integer', description: 'Optional ID of a specific product this applies to' },
      start_date:     { type: 'string',  description: 'Optional start date (YYYY-MM-DD)' },
      end_date:       { type: 'string',  description: 'Optional end date (YYYY-MM-DD)' },
      confirm:        { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['title', 'discount_type', 'discount_value'],
  },
  {
    name: 'delete_promotion',
    description: 'Delete a promotion by ID.',
    properties: {
      id:      { type: 'integer', description: 'Promotion ID' },
      confirm: { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['id'],
  },
  {
    name: 'update_promotion',
    description: 'Update one or more fields of an existing promotion.',
    properties: {
      id:             { type: 'integer', description: 'ID of the promotion to update' },
      title:          { type: 'string',  description: 'New title' },
      discount_type:  { type: 'string',  description: 'New discount type', enum: ['percentage', 'fixed'] },
      discount_value: { type: 'number',  description: 'New discount value' },
      voucher_code:   { type: 'string',  description: 'New voucher code' },
      product_id:     { type: 'integer', description: 'New product ID limit' },
      start_date:     { type: 'string',  description: 'New start date (YYYY-MM-DD)' },
      end_date:       { type: 'string',  description: 'New end date (YYYY-MM-DD)' },
      active:         { type: 'boolean', description: 'Enable/disable promotion' },
      confirm:        { type: 'boolean', description: 'Set to true to actually save. Default false (preview only).', default: false },
    },
    required: ['id'],
  },
];

// ─── Executor ────────────────────────────────────────────────────────────────

export async function executeStoreTool(
  name: string,
  args: Record<string, any>,
  db: Database.Database,
): Promise<string> {
  switch (name) {

    case 'get_store_stats': {
      const products    = (db.prepare(`SELECT COUNT(*) as n FROM products`).get() as any).n;
      const active      = (db.prepare(`SELECT COUNT(*) as n FROM products WHERE active=1`).get() as any).n;
      const lowStock    = (db.prepare(`SELECT COUNT(*) as n FROM products WHERE active=1 AND stock_quantity <= 5`).get() as any).n;
      const orders      = (db.prepare(`SELECT COUNT(*) as n FROM orders`).get() as any).n;
      const revenue     = (db.prepare(`SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE status NOT IN ('cancelled','refunded')`).get() as any).v;
      const pending     = (db.prepare(`SELECT COUNT(*) as n FROM orders WHERE status='pending'`).get() as any).n;
      const reviews     = (db.prepare(`SELECT COUNT(*) as n FROM reviews`).get() as any).n;
      const pendingRevs = (db.prepare(`SELECT COUNT(*) as n FROM reviews WHERE approved=0`).get() as any).n;
      return JSON.stringify({
        products: { total: products, active, low_stock: lowStock },
        orders: { total: orders, pending, revenue },
        reviews: { total: reviews, pending_approval: pendingRevs },
      }, null, 2);
    }

    case 'search_products': {
      const { query, category, min_price, max_price, active_only = true, limit = 20 } = args;
      let sql = `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
      const params: any[] = [];
      if (active_only) { sql += ` AND p.active = 1`; }
      if (query)       { sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)`; const l = `%${query}%`; params.push(l, l, l); }
      if (category)    { sql += ` AND c.name LIKE ?`; params.push(`%${category}%`); }
      if (min_price !== undefined) { sql += ` AND p.price >= ?`; params.push(min_price); }
      if (max_price !== undefined) { sql += ` AND p.price <= ?`; params.push(max_price); }
      sql += ` ORDER BY p.updated_at DESC LIMIT ?`;
      params.push(Math.min(Number(limit) || 20, 100));
      const rows = db.prepare(sql).all(...params) as any[];
      if (!rows.length) return 'No products found matching your criteria.';
      return JSON.stringify(rows.map(r => ({
        id: r.id, title: r.title, sku: r.sku, price: r.price,
        stock_quantity: r.stock_quantity, active: Boolean(r.active),
        category: r.category_name, tags: r.tags ? JSON.parse(r.tags) : [],
      })), null, 2);
    }

    case 'get_product': {
      const { id, sku } = args;
      if (!id && !sku) return 'Error: provide either id or sku.';
      const row = db.prepare(
        `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE ${id ? 'p.id=?' : 'p.sku=?'}`
      ).get(id ?? sku) as any;
      if (!row) return 'Product not found.';
      return JSON.stringify({
        ...row,
        active: Boolean(row.active),
        tags: row.tags ? JSON.parse(row.tags) : [],
        images: row.images ? JSON.parse(row.images) : [],
      }, null, 2);
    }

    case 'list_categories': {
      const rows = db.prepare(`
        SELECT c.id, c.name, c.parent_id, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
        GROUP BY c.id ORDER BY c.name
      `).all() as any[];
      if (!rows.length) return 'No categories found.';
      return JSON.stringify(rows, null, 2);
    }

    case 'list_orders': {
      const { status, limit = 20, days_back } = args;
      let sql = `SELECT o.*, COUNT(oi.id) as item_count FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE 1=1`;
      const params: any[] = [];
      if (status)    { sql += ` AND o.status = ?`; params.push(status); }
      if (days_back) { sql += ` AND o.created_at >= datetime('now', ?)`;  params.push(`-${days_back} days`); }
      sql += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT ?`;
      params.push(Math.min(Number(limit) || 20, 100));
      const rows = db.prepare(sql).all(...params) as any[];
      if (!rows.length) return 'No orders found.';
      return JSON.stringify(rows, null, 2);
    }

    case 'get_order': {
      const { id } = args;
      const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as any;
      if (!order) return `Order ID ${id} not found.`;
      const items = db.prepare(
        `SELECT oi.*, p.title as product_title, p.sku FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
      ).all(id) as any[];
      return JSON.stringify({ ...order, items }, null, 2);
    }

    case 'list_promotions': {
      const { include_expired = false } = args;
      let sql = `SELECT * FROM promotions WHERE 1=1`;
      if (!include_expired) sql += ` AND active=1 AND (end_date IS NULL OR end_date >= date('now'))`;
      sql += ` ORDER BY created_at DESC`;
      const rows = db.prepare(sql).all() as any[];
      if (!rows.length) return include_expired ? 'No promotions found.' : 'No active promotions found.';
      return JSON.stringify(rows.map(r => ({ ...r, active: Boolean(r.active) })), null, 2);
    }

    case 'get_reviews': {
      const { product_id, limit = 10 } = args;
      const product = db.prepare(`SELECT id, title FROM products WHERE id = ?`).get(product_id) as any;
      if (!product) return `Product ID ${product_id} not found.`;
      const reviews = db.prepare(`SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT ?`).all(product_id, Math.min(Number(limit), 50)) as any[];
      const stats   = db.prepare(`SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE product_id = ?`).get(product_id) as any;
      return JSON.stringify({
        product,
        summary: { total_reviews: stats.count, average_rating: stats.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null },
        reviews,
      }, null, 2);
    }

    case 'add_product': {
      const { title, description, sku, category, price, stock_quantity = 0, confirm = false } = args;
      if (!title) return 'Error: title is required.';
      const preview = { title, sku: sku ?? null, description: description ?? null, category: category ?? null, price: price ?? null, stock_quantity };
      if (!confirm) return `📋 PREVIEW — no changes saved yet\n\n${JSON.stringify(preview, null, 2)}\n\nCall add_product again with confirm=true to save it.`;
      let categoryId: number | null = null;
      if (category) {
        const cat = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(category) as any;
        categoryId = cat ? cat.id : Number(db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(category).lastInsertRowid);
      }
      const r = db.prepare(`INSERT INTO products (title, description, sku, category_id, price, stock_quantity) VALUES (?,?,?,?,?,?)`).run(title, description ?? null, sku ?? null, categoryId, price ?? null, stock_quantity);
      return `✅ Product "${title}" saved with ID ${r.lastInsertRowid}.`;
    }

    case 'update_product': {
      const { id, confirm = false, ...fields } = args;
      const existing = db.prepare(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(id) as any;
      if (!existing) return `Product ID ${id} not found.`;
      const changes: Record<string, any> = {};
      if (fields.title !== undefined && fields.title !== existing.title)             changes.title = { from: existing.title, to: fields.title };
      if (fields.description !== undefined)                                           changes.description = { from: existing.description, to: fields.description };
      if (fields.price !== undefined && fields.price !== existing.price)             changes.price = { from: existing.price, to: fields.price };
      if (fields.stock_quantity !== undefined)                                        changes.stock_quantity = { from: existing.stock_quantity, to: fields.stock_quantity };
      if (fields.active !== undefined && fields.active !== Boolean(existing.active)) changes.active = { from: Boolean(existing.active), to: fields.active };
      if (fields.category !== undefined && fields.category !== existing.category_name) changes.category = { from: existing.category_name, to: fields.category };
      if (!confirm) return `📋 PREVIEW — Product ID ${id} ("${existing.title}") changes:\n${JSON.stringify(changes, null, 2)}\n\nCall update_product with confirm=true to save.`;
      const updates: string[] = [`updated_at = datetime('now')`];
      const params: any[] = [];
      if (fields.title !== undefined)          { updates.push('title = ?');          params.push(fields.title); }
      if (fields.description !== undefined)    { updates.push('description = ?');    params.push(fields.description); }
      if (fields.price !== undefined)          { updates.push('price = ?');          params.push(fields.price); }
      if (fields.stock_quantity !== undefined) { updates.push('stock_quantity = ?'); params.push(fields.stock_quantity); }
      if (fields.active !== undefined)         { updates.push('active = ?');         params.push(fields.active ? 1 : 0); }
      if (fields.category !== undefined) {
        let catId: number | null = null;
        if (fields.category) {
          const cat = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(fields.category) as any;
          catId = cat ? cat.id : Number(db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(fields.category).lastInsertRowid);
        }
        updates.push('category_id = ?'); params.push(catId);
      }
      params.push(id);
      db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return `✅ Product ID ${id} updated successfully.`;
    }

    case 'update_inventory': {
      const { id, sku, quantity, confirm = false } = args;
      if (id === undefined && !sku) return 'Error: provide either id or sku.';
      if (quantity === undefined)   return 'Error: quantity is required.';
      const row = db.prepare(`SELECT * FROM products WHERE ${id !== undefined ? 'id=?' : 'sku=?'}`).get(id ?? sku) as any;
      if (!row) return 'Product not found.';
      if (!confirm) return `📋 PREVIEW — Product "${row.title}" stock: ${row.stock_quantity} → ${quantity}\n\nCall update_inventory with confirm=true to save.`;
      db.prepare(`UPDATE products SET stock_quantity=?, updated_at=datetime('now') WHERE id=?`).run(quantity, row.id);
      return `✅ Inventory for "${row.title}" updated to ${quantity}.`;
    }

    case 'create_category': {
      const { name, parent_id, confirm = false } = args;
      if (!name) return 'Error: category name is required.';
      if (!confirm) return `📋 PREVIEW — Create category "${name}"${parent_id ? ` (Parent ID: ${parent_id})` : ''}.\n\nCall create_category with confirm=true to save.`;
      const r = db.prepare(`INSERT INTO categories (name, parent_id) VALUES (?, ?)`).run(name, parent_id ?? null);
      return `✅ Category "${name}" created with ID ${r.lastInsertRowid}.`;
    }

    case 'delete_category': {
      const { id, confirm = false } = args;
      const cat = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as any;
      if (!cat) return `Category ID ${id} not found.`;
      if (!confirm) return `📋 PREVIEW — Delete category "${cat.name}" (ID ${id}). Products in this category will become uncategorized.\n\nCall delete_category with confirm=true to confirm.`;
      db.prepare(`UPDATE products SET category_id = NULL WHERE category_id = ?`).run(id);
      db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
      return `✅ Category "${cat.name}" deleted.`;
    }

    case 'update_category': {
      const { id, name, parent_id, confirm = false } = args;
      const existing = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as any;
      if (!existing) return `Category ID ${id} not found.`;
      if (!confirm) return `📋 PREVIEW — Update category ID ${id}:\n${JSON.stringify({ name: name ?? existing.name, parent_id: parent_id ?? existing.parent_id }, null, 2)}\n\nCall update_category with confirm=true to save.`;
      const updates: string[] = [];
      const params: any[] = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (parent_id !== undefined) { updates.push('parent_id = ?'); params.push(parent_id); }
      if (updates.length === 0) return 'No changes provided.';
      params.push(id);
      db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return `✅ Category ID ${id} updated successfully.`;
    }

    case 'download_image': {
      const { product_id, url, confirm = false } = args;
      const product = db.prepare(`SELECT id, title, images FROM products WHERE id = ?`).get(product_id) as any;
      if (!product) return `Product ID ${product_id} not found.`;

      if (!confirm) return `📋 PREVIEW — Download image from ${url} and attach to "${product.title}" (ID ${product_id}).\n\nCall download_image with confirm=true to execute.`;

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/')) throw new Error(`URL did not return an image (got ${contentType})`);
        const buffer = await response.arrayBuffer();
        const rawExt = path.extname(new URL(url).pathname).split(/[#?]/)[0] || '.jpg';
        const ext = rawExt.length > 5 ? '.jpg' : rawExt;
        const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        const uploadDir = getUploadDir();
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(buffer));

        const currentImages: string[] = product.images ? JSON.parse(product.images) : [];
        const newImages = [...currentImages, `/uploads/${filename}`];
        db.prepare(`UPDATE products SET images = ?, is_synced = 0, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(newImages), product_id);

        return `✅ Image downloaded and attached to "${product.title}" (ID ${product_id}). Saved as /uploads/${filename}`;
      } catch (err: any) {
        return `❌ Failed to download image: ${err.message}`;
      }
    }

    case 'search_images': {
      const { query, num = 5 } = args;
      if (!query?.trim()) return 'Error: query is required.';
      const keyRow = db.prepare(`SELECT value FROM settings WHERE key = 'serper_api_key'`).get() as { value: string } | undefined;
      if (!keyRow?.value) return '⚠️ Image search is not configured. Ask the store owner to add a Serper API key in Settings → AI/LLM.';
      try {
        const res = await fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: { 'X-API-KEY': keyRow.value, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query.trim(), num: Math.min(Number(num) || 5, 10) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return `❌ Serper API error ${res.status}. Check the Serper API key in Settings.`;
        const data = await res.json() as { images?: Array<{ imageUrl: string; title: string; source: string }> };
        const images = (data.images ?? []).slice(0, num);
        if (!images.length) return `No images found for "${query}".`;
        return JSON.stringify({
          query,
          results: images.map((img, i) => ({ index: i + 1, imageUrl: img.imageUrl, title: img.title, source: img.source })),
          tip: 'Pass any imageUrl to download_image(product_id, url, confirm=true) to attach it to a product.',
        }, null, 2);
      } catch (err: any) {
        return `❌ Image search failed: ${err.message}`;
      }
    }

    case 'fetch_url': {
      const { url } = args;
      if (!url?.startsWith('http')) return 'Error: URL must start with https://';
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return `Error: HTTP ${res.status} from ${url}`;
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.startsWith('image/')) return JSON.stringify({ type: 'image', imageUrl: url });
        const html = await res.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 3000);
        const imgRegex = /(?:src|data-src|data-lazy-src)=["']([^"']*\.(?:jpg|jpeg|png|webp|gif)[^"']*)/gi;
        const imageUrls: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = imgRegex.exec(html)) !== null && imageUrls.length < 20) {
          const src = m[1];
          const absolute = src.startsWith('http') ? src : new URL(src, url).href;
          if (!imageUrls.includes(absolute)) imageUrls.push(absolute);
        }
        return JSON.stringify({ type: 'page', text, imageUrls }, null, 2);
      } catch (err: any) {
        return `Error fetching URL: ${err.message}`;
      }
    }

    case 'create_promotion': {
      const { title, discount_type, discount_value, voucher_code, product_id, start_date, end_date, confirm = false } = args;
      const preview = { title, discount_type, discount_value, voucher_code, product_id, start_date, end_date };
      if (!confirm) return `📋 PREVIEW — Create promotion:\n${JSON.stringify(preview, null, 2)}\n\nCall create_promotion with confirm=true to save.`;
      
      const r = db.prepare(`
        INSERT INTO promotions (title, discount_type, discount_value, voucher_code, product_id, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(title, discount_type, discount_value, voucher_code ?? null, product_id ?? null, start_date ?? null, end_date ?? null);
      
      return `✅ Promotion "${title}" created with ID ${r.lastInsertRowid}.`;
    }

    case 'delete_promotion': {
      const { id, confirm = false } = args;
      const promo = db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(id) as any;
      if (!promo) return `Promotion ID ${id} not found.`;
      if (!confirm) return `📋 PREVIEW — Delete promotion "${promo.title}" (ID ${id}).\n\nCall delete_promotion with confirm=true to confirm.`;
      db.prepare(`DELETE FROM promotions WHERE id = ?`).run(id);
      return `✅ Promotion "${promo.title}" deleted.`;
    }

    case 'update_promotion': {
      const { id, confirm = false, ...fields } = args;
      const existing = db.prepare(`SELECT * FROM promotions WHERE id = ?`).get(id) as any;
      if (!existing) return `Promotion ID ${id} not found.`;
      
      const changes: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== existing[k]) changes[k] = { from: existing[k], to: v };
      }
      
      if (!confirm) return `📋 PREVIEW — Update promotion ID ${id}:\n${JSON.stringify(changes, null, 2)}\n\nCall update_promotion with confirm=true to save.`;
      
      const updates: string[] = [`updated_at = datetime('now')`];
      const params: any[] = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) {
          updates.push(`${k} = ?`);
          params.push(k === 'active' ? (v ? 1 : 0) : v);
        }
      }
      
      if (updates.length === 1) return 'No changes provided.';
      params.push(id);
      db.prepare(`UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return `✅ Promotion ID ${id} updated successfully.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── Exported format helpers ─────────────────────────────────────────────────

function toAnthropicTool(def: ToolDef): any {
  return {
    name: def.name,
    description: def.description,
    input_schema: { type: 'object', properties: def.properties },
  };
}

function toGeminiTool(def: ToolDef): any {
  return {
    name: def.name,
    description: def.description,
    parameters: { type: 'object', properties: def.properties, required: def.required },
  };
}

function toOpenaiTool(def: ToolDef): any {
  return {
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: { type: 'object', properties: def.properties, required: def.required },
    }
  };
}

export const anthropicTools = TOOL_DEFS.map(toAnthropicTool);
export const geminiTools = TOOL_DEFS.map(toGeminiTool);
export const openaiTools = TOOL_DEFS.map(toOpenaiTool);
