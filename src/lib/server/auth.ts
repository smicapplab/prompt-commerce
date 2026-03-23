import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

export interface JwtPayload {
  sub: number;   // user id
  username: string;
  role: string;  // global role: super_admin, admin, user
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function checkPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

/**
 * Extracts and verifies the JWT from a SvelteKit request's Authorization header
 * or `pc_token` cookie. Returns null if missing or invalid.
 */
export function getAuthUser(event: RequestEvent): JwtPayload | null {
  const authHeader = event.request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(authHeader.slice(7));
  }
  const cookie = event.cookies.get('pc_token');
  if (cookie) return verifyToken(cookie);
  return null;
}

import { getDb } from './db.js';

/**
 * Returns a 401 JSON response if the request is not authenticated.
 * Use at the top of +server.ts handlers that require auth.
 */
export function requireAuth(event: RequestEvent): JwtPayload | Response {
  const user = getAuthUser(event);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}

/**
 * Verifies that the user has the required role for a specific store.
 * Super Admins and Admins have full access to all stores.
 */
export async function requireStoreRole(
  event: RequestEvent,
  slug: string | null,
  allowedRoles: string[] = []
): Promise<{ user: JwtPayload; storeRole?: string } | Response> {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  // Global admins have full access
  if (user.role === 'super_admin' || user.role === 'admin') {
    return { user, storeRole: 'admin' };
  }

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Store context required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const mapping = db
    .prepare('SELECT role FROM user_stores WHERE user_id = ? AND store_slug = ?')
    .get(user.sub, slug) as { role: string } | undefined;

  if (!mapping || (allowedRoles.length > 0 && !allowedRoles.includes(mapping.role))) {
    return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions for this store' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return { user, storeRole: mapping.role };
}

/**
 * Generates a temporary, random key for a user and stores it in the DB.
 */
export function generateTempKey(userId: number, expiresInMinutes: number = 60): string {
  const token = `pc_tmp_${randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60000).toISOString();
  
  const db = getDb();
  db.prepare('INSERT INTO user_temp_keys (user_id, token, expires_at) VALUES (?, ?, ?)')
    .run(userId, token, expiresAt);
    
  return token;
}

/**
 * Validates a temporary token and returns the associated user payload.
 * Also cleans up expired tokens for this user.
 */
export function validateTempKey(token: string): JwtPayload | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  const row = db.prepare(`
    SELECT t.*, u.username, u.role
    FROM user_temp_keys t
    JOIN users u ON t.user_id = u.id
    WHERE t.token = ? AND t.expires_at > ?
  `).get(token, now) as { user_id: number; username: string; role: string } | undefined;
  
  if (!row) return null;
  
  // Cleanup expired tokens for this specific user to keep the table lean
  db.prepare('DELETE FROM user_temp_keys WHERE user_id = ? AND expires_at <= ?').run(row.user_id, now);
  
  return {
    sub: row.user_id,
    username: row.username,
    role: row.role
  };
}
