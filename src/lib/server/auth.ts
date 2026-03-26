import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';

// ── JWT secret ────────────────────────────────────────────────────────────────
// migrate.ts auto-generates a strong secret into .env on first run, so sellers
// never need to touch this. If the server somehow starts without migrations
// having run, we throw at request time rather than at module import time.
// (Throwing at import time breaks the SvelteKit build analyser, which imports
// every server module without the runtime env vars being set.)
const KNOWN_WEAK_SECRETS = new Set([
  'change-me-in-production',
  'change-me-to-a-long-random-string',
  'replace_with_generated_secret',
  'secret',
  'jwt_secret',
  'your_secret',
]);

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

/** Lazily resolved at call time — never at module load / build-analysis time. */
function getJwtSecret(): string {
  const raw = process.env.JWT_SECRET ?? '';
  if (!raw || raw.length < 32 || KNOWN_WEAK_SECRETS.has(raw.toLowerCase())) {
    throw new Error(
      '[auth] JWT_SECRET is missing or insecure. ' +
      'Run "npm run db:migrate" once — it will auto-generate a secure secret. ' +
      'Then restart the server.',
    );
  }
  return raw;
}

export interface JwtPayload {
  sub: number;   // user id
  username: string;
  role: string;  // global role: super_admin, admin, user
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as unknown as JwtPayload;
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
import { apiError } from './response.js';

/**
 * Returns a 401 JSON response if the request is not authenticated.
 * Use at the top of +server.ts handlers that require auth.
 */
export function requireAuth(event: RequestEvent): JwtPayload | Response {
  const user = getAuthUser(event);
  if (!user) {
    return apiError(401, 'Unauthorised');
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
    return apiError(400, 'Store context required');
  }

  const db = getDb();
  const mapping = db
    .prepare('SELECT role FROM user_stores WHERE user_id = ? AND store_slug = ?')
    .get(user.sub, slug) as { role: string } | undefined;

  if (!mapping || (allowedRoles.length > 0 && !allowedRoles.includes(mapping.role))) {
    return apiError(403, 'Forbidden: Insufficient permissions for this store');
  }

  return { user, storeRole: mapping.role };
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────
// Higher index = more privileged. Enforces scoped keys can't exceed user's role.
const ROLE_RANK: Record<string, number> = {
  ops: 1,
  merchandising: 1,
  store_admin: 2,
  admin: 3,
  super_admin: 4,
};

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0;
}

/**
 * Generates a temporary, random key for a user and stores it in the DB.
 *
 * @param userId           - ID of the user who owns this key.
 * @param expiresInMinutes - How long until the key expires (default 60 min).
 * @param scopedRole       - Optional narrower role. Must be ≤ user's actual role.
 *                           Pass null/undefined to inherit the user's full role.
 * @param label            - Human-readable label, e.g. "Claude Desktop – MacBook".
 */
export function generateTempKey(
  userId: number,
  expiresInMinutes: number = 60,
  scopedRole?: string | null,
  label?: string | null,
): string {
  const token = `pc_tmp_${randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60000).toISOString();

  const db = getDb();
  db.prepare(
    'INSERT INTO user_temp_keys (user_id, token, scoped_role, label, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, token, scopedRole ?? null, label ?? null, expiresAt);

  return token;
}

/**
 * Validates a temporary token and returns the associated user payload.
 * The returned role is the scoped_role if set, otherwise the user's global role.
 * Also cleans up expired tokens for this user.
 */
export function validateTempKey(token: string): JwtPayload | null {
  const db = getDb();
  const now = new Date().toISOString();

  const row = db.prepare(`
    SELECT t.user_id, t.scoped_role, u.username, u.role AS user_role
    FROM user_temp_keys t
    JOIN users u ON t.user_id = u.id
    WHERE t.token = ? AND t.expires_at > ?
  `).get(token, now) as {
    user_id: number;
    username: string;
    user_role: string;
    scoped_role: string | null;
  } | undefined;

  if (!row) return null;

  // Cleanup expired tokens for this user
  db.prepare('DELETE FROM user_temp_keys WHERE user_id = ? AND expires_at <= ?')
    .run(row.user_id, now);

  // Effective role: use scoped_role only if it doesn't exceed the user's own rank
  const effectiveRole =
    row.scoped_role && roleRank(row.scoped_role) <= roleRank(row.user_role)
      ? row.scoped_role
      : row.user_role;

  return { sub: row.user_id, username: row.username, role: effectiveRole };
}

/**
 * Lists all active (non-expired) temp keys for a user.
 * Does NOT return the token value itself.
 */
export function listTempKeys(userId: number): Array<{
  id: number; label: string | null; scoped_role: string | null;
  expires_at: string; created_at: string;
}> {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(
    `SELECT id, label, scoped_role, expires_at, created_at
     FROM user_temp_keys WHERE user_id = ? AND expires_at > ?
     ORDER BY created_at DESC`,
  ).all(userId, now) as any[];
}

/**
 * Revokes a specific temp key by ID (only if it belongs to the requesting user).
 */
export function revokeTempKey(keyId: number, userId: number): boolean {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM user_temp_keys WHERE id = ? AND user_id = ?',
  ).run(keyId, userId);
  return result.changes > 0;
}
