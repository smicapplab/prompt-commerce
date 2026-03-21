import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Promotion } from '../types/index.js';

interface PromotionRow {
  id: number;
  title: string;
  product_id: number | null;
  voucher_code: string | null;
  discount_type: string;
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  active: number;
  created_at: string;
}

function parsePromotion(row: PromotionRow): Promotion {
  return {
    ...row,
    discount_type: row.discount_type as 'percentage' | 'fixed',
    active: Boolean(row.active),
  };
}

export function registerPromotionTools(
  server: McpServer,
  db: Database.Database,
): void {
  // ─── get_promotions ───────────────────────────────────────────────────────
  server.tool(
    'get_promotions',
    'List active promotions and vouchers. Optionally filter by product or voucher code.',
    {
      product_id: z.number().int().optional().describe('Filter promotions for a specific product ID'),
      voucher_code: z.string().optional().describe('Look up a specific voucher code'),
      include_expired: z.boolean().default(false).describe('Include expired promotions'),
    },
    async ({ product_id, voucher_code, include_expired }) => {
      let sql = `SELECT * FROM promotions WHERE 1=1`;
      const params: (string | number)[] = [];

      if (!include_expired) {
        sql += ` AND active = 1 AND (end_date IS NULL OR end_date >= date('now'))`;
      }
      if (product_id !== undefined) {
        sql += ` AND (product_id = ? OR product_id IS NULL)`;
        params.push(product_id);
      }
      if (voucher_code) {
        sql += ` AND voucher_code = ?`;
        params.push(voucher_code);
      }
      sql += ` ORDER BY created_at DESC`;

      const rows = db.prepare(sql).all(...params) as PromotionRow[];
      const promotions = rows.map(parsePromotion);

      return {
        content: [
          {
            type: 'text',
            text: promotions.length
              ? JSON.stringify(promotions, null, 2)
              : 'No promotions found.',
          },
        ],
      };
    },
  );

  // ─── add_promotion ───────────────────────────────────────────────────────
  server.tool(
    'add_promotion',
    'Create a new promotion or voucher code. By default returns a preview — set confirm=true to save.',
    {
      title: z.string().min(1).describe('Promotion name/title'),
      discount_type: z
        .enum(['percentage', 'fixed'])
        .describe('"percentage" (e.g. 10 = 10% off) or "fixed" (e.g. 50 = ₱50 off)'),
      discount_value: z.number().min(0).describe('Discount amount'),
      product_id: z.number().int().optional().describe('Apply only to this product ID (omit for store-wide)'),
      voucher_code: z.string().optional().describe('Unique voucher code customers can enter'),
      start_date: z.string().optional().describe('ISO date when the promotion starts (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('ISO date when the promotion ends (YYYY-MM-DD)'),
      confirm: z.boolean().default(false).describe('Set to true to actually save. When false (default), returns a preview for review.'),
    },
    async ({ title, discount_type, discount_value, product_id, voucher_code, start_date, end_date, confirm }) => {
      if (voucher_code) {
        const existing = db
          .prepare(`SELECT id FROM promotions WHERE voucher_code = ?`)
          .get(voucher_code) as { id: number } | undefined;

        if (existing) {
          return {
            content: [{ type: 'text', text: `Voucher code "${voucher_code}" already exists.` }],
            isError: true,
          };
        }
      }

      // Resolve product title for preview if product_id given
      let productTitle: string | null = null;
      if (product_id !== undefined) {
        const prod = db.prepare(`SELECT title FROM products WHERE id = ?`).get(product_id) as { title: string } | undefined;
        if (!prod) {
          return {
            content: [{ type: 'text', text: `Product ID ${product_id} not found.` }],
            isError: true,
          };
        }
        productTitle = prod.title;
      }

      // ── Preview mode ──
      if (!confirm) {
        const preview = {
          title,
          discount: discount_type === 'percentage' ? `${discount_value}% off` : `₱${discount_value} off`,
          applies_to: productTitle ? `${productTitle} (ID ${product_id})` : 'entire store',
          voucher_code: voucher_code ?? null,
          active_from: start_date ?? 'immediately',
          active_until: end_date ?? 'no expiry',
        };
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nThis promotion will be created:\n${JSON.stringify(preview, null, 2)}\n\nCall add_promotion again with confirm=true to save it.`,
          }],
        };
      }

      // ── Execute ──
      const result = db
        .prepare(
          `INSERT INTO promotions (title, product_id, voucher_code, discount_type, discount_value, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          title,
          product_id ?? null,
          voucher_code ?? null,
          discount_type,
          discount_value,
          start_date ?? null,
          end_date ?? null,
        );

      return {
        content: [{
          type: 'text',
          text: `✅ Promotion "${title}" saved with ID ${result.lastInsertRowid}.${voucher_code ? ` Voucher code: ${voucher_code}` : ''}`,
        }],
      };
    },
  );
}
