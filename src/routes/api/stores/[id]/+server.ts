import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const PATCH: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = Number(event.params.id);
  const body = await event.request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid body' }, { status: 400 });

  const db = getDb();
  const store = db.prepare('SELECT id, slug FROM stores WHERE id = ?').get(id) as { id: number, slug: string } | undefined;
  if (!store) return json({ error: 'Store not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined)        { fields.push('name = ?');        values.push(body.name); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.gateway_key !== undefined) { 
    if (body.gateway_key === '' || body.gateway_key === null) {
      return json({ error: 'gateway_key cannot be empty' }, { status: 400 });
    }
    fields.push('gateway_key = ?'); 
    values.push(body.gateway_key); 
  }
  if (body.active !== undefined)      { fields.push('active = ?');      values.push(body.active ? 1 : 0); }
  
  if (body.slug !== undefined) {
    const newSlug = String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (newSlug !== store.slug) {
      return json({ error: 'Store slug cannot be changed after creation to prevent data loss.' }, { status: 400 });
    }
  }

  if (!fields.length) return json({ error: 'No fields to update' }, { status: 400 });

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  db.prepare(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  return json(updated);
};

export const DELETE: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = Number(event.params.id);
  const db = getDb();
  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(id);
  if (!store) return json({ error: 'Store not found' }, { status: 404 });

  db.prepare('DELETE FROM stores WHERE id = ?').run(id);
  return new Response(null, { status: 204 });
};
