import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, hashPassword } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

export const PATCH: RequestHandler = async (event) => {
  const admin = requireAuth(event);
  if (admin instanceof Response) return admin;

  const { id } = event.params;
  const db = getDb();
  
  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as { id: number; role: string } | undefined;
  if (!targetUser) return json({ error: 'User not found' }, { status: 404 });

  // Only global admins can edit global roles
  if (admin.role !== 'super_admin' && admin.role !== 'admin') {
     return json({ error: 'Forbidden' }, { status: 403 });
  }

  // Only super_admin can set/remove super_admin role
  const body = await event.request.json();
  if (body.role === 'super_admin' && admin.role !== 'super_admin') {
    return json({ error: 'Only Super Admins can promote to Super Admin' }, { status: 403 });
  }
  if (targetUser.role === 'super_admin' && admin.role !== 'super_admin') {
    return json({ error: 'Only Super Admins can edit other Super Admins' }, { status: 403 });
  }

  const updates: string[] = [];
  const params: any[] = [];
  
  if (body.username) {
    updates.push('username = ?');
    params.push(body.username);
  }
  if (body.password) {
    updates.push('password_hash = ?');
    updates.push('needs_password_change = 0');
    params.push(hashPassword(body.password));
  }
  if (body.role) {
    updates.push('role = ?');
    params.push(body.role);
  }
  if (body.first_name !== undefined) {
    updates.push('first_name = ?');
    params.push(body.first_name);
  }
  if (body.last_name !== undefined) {
    updates.push('last_name = ?');
    params.push(body.last_name);
  }
  if (body.email !== undefined) {
    updates.push('email = ?');
    params.push(body.email);
  }
  if (body.mobile !== undefined) {
    updates.push('mobile = ?');
    params.push(body.mobile || null);
  }

  const applyUpdates = db.transaction(() => {
    if (updates.length > 0) {
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);
    }

    // Handle store assignments if provided
    if (body.stores && Array.isArray(body.stores)) {
      // Replace all store assignments for this user
      db.prepare('DELETE FROM user_stores WHERE user_id = ?').run(id);
      const insert = db.prepare('INSERT INTO user_stores (user_id, store_slug, role) VALUES (?, ?, ?)');
      for (const a of body.stores) {
        insert.run(id, a.slug, a.role);
      }
    }
  });

  applyUpdates();

  return json({ success: true });
};

export const DELETE: RequestHandler = async (event) => {
  const admin = requireAuth(event);
  if (admin instanceof Response) return admin;

  if (admin.role !== 'super_admin' && admin.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = event.params;
  const db = getDb();
  
  const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (!targetUser) return json({ error: 'User not found' }, { status: 404 });

  if (targetUser.role === 'super_admin' && admin.role !== 'super_admin') {
    return json({ error: 'Only Super Admins can delete other Super Admins' }, { status: 403 });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return json({ success: true });
};
