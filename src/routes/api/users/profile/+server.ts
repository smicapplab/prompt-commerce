import { json } from '@sveltejs/kit';
import { requireAuth, hashPassword } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

export const GET: any = async (event: any) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const db = getDb();
  const userData = db.prepare('SELECT id, username, first_name, last_name, email, mobile, role, created_at FROM users WHERE id = ?').get((user as any).sub) as any;
  
  if (!userData) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  return json(userData);
};

export const PATCH: any = async (event: any) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const body = await event.request.json().catch(() => null);
  if (!body) {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const db = getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (body.first_name !== undefined) {
    updates.push('first_name = ?');
    params.push(body.first_name);
  }
  if (body.last_name !== undefined) {
    updates.push('last_name = ?');
    params.push(body.last_name);
  }
  if (body.email !== undefined) {
    // Check if email is unique if it's being changed
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(body.email, (user as any).sub);
    if (existing) {
      return json({ error: 'Email already in use' }, { status: 409 });
    }
    updates.push('email = ?');
    params.push(body.email);
  }
  if (body.mobile !== undefined) {
    updates.push('mobile = ?');
    params.push(body.mobile || null);
  }
  if (body.password) {
    updates.push('password_hash = ?');
    params.push(hashPassword(body.password));
  }

  if (updates.length === 0) {
    return json({ error: 'No updates provided' }, { status: 400 });
  }

  try {
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params, (user as any).sub);
    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
};
