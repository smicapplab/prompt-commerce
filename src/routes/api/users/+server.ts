import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, hashPassword } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  // Select users, but mask password hashes
  const rows = db.prepare('SELECT id, username, first_name, last_name, email, mobile, role, created_at FROM users ORDER BY username ASC').all();
  
  // For each user, also fetch their store assignments
  const users = rows.map((u: any) => {
    const stores = db.prepare('SELECT store_slug, role FROM user_stores WHERE user_id = ?').all(u.id);
    return { ...u, stores };
  });

  return json(users);
};

export const POST: RequestHandler = async (event) => {
  const admin = requireAuth(event);
  if (admin instanceof Response) return admin;

  if (admin.role !== 'super_admin' && admin.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await event.request.json().catch(() => null);
  if (!body?.username || !body?.password || !body?.role || !body?.first_name || !body?.last_name || !body?.email) {
    return json({ error: 'username, password, role, first name, last name, and email are required' }, { status: 400 });
  }

  // Only super_admin can create another super_admin
  if (body.role === 'super_admin' && admin.role !== 'super_admin') {
    return json({ error: 'Only Super Admins can create other Super Admins' }, { status: 403 });
  }

  const db = getDb();
  const passwordHash = hashPassword(body.password);

  try {
    const result = db
      .prepare('INSERT INTO users (username, password_hash, role, first_name, last_name, email, mobile) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(body.username, passwordHash, body.role, body.first_name, body.last_name, body.email, body.mobile || null);

    return json({ id: result.lastInsertRowid, username: body.username, role: body.role }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return json({ error: 'Username already exists' }, { status: 409 });
    }
    throw err;
  }
};
