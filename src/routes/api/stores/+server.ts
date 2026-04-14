import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { randomBytes } from 'crypto';

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
export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const db = getDb();
  
  // Global admins see all stores
  if (user.role === 'super_admin' || user.role === 'admin') {
    const stores = db.prepare('SELECT * FROM stores ORDER BY name ASC').all();
    return json(stores);
  }

  // Others only see stores they are mapped to
  const stores = db.prepare(`
    SELECT s.* 
    FROM stores s
    JOIN user_stores us ON us.store_slug = s.slug
    WHERE us.user_id = ? 
    ORDER BY s.name ASC
  `).all(user.sub);
  
  return json(stores);
}

/** POST /api/stores — create a new store */
export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const body = await event.request.json().catch(() => null);
  if (!body?.slug || !body?.name) {
    return json({ error: 'slug and name are required' }, { status: 400 });
  }

  const db = getDb();
  const slug = String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    const gatewayKey = body.gateway_key || randomBytes(32).toString('hex');

    // UX-AUTO: If seller_public_url is not set in registry, and we have an mcp_server_url, set it now.
    if (body.mcp_server_url) {
      const existingUrl = db.prepare("SELECT value FROM settings WHERE key = 'seller_public_url'").get() as { value: string } | undefined;
      if (!existingUrl || !existingUrl.value || existingUrl.value === 'http://localhost:3000') {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('seller_public_url', ?)").run(body.mcp_server_url);
      }
    }

    const result = db
      .prepare(`
        INSERT INTO stores (slug, name, description, gateway_key, active)
        VALUES (?, ?, ?, ?, 1)
      `)
      .run(slug, body.name, body.description ?? null, gatewayKey);

    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(result.lastInsertRowid);
    return json(store, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return json({ error: `Slug "${slug}" is already taken` }, { status: 409 });
    }
    throw err;
  }
}
