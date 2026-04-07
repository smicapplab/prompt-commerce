import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { ProductRow } from '../types/index.js';
import * as xlsx from 'xlsx';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import dns from 'dns/promises';
import { getUploadDir } from '../db/client.js';

// Upload dir lives in _data/uploads/ (outside the seller package)
const UPLOAD_DIR = getUploadDir();

// ─── SSRF protection ─────────────────────────────────────────────────────────
// Returns true if the IPv4 address falls in a private / link-local / loopback range.
function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // treat malformed IPs as unsafe
  }
  const [a, b] = parts;
  return (
    a === 127 ||                           // 127.0.0.0/8   loopback
    a === 10 ||                            // 10.0.0.0/8    private
    a === 0 ||                             // 0.0.0.0/8     "this" network
    (a === 172 && b >= 16 && b <= 31) ||   // 172.16.0.0/12 private
    (a === 192 && b === 168) ||            // 192.168.0.0/16 private
    (a === 169 && b === 254) ||            // 169.254.0.0/16 link-local
    (a === 100 && b >= 64 && b <= 127) ||  // 100.64.0.0/10  CGNAT
    a === 198 && b === 51 && parts[2] === 100 || // 198.51.100.0/24 TEST-NET-2
    a === 203 && b === 0   && parts[2] === 113   // 203.0.113.0/24  TEST-NET-3
  );
}

async function isSsrfSafe(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    // Only allow http/https schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // Block numeric IP hostnames that are private
    const host = parsed.hostname;
    // If it's already a dotted-decimal IPv4, check directly
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return !isPrivateIp(host);
    }
    // Resolve the hostname and check all returned IPs
    const addresses = await dns.resolve4(host).catch(() => [] as string[]);
    if (!addresses.length) return false; // unresolvable — block
    return addresses.every(ip => !isPrivateIp(ip));
  } catch {
    return false;
  }
}

export async function downloadAndCacheImages(urls: string[]): Promise<{ urls: string[], errors: string[] }> {
  const finalUrls: string[] = [];
  const errors: string[] = [];
  for (const url of urls) {
    if (!url.startsWith('http')) {
      finalUrls.push(url);
      continue;
    }
    try {
      // SSRF guard: reject requests to internal/private addresses
      if (!(await isSsrfSafe(url))) {
        const err = `SSRF blocked: refusing to fetch private/internal URL: ${url}`;
        console.error(err);
        errors.push(err);
        finalUrls.push(url);
        continue;
      }
      const response = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(10000) // M2-like timeout for tool fetches
      });
      if (!response.ok) throw new Error(`Failed to fetch ${url} (status: ${response.status})`);

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Invalid content-type: ${contentType}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const rawExt = url.split('.').pop()?.split(/[#?]/)[0] || 'jpg';
      const ext = (rawExt.length > 5 || rawExt.includes('/')) ? 'jpg' : rawExt;
      const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(filepath, buffer);
      finalUrls.push(`/uploads/${filename}`);
    } catch (e: any) {
      const err = `Error downloading image ${url}: ${e.message}`;
      console.error(err);
      errors.push(err);
      finalUrls.push(url);
    }
  }
  return { urls: finalUrls, errors };
}

