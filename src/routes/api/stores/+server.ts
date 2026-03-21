import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export interface Store {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  gateway_key: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

/** GET /api/stores — list all stores */
export async function GET(event: RequestEvent) {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const db = getDb();
  const stores = db.prepare('SELECT * FROM stores ORDER BY name ASC').all();
  return json(stores);
}

/** POST /api/stores — create a new store */
export async function POST(event: RequestEvent) {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const body = await event.request.json().catch(() => null);
  if (!body?.slug || !body?.name) {
    return json({ error: 'slug and name are required' }, { status: 400 });
  }

  const db = getDb();
  const slug = String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    const result = db
      .prepare(`
        INSERT INTO stores (slug, name, description, gateway_key, active)
        VALUES (?, ?, ?, ?, 1)
      `)
      .run(slug, body.name, body.description ?? null, body.gateway_key ?? null);

    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(result.lastInsertRowid);
    return json(store, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return json({ error: `Slug "${slug}" is already taken` }, { status: 409 });
    }
    throw err;
  }
}
