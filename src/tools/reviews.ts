import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Review } from '../types/index.js';

export function registerReviewTools(
  server: McpServer,
  db: Database.Database,
): void {
  // ─── get_reviews ─────────────────────────────────────────────────────────
  server.tool(
    'get_reviews',
    'Fetch customer reviews for a product. Returns average rating and review list.',
    {
      product_id: z.number().int().describe('Product ID to fetch reviews for'),
      limit: z.number().int().min(1).max(50).default(10).describe('Maximum reviews to return'),
    },
    async ({ product_id, limit }) => {
      const product = db
        .prepare(`SELECT id, title FROM products WHERE id = ?`)
        .get(product_id) as { id: number; title: string } | undefined;

      if (!product) {
        return {
          content: [{ type: 'text', text: `Product ID ${product_id} not found.` }],
          isError: true,
        };
      }

      const reviews = db
        .prepare(
          `SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(product_id, limit) as Review[];

      const stats = db
        .prepare(
          `SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE product_id = ?`,
        )
        .get(product_id) as { count: number; avg_rating: number | null };

      const output = {
        product: { id: product.id, title: product.title },
        summary: {
          total_reviews: stats.count,
          average_rating: stats.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null,
        },
        reviews,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    },
  );

  // ─── add_review ──────────────────────────────────────────────────────────
  server.tool(
    'add_review',
    'Submit a customer review for a product.',
    {
      product_id: z.number().int().describe('Product ID being reviewed'),
      rating: z.number().int().min(1).max(5).describe('Star rating from 1 (poor) to 5 (excellent)'),
      customer_name: z.string().optional().describe('Name of the customer (anonymous if omitted)'),
      comment: z.string().optional().describe('Written review comment'),
    },
    async ({ product_id, rating, customer_name, comment }) => {
      const product = db
        .prepare(`SELECT id FROM products WHERE id = ?`)
        .get(product_id) as { id: number } | undefined;

      if (!product) {
        return {
          content: [{ type: 'text', text: `Product ID ${product_id} not found.` }],
          isError: true,
        };
      }

      const result = db
        .prepare(
          `INSERT INTO reviews (product_id, rating, customer_name, comment) VALUES (?, ?, ?, ?)`,
        )
        .run(product_id, rating, customer_name ?? null, comment ?? null);

      return {
        content: [
          {
            type: 'text',
            text: `Review submitted (ID: ${result.lastInsertRowid}). Rating: ${rating}/5`,
          },
        ],
      };
    },
  );
}
