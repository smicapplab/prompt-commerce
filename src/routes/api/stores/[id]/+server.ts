import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

/** PATCH /api/stores/:id — update store */
export async function PATCH(event: RequestEvent) {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const id = Number(event.params.id);
  const body = await event.request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid body' }, { status: 400 });

  const db = getDb();
  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(id);
  if (!store) return json({ error: 'Store not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined)        { fields.push('name = ?');        values.push(body.name); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.gateway_key !== undefined) { fields.push('gateway_key = ?'); values.push(body.gateway_key); }
  if (body.active !== undefined)      { fields.push('active = ?');      values.push(body.active ? 1 : 0); }
  if (body.slug !== undefined) {
    const slug = String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    fields.push('slug = ?');
    values.push(slug);
  }

  if (!fields.length) return json({ error: 'No fields to update' }, { status: 400 });

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  db.prepare(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  return json(updated);
}

/** DELETE /api/stores/:id — delete store (cascades to all catalog data) */
export async function DELETE(event: RequestEvent) {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const id = Number(event.params.id);
  const db = getDb();
  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(id);
  if (!store) return json({ error: 'Store not found' }, { status: 404 });

  db.prepare('DELETE FROM stores WHERE id = ?').run(id);
  return new Response(null, { status: 204 });
}
