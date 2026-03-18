import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { ProductRow } from '../types/index.js';

function parseProduct(row: ProductRow) {
  return {
    ...row,
    active: Boolean(row.active),
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    images: row.images ? (JSON.parse(row.images) as string[]) : [],
  };
}

export function registerProductTools(
  server: McpServer,
  db: Database.Database,
): void {
  // ─── search_products ──────────────────────────────────────────────────────
  server.tool(
    'search_products',
    'Search the product catalog by keyword, category, or price range. Returns matching active products.',
    {
      query: z.string().optional().describe('Search keyword (title, description, tags)'),
      category: z.string().optional().describe('Filter by category name'),
      min_price: z.number().optional().describe('Minimum price filter'),
      max_price: z.number().optional().describe('Maximum price filter'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum results to return'),
    },
    async ({ query, category, min_price, max_price, limit }) => {
      let sql = `
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.active = 1
      `;
      const params: (string | number)[] = [];

      if (query) {
        sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)`;
        const like = `%${query}%`;
        params.push(like, like, like);
      }
      if (category) {
        sql += ` AND c.name LIKE ?`;
        params.push(`%${category}%`);
      }
      if (min_price !== undefined) {
        sql += ` AND p.price >= ?`;
        params.push(min_price);
      }
      if (max_price !== undefined) {
        sql += ` AND p.price <= ?`;
        params.push(max_price);
      }
      sql += ` ORDER BY p.updated_at DESC LIMIT ?`;
      params.push(limit);

      const rows = db.prepare(sql).all(...params) as ProductRow[];
      const products = rows.map(parseProduct);

      return {
        content: [
          {
            type: 'text',
            text: products.length
              ? JSON.stringify(products, null, 2)
              : 'No products found matching your criteria.',
          },
        ],
      };
    },
  );

  // ─── get_product ─────────────────────────────────────────────────────────
  server.tool(
    'get_product',
    'Fetch full details for a single product by its ID or SKU.',
    {
      id: z.number().int().optional().describe('Product ID'),
      sku: z.string().optional().describe('Product SKU'),
    },
    async ({ id, sku }) => {
      if (!id && !sku) {
        return {
          content: [{ type: 'text', text: 'Error: provide either id or sku.' }],
          isError: true,
        };
      }

      const sql = `
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${id ? 'p.id = ?' : 'p.sku = ?'}
      `;
      const row = db.prepare(sql).get(id ?? sku) as ProductRow | undefined;

      if (!row) {
        return {
          content: [{ type: 'text', text: `Product not found.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(parseProduct(row), null, 2) }],
      };
    },
  );

  // ─── add_product ─────────────────────────────────────────────────────────
  server.tool(
    'add_product',
    'Add a new product to the catalog. Use after AI has generated the product content.',
    {
      title: z.string().min(1).describe('Product title'),
      description: z.string().optional().describe('Product description'),
      sku: z.string().optional().describe('Stock-keeping unit (unique identifier)'),
      category: z.string().optional().describe('Category name — will be created if it does not exist'),
      price: z.number().min(0).optional().describe('Price in local currency'),
      tags: z.array(z.string()).optional().describe('Tags for search and filtering'),
      images: z.array(z.string()).optional().describe('Image URLs'),
    },
    async ({ title, description, sku, category, price, tags, images }) => {
      let categoryId: number | null = null;

      if (category) {
        const existing = db
          .prepare(`SELECT id FROM categories WHERE name = ?`)
          .get(category) as { id: number } | undefined;

        if (existing) {
          categoryId = existing.id;
        } else {
          const result = db
            .prepare(`INSERT INTO categories (name) VALUES (?)`)
            .run(category);
          categoryId = result.lastInsertRowid as number;
        }
      }

      const result = db
        .prepare(
          `INSERT INTO products (title, description, sku, category_id, price, tags, images)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          title,
          description ?? null,
          sku ?? null,
          categoryId,
          price ?? null,
          tags ? JSON.stringify(tags) : null,
          images ? JSON.stringify(images) : null,
        );

      const newId = result.lastInsertRowid as number;
      return {
        content: [
          {
            type: 'text',
            text: `Product "${title}" added successfully with ID ${newId}.`,
          },
        ],
      };
    },
  );

  // ─── update_product ───────────────────────────────────────────────────────
  server.tool(
    'update_product',
    'Update one or more fields of an existing product by ID.',
    {
      id: z.number().int().describe('ID of the product to update'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      sku: z.string().optional().describe('New SKU'),
      category: z.string().optional().describe('New category name'),
      price: z.number().min(0).optional().describe('New price'),
      tags: z.array(z.string()).optional().describe('Replacement tag list'),
      images: z.array(z.string()).optional().describe('Replacement image URLs'),
      active: z.boolean().optional().describe('Set to false to delist the product'),
    },
    async ({ id, title, description, sku, category, price, tags, images, active }) => {
      const existing = db
        .prepare(`SELECT id FROM products WHERE id = ?`)
        .get(id) as { id: number } | undefined;

      if (!existing) {
        return {
          content: [{ type: 'text', text: `Product with ID ${id} not found.` }],
          isError: true,
        };
      }

      const updates: string[] = ['updated_at = datetime(\'now\')'];
      const params: (string | number | null)[] = [];

      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (sku !== undefined) { updates.push('sku = ?'); params.push(sku); }
      if (price !== undefined) { updates.push('price = ?'); params.push(price); }
      if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
      if (images !== undefined) { updates.push('images = ?'); params.push(JSON.stringify(images)); }
      if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

      if (category !== undefined) {
        let catId: number | null = null;
        if (category) {
          const cat = db
            .prepare(`SELECT id FROM categories WHERE name = ?`)
            .get(category) as { id: number } | undefined;
          catId = cat
            ? cat.id
            : (db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(category).lastInsertRowid as number);
        }
        updates.push('category_id = ?');
        params.push(catId);
      }

      params.push(id);
      db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      return {
        content: [{ type: 'text', text: `Product ID ${id} updated successfully.` }],
      };
    },
  );
}
