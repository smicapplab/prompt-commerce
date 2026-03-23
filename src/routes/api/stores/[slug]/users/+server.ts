import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole, hashPassword } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const { slug } = event.params;
  const auth = await requireStoreRole(event, slug, ['admin', 'store_admin']);
  if (auth instanceof Response) return auth;

  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, us.role, u.created_at
    FROM users u
    JOIN user_stores us ON us.user_id = u.id
    WHERE us.store_slug = ?
    ORDER BY u.username ASC
  `).all(slug);

  return json(users);
};

export const POST: RequestHandler = async (event) => {
  const { slug } = event.params;
  // Store Admin can add/create users for their store
  const auth = await requireStoreRole(event, slug, ['admin', 'store_admin']);
  if (auth instanceof Response) return auth;

  const body = await event.request.json().catch(() => null);
  if (!body?.username || !body?.role) {
    return json({ error: 'username and role are required' }, { status: 400 });
  }

  if (!['store_admin', 'merchandising', 'ops'].includes(body.role)) {
    return json({ error: 'Invalid store role' }, { status: 400 });
  }

  const db = getDb();
  let userId: number;

  try {
    // If password provided, create new user. Otherwise, find existing user by username.
    if (body.password) {
      const passwordHash = hashPassword(body.password);
      const result = db
        .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
        .run(body.username, passwordHash, 'user');
      userId = result.lastInsertRowid as number;
    } else {
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get(body.username) as { id: number } | undefined;
      if (!user) return json({ error: 'User does not exist. Provide a password to create a new user.' }, { status: 404 });
      userId = user.id;
    }

    // Assign to store
    db.prepare('INSERT OR REPLACE INTO user_stores (user_id, store_slug, role) VALUES (?, ?, ?)')
      .run(userId, slug, body.role);

    return json({ id: userId, username: body.username, role: body.role }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      // If username exists but we tried to insert, it's fine if we just want to link them
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get(body.username) as { id: number } | undefined;
      if (user) {
        db.prepare('INSERT OR REPLACE INTO user_stores (user_id, store_slug, role) VALUES (?, ?, ?)')
          .run(user.id, slug, body.role);
        return json({ id: user.id, username: body.username, role: body.role }, { status: 201 });
      }
    }
    throw err;
  }
};