function parseProduct(row: ProductRow, baseUrl: string) {
  // M9: Safely handle JSON.parse for images and tags
  const safeParse = (str: string | null) => {
    if (!str) return [];
    try {
      return JSON.parse(str) as string[];
    } catch {
      console.error(`Failed to parse JSON column: ${str}`);
      return [];
    }
  };

  const images = safeParse(row.images);
  
  const absoluteImages = images.map(img => {
    if (img.startsWith('/uploads/') && baseUrl) {
      return `${baseUrl}${img}`;
    }
    return img;
  });

  return {
    ...row,
    active: Boolean(row.active),
    tags: safeParse(row.tags),
    images: absoluteImages,
    availability: row.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
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

      const baseUrlRow = db.prepare("SELECT value FROM settings WHERE key = 'base_url'").get() as { value: string } | undefined;
      const baseUrl = baseUrlRow?.value?.replace(/\/$/, '') ?? '';

      const rows = db.prepare(sql).all(...params) as ProductRow[];
      const products = rows.map(r => parseProduct(r, baseUrl));

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

      const baseUrlRow = db.prepare("SELECT value FROM settings WHERE key = 'base_url'").get() as { value: string } | undefined;
      const baseUrl = baseUrlRow?.value?.replace(/\/$/, '') ?? '';

      return {
        content: [{ type: 'text', text: JSON.stringify(parseProduct(row, baseUrl), null, 2) }],
      };
    },
  );

  // ─── add_product ─────────────────────────────────────────────────────────
  server.tool(
    'add_product',
    'Add a new product to the catalog. By default returns a preview — set confirm=true to save.',
    {
      title: z.string().min(1).describe('Product title'),
      description: z.string().optional().describe('Product description'),
      sku: z.string().optional().describe('Stock-keeping unit (unique identifier)'),
      category: z.string().optional().describe('Category name — will be created if it does not exist'),
      price: z.number().min(0).optional().describe('Price in local currency'),
      stock_quantity: z.number().int().min(0).default(0).describe('Initial stock level'),
      tags: z.array(z.string()).optional().describe('Tags for search and filtering'),
      images: z.array(z.string()).optional().describe('Image URLs'),
      confirm: z.boolean().default(false).describe('Set to true to actually save. When false (default), returns a preview for review.'),
    },
    async ({ title, description, sku, category, price, stock_quantity, tags, images, confirm }) => {
      // ── Preview mode ──
      if (!confirm) {
        const preview = {
          title,
          sku: sku ?? null,
          description: description ?? null,
          category: category ?? null,
          price: price ?? null,
          stock_quantity,
          tags: tags ?? [],
          images: images ?? [],
          active: true,
        };
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nThis product will be created:\n${JSON.stringify(preview, null, 2)}\n\nCall add_product again with confirm=true to save it.`,
          }],
        };
      }

      // ── Execute ──
      let categoryId: number | null = null;
      if (category) {
        const existing = db
          .prepare(`SELECT id FROM categories WHERE name = ?`)
          .get(category) as { id: number } | undefined;
        categoryId = existing
          ? existing.id
          : (db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(category).lastInsertRowid as number);
      }

      let finalImages = images;
      let downloadErrors: string[] = [];
      if (images && images.length > 0) {
        const result = await downloadAndCacheImages(images);
        finalImages = result.urls;
        downloadErrors = result.errors;
      }

      const result = db
        .prepare(
          `INSERT INTO products (title, description, sku, category_id, price, stock_quantity, tags, images)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          title,
          description ?? null,
          sku ?? null,
          categoryId,
          price ?? null,
          stock_quantity,
          tags ? JSON.stringify(tags) : null,
          finalImages ? JSON.stringify(finalImages) : null,
        );

      const newId = result.lastInsertRowid as number;
      const errorNote = downloadErrors.length > 0 
        ? `\n\n⚠️ Note: Some images could not be downloaded and were kept as external links:\n${downloadErrors.map(e => `• ${e}`).join('\n')}`
        : '';

      return {
        content: [{
          type: 'text',
          text: `✅ Product "${title}" saved successfully with ID ${newId}.${errorNote}`,
        }],
      };
    },
  );

  // ─── update_product ───────────────────────────────────────────────────────
  server.tool(
    'update_product',
    'Update one or more fields of an existing product by ID. By default returns a preview — set confirm=true to save.',
    {
      id: z.number().int().describe('ID of the product to update'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      sku: z.string().optional().describe('New SKU'),
      category: z.string().optional().describe('New category name'),
      price: z.number().min(0).optional().describe('New price'),
      stock_quantity: z.number().int().min(0).optional().describe('New stock level'),
      tags: z.array(z.string()).optional().describe('Replacement tag list'),
      images: z.array(z.string()).optional().describe('Replacement image URLs'),
      active: z.boolean().optional().describe('Set to false to delist the product'),
      confirm: z.boolean().default(false).describe('Set to true to actually save. When false (default), returns a preview for review.'),
    },
    async ({ id, title, description, sku, category, price, stock_quantity, tags, images, active, confirm }) => {
      const existing = db
        .prepare(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`)
        .get(id) as (ProductRow & { category_name?: string }) | undefined;

      if (!existing) {
        return {
          content: [{ type: 'text', text: `Product with ID ${id} not found.` }],
          isError: true,
        };
      }

      // Build a plain-english summary of changes for review
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (title !== undefined && title !== existing.title) changes.title = { from: existing.title, to: title };
      if (description !== undefined && description !== existing.description) changes.description = { from: existing.description, to: description };
      if (sku !== undefined && sku !== existing.sku) changes.sku = { from: existing.sku, to: sku };
      if (price !== undefined && price !== existing.price) changes.price = { from: existing.price, to: price };
      if (stock_quantity !== undefined && stock_quantity !== existing.stock_quantity) changes.stock_quantity = { from: existing.stock_quantity, to: stock_quantity };
      if (tags !== undefined) changes.tags = { from: existing.tags ? JSON.parse(existing.tags) : [], to: tags };
      if (images !== undefined) changes.images = { from: existing.images ? JSON.parse(existing.images) : [], to: images };
      if (active !== undefined && active !== Boolean(existing.active)) changes.active = { from: Boolean(existing.active), to: active };
      if (category !== undefined && category !== existing.category_name) changes.category = { from: existing.category_name ?? null, to: category };

      // ── Preview mode ──
      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nProduct ID ${id} ("${existing.title}") will be updated:\n${JSON.stringify(changes, null, 2)}\n\nCall update_product again with confirm=true to save.`,
          }],
        };
      }

      // ── Execute ──
      const updates: string[] = [`updated_at = datetime('now')`];
      const params: (string | number | null)[] = [];

      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (sku !== undefined) { updates.push('sku = ?'); params.push(sku); }
      if (price !== undefined) { updates.push('price = ?'); params.push(price); }
      if (stock_quantity !== undefined) { updates.push('stock_quantity = ?'); params.push(stock_quantity); }
      if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
      let downloadErrors: string[] = [];
      if (images !== undefined) {
        const result = await downloadAndCacheImages(images);
        const finalImages = result.urls;
        downloadErrors = result.errors;
        updates.push('images = ?'); 
        params.push(JSON.stringify(finalImages));
      }
      if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

      if (category !== undefined) {
        let catId: number | null = null;
        if (category) {
          const cat = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(category) as { id: number } | undefined;
          catId = cat
            ? cat.id
            : (db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(category).lastInsertRowid as number);
        }
        updates.push('category_id = ?');
        params.push(catId);
      }

      params.push(id);
      db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const errorNote = downloadErrors.length > 0 
        ? `\n\n⚠️ Note: Some images could not be downloaded and were kept as external links:\n${downloadErrors.map(e => `• ${e}`).join('\n')}`
        : '';

      return {
        content: [{ type: 'text', text: `✅ Product ID ${id} updated successfully.${errorNote}` }],
      };
    },
  );

  // ─── update_inventory ────────────────────────────────────────────────────
  server.tool(
    'update_inventory',
    'Update the stock quantity for a specific product by ID or SKU. Returns a preview by default — set confirm=true to save.',
    {
      id: z.number().int().optional().describe('Product ID'),
      sku: z.string().optional().describe('Product SKU'),
      quantity: z.number().int().describe('The new total stock quantity'),
      confirm: z.boolean().default(false).describe('Set to true to actually save. When false (default), returns a preview for review.'),
    },
    async ({ id, sku, quantity, confirm }) => {
      if (!id && !sku) {
        return {
          content: [{ type: 'text', text: 'Error: provide either id or sku.' }],
          isError: true,
        };
      }

      const sql = `
        SELECT p.*
        FROM products p
        WHERE ${id ? 'p.id = ?' : 'p.sku = ?'}
      `;
      const existing = db.prepare(sql).get(id ?? sku) as ProductRow | undefined;

      if (!existing) {
        return {
          content: [{ type: 'text', text: `Product not found.` }],
          isError: true,
        };
      }

      if (quantity < 0) {
        return {
          content: [{ type: 'text', text: 'Error: quantity cannot be less than 0.' }],
          isError: true,
        };
      }

      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nProduct ID ${existing.id} ("${existing.title}") stock quantity will be updated from ${existing.stock_quantity} to ${quantity}.\n\nCall update_inventory again with confirm=true to save.`,
          }],
        };
      }

      db.prepare(`UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`).run(quantity, existing.id);

      return {
        content: [{ type: 'text', text: `✅ Inventory for Product ID ${existing.id} updated successfully to ${quantity}.` }],
      };
    },
  );

  // ─── import_products ─────────────────────────────────────────────────────
  server.tool(
    'import_products',
    'Bulk import or update products from a local Excel (.xlsx) or CSV file path. Expects headers like title, description, sku, category, price, stock_quantity, tags (comma-separated), images (comma-separated). Uses sku as distinct identifier to update. Returns a preview by default — set confirm=true to save.',
    {
      file_path: z.string().describe('Absolute path to the Excel or CSV file'),
      confirm: z.boolean().default(false).describe('Set to true to actually save. When false (default), returns a preview for review.'),
    },
    async ({ file_path, confirm }) => {
      // ── Security: validate path before touching the filesystem ─────────────
      const resolvedPath = path.resolve(file_path);

      // Only allow .xlsx or .csv files
      const ext = path.extname(resolvedPath).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.csv') {
        return {
          content: [{ type: 'text', text: `Error: file must be an .xlsx or .csv file (got "${ext || 'no extension'}").` }],
          isError: true,
        };
      }

      // Block path traversal — the resolved path must not escape to sensitive dirs
      const allowedDirs = ['/home', '/tmp', '/var/tmp', process.cwd()];
      const pathIsSafe = allowedDirs.some(dir => resolvedPath.startsWith(dir + path.sep) || resolvedPath.startsWith(dir));
      if (!pathIsSafe) {
        return {
          content: [{ type: 'text', text: `Error: file path is outside allowed directories. Please place your file in a home or temp directory.` }],
          isError: true,
        };
      }

      if (!fs.existsSync(resolvedPath)) {
        return {
          content: [{ type: 'text', text: `Error: file not found at path "${resolvedPath}".` }],
          isError: true,
        };
      }

      let workbook;
      try {
        workbook = xlsx.readFile(resolvedPath);
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Error reading file: ${e.message}` }],
          isError: true,
        };
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // Convert to array of objects
      const data = xlsx.utils.sheet_to_json<any>(worksheet);

      if (!data || data.length === 0) {
        return {
          content: [{ type: 'text', text: 'Error: File is empty or could not be parsed as tabular data.' }],
        };
      }

      let newCount = 0;
      let updateCount = 0;
      let errors: string[] = [];

      // Validate and collect updates/inserts
      const inserts: any[] = [];
      const updates: any[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const title = row.title;
        const sku = row.sku ? String(row.sku) : undefined;
        let price = parseFloat(row.price);
        price = isNaN(price) ? 0 : price;
        let stock_quantity = parseInt(row.stock_quantity, 10);
        stock_quantity = isNaN(stock_quantity) ? 0 : stock_quantity;

        if (!title) {
          errors.push(`Row ${i + 2}: Missing required 'title'`);
          continue;
        }

        const tags = typeof row.tags === 'string' ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        let images = typeof row.images === 'string' ? row.images.split(',').map((u: string) => u.trim()).filter(Boolean) : [];
        if (images.length > 0) {
          images = await downloadAndCacheImages(images);
        }

        // Check if SKU exists to determine if it's an update
        let existing;
        if (sku) {
          existing = db.prepare(`SELECT id FROM products WHERE sku = ?`).get(sku) as { id: number } | undefined;
        }

        // Just push to arrays
        if (existing) {
          updates.push({ id: existing.id, row: { ...row, tags, images, price, stock_quantity, sku } });
        } else {
          inserts.push({ row: { ...row, tags, images, price, stock_quantity, sku } });
        }
      }

      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nFile parsed successfully with ${data.length} rows.\n- ${inserts.length} new products will be created.\n- ${updates.length} existing products will be updated based on SKU match.\n- ${errors.length} errors found.\n\nErrors:\n${errors.join('\\n')}\n\nCall import_products again with confirm=true to save.`,
          }],
        };
      }

      // Execute inside a transaction
      const transaction = db.transaction(() => {
        // Handle Inserts
        const insertStmt = db.prepare(
          `INSERT INTO products (title, description, sku, category_id, price, stock_quantity, tags, images)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const { row } of inserts) {
          let categoryId: number | null = null;
          if (row.category) {
            const cat = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(row.category) as { id: number } | undefined;
            categoryId = cat
              ? cat.id
              : (db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(row.category).lastInsertRowid as number);
          }
          insertStmt.run(
            row.title,
            row.description ?? null,
            row.sku ?? null,
            categoryId,
            row.price,
            row.stock_quantity,
            row.tags.length ? JSON.stringify(row.tags) : null,
            row.images.length ? JSON.stringify(row.images) : null
          );
          newCount++;
        }

        // Handle Updates
        for (const { id, row } of updates) {
          const updateParts: string[] = [`updated_at = datetime('now')`];
          const updateParams: any[] = [];

          updateParts.push('title = ?'); updateParams.push(row.title);
          if (row.description !== undefined) { updateParts.push('description = ?'); updateParams.push(row.description); }
          updateParts.push('price = ?'); updateParams.push(row.price);
          updateParts.push('stock_quantity = ?'); updateParams.push(row.stock_quantity);
          updateParts.push('tags = ?'); updateParams.push(row.tags.length ? JSON.stringify(row.tags) : null);
          updateParts.push('images = ?'); updateParams.push(row.images.length ? JSON.stringify(row.images) : null);
          if (row.active !== undefined) {
            const activeVal = (String(row.active).toLowerCase() === 'false' || row.active === 0) ? 0 : 1;
            updateParts.push('active = ?'); updateParams.push(activeVal);
          }

          if (row.category !== undefined) {
            let catId: number | null = null;
            if (row.category) {
              const cat = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(row.category) as { id: number } | undefined;
              catId = cat
                ? cat.id
                : (db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(row.category).lastInsertRowid as number);
            }
            updateParts.push('category_id = ?');
            updateParams.push(catId);
          }

          updateParams.push(id);
          const updateQuery = `UPDATE products SET ${updateParts.join(', ')} WHERE id = ?`;
          db.prepare(updateQuery).run(...updateParams);
          updateCount++;
        }
      });

      try {
        transaction();
        return {
          content: [{
            type: 'text',
            text: `Bulk import successful.\n- ${newCount} products created.\n- ${updateCount} products updated.\n\nErrors encountered during parse:\n${errors.join('\\n')}`,
          }],
        };
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Error during bulk import transaction: ${e.message}` }],
          isError: true,
        };
      }
    },
  );
}
