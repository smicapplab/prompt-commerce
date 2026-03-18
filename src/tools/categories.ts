import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Category } from '../types/index.js';

export function registerCategoryTools(
  server: McpServer,
  db: Database.Database,
): void {
  // ─── list_categories ──────────────────────────────────────────────────────
  server.tool(
    'list_categories',
    'List all product categories, optionally filtered by parent category.',
    {
      parent_id: z.number().int().optional().describe('Filter to children of this category ID'),
    },
    async ({ parent_id }) => {
      const rows = parent_id !== undefined
        ? (db.prepare(`SELECT * FROM categories WHERE parent_id = ? ORDER BY name`).all(parent_id) as Category[])
        : (db.prepare(`SELECT * FROM categories ORDER BY name`).all() as Category[]);

      if (!rows.length) {
        return { content: [{ type: 'text', text: 'No categories found.' }] };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
      };
    },
  );

  // ─── add_category ────────────────────────────────────────────────────────
  server.tool(
    'add_category',
    'Create a new product category. By default returns a preview — set confirm=true to save.',
    {
      name: z.string().min(1).describe('Category name (must be unique)'),
      parent_id: z.number().int().optional().describe('Parent category ID for sub-categories'),
      confirm: z.boolean().default(false).describe('Set to true to actually save. When false (default), returns a preview for review.'),
    },
    async ({ name, parent_id, confirm }) => {
      const existing = db
        .prepare(`SELECT id FROM categories WHERE name = ?`)
        .get(name) as { id: number } | undefined;

      if (existing) {
        return {
          content: [{ type: 'text', text: `Category "${name}" already exists (ID: ${existing.id}).` }],
        };
      }

      let parentName: string | null = null;
      if (parent_id !== undefined) {
        const parent = db
          .prepare(`SELECT id, name FROM categories WHERE id = ?`)
          .get(parent_id) as { id: number; name: string } | undefined;

        if (!parent) {
          return {
            content: [{ type: 'text', text: `Parent category ID ${parent_id} not found.` }],
            isError: true,
          };
        }
        parentName = parent.name;
      }

      // ── Preview mode ──
      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nThis category will be created:\n${JSON.stringify({ name, parent: parentName ?? 'none (top-level)' }, null, 2)}\n\nCall add_category again with confirm=true to save it.`,
          }],
        };
      }

      // ── Execute ──
      const result = db
        .prepare(`INSERT INTO categories (name, parent_id) VALUES (?, ?)`)
        .run(name, parent_id ?? null);

      return {
        content: [{
          type: 'text',
          text: `✅ Category "${name}" created with ID ${result.lastInsertRowid}.`,
        }],
      };
    },
  );
}
