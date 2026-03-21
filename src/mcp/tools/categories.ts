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

  // ─── batch_add_categories ────────────────────────────────────────────────
  server.tool(
    'batch_add_categories',
    'Create multiple product categories at once. Supports hierarchy by parent_name.',
    {
      categories: z.array(z.object({
        name: z.string().min(1).describe('Category name'),
        parent_name: z.string().optional().describe('Name of the parent category'),
      })).describe('List of categories to create'),
      confirm: z.boolean().default(false).describe('Set to true to actually save'),
    },
    async ({ categories, confirm }) => {
      const results: string[] = [];
      const createdIds = new Map<string, number>();

      // Pre-populate createdIds with existing categories
      const allExisting = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
      allExisting.forEach(c => createdIds.set(c.name, c.id));

      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 BATCH PREVIEW\n\nThe following categories will be processed:\n${JSON.stringify(categories, null, 2)}\n\nCall with confirm=true to apply.`,
          }],
        };
      }

      // We need to resolve parents. A simple way is to iterate until no more can be added or we get stuck.
      let remaining = [...categories];
      let changed = true;
      while (remaining.length > 0 && changed) {
        changed = false;
        const nextBatch: typeof categories = [];
        for (const cat of remaining) {
          if (createdIds.has(cat.name)) {
            results.push(`Skipped "${cat.name}" (already exists)`);
            continue;
          }

          let parent_id: number | null = null;
          if (cat.parent_name) {
            if (createdIds.has(cat.parent_name)) {
              parent_id = createdIds.get(cat.parent_name)!;
            } else {
              // Parent not created yet in this loop, try next iteration
              nextBatch.push(cat);
              continue;
            }
          }

          try {
            const res = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(cat.name, parent_id);
            createdIds.set(cat.name, Number(res.lastInsertRowid));
            results.push(`Created "${cat.name}"${cat.parent_name ? ` (parent: ${cat.parent_name})` : ''}`);
            changed = true;
          } catch (e) {
            results.push(`Error creating "${cat.name}": ${(e as Error).message}`);
          }
        }
        remaining = nextBatch;
      }

      if (remaining.length > 0) {
        results.push(`Could not create ${remaining.length} categories due to missing parents: ${remaining.map(r => r.name).join(', ')}`);
      }

      return {
        content: [{ type: 'text', text: results.join('\n') }],
      };
    },
  );

  // ─── update_category ─────────────────────────────────────────────────────
  server.tool(
    'update_category',
    'Update an existing category name or parent_id.',
    {
      id: z.number().int().describe('Category ID to update'),
      name: z.string().min(1).optional().describe('New category name'),
      parent_id: z.number().int().nullable().optional().describe('New parent category ID (null for top-level)'),
      confirm: z.boolean().default(false).describe('Set to true to actually save'),
    },
    async ({ id, name, parent_id, confirm }) => {
      const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
      if (!existing) {
        return { content: [{ type: 'text', text: `Category ID ${id} not found.` }], isError: true };
      }

      const updates: string[] = [];
      const values: any[] = [];
      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (parent_id !== undefined) {
        updates.push('parent_id = ?');
        values.push(parent_id);
      }

      if (!updates.length) {
        return { content: [{ type: 'text', text: 'No changes provided.' }] };
      }

      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 PREVIEW — no changes saved yet\n\nTarget: "${existing.name}" (ID: ${id})\nChanges: ${JSON.stringify({ name, parent_id }, null, 2)}\n\nCall again with confirm=true to apply.`,
          }],
        };
      }

      try {
        values.push(id);
        db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        return { content: [{ type: 'text', text: `✅ Category ID ${id} updated successfully.` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${(e as Error).message}` }], isError: true };
      }
    },
  );

  // ─── batch_update_categories ─────────────────────────────────────────────
  server.tool(
    'batch_update_categories',
    'Update multiple categories at once. Useful for reorganizing the catalog.',
    {
      updates: z.array(z.object({
        id: z.number().int().describe('Category ID'),
        name: z.string().min(1).optional().describe('New name'),
        parent_id: z.number().int().nullable().optional().describe('New parent ID'),
      })).describe('List of category updates'),
      confirm: z.boolean().default(false).describe('Set to true to apply changes'),
    },
    async ({ updates, confirm }) => {
      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `📋 BATCH UPDATE PREVIEW\n\nThe following updates will be applied:\n${JSON.stringify(updates, null, 2)}\n\nCall with confirm=true to apply.`,
          }],
        };
      }

      const results: string[] = [];
      const stmt = db.prepare('UPDATE categories SET name = COALESCE(?, name), parent_id = ? WHERE id = ?');
      
      for (const update of updates) {
        try {
          // Note: better-sqlite3 COALESCE(?, name) works well for optional name
          // But parent_id can be null explicitly
          const current = db.prepare('SELECT name, parent_id FROM categories WHERE id = ?').get(update.id) as any;
          if (!current) {
            results.push(`ID ${update.id}: Not found`);
            continue;
          }

          const finalName = update.name ?? current.name;
          const finalParent = (update.parent_id !== undefined) ? update.parent_id : current.parent_id;
          
          db.prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?')
            .run(finalName, finalParent, update.id);
          results.push(`ID ${update.id}: Updated`);
        } catch (e) {
          results.push(`ID ${update.id}: Error — ${(e as Error).message}`);
        }
      }

      return { content: [{ type: 'text', text: results.join('\n') }] };
    },
  );
}
