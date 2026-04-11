import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/server/db.js';
import { checkPassword, signToken, requireAuth } from '$lib/server/auth.js';

// ─── Brute-force protection ───────────────────────────────────────────────────
// In-memory per-IP tracking. Resets on server restart, which is fine — restarts
// also invalidate all JWTs, so an attacker would need to restart too.
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 minutes

interface Attempt { count: number; firstAt: number; lockedUntil?: number }
const attempts = new Map<string, Attempt>();

// ─── Map Eviction (Memory Safety) ──────────────────────────────────────────
// Periodically prune expired entries to prevent the Map from growing forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts.entries()) {
    const isExpired = now - entry.firstAt > WINDOW_MS;
    const isLocked = entry.lockedUntil && now < entry.lockedUntil;
    if (isExpired && !isLocked) {
      attempts.delete(ip);
    }
  }
}, 60 * 60 * 1000).unref(); // Run every hour, don't block process exit

function getClientIp(event: Parameters<RequestHandler>[0]): string {
  // event.getClientAddress() is the recommended way in SvelteKit to get the 
  // trusted client IP. It relies on the adapter's trust configuration.
  try {
    return event.getClientAddress();
  } catch (e) {
    // Fallback if getClientAddress() is not available or fails
    return (
      (event.request.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() ||
      '0.0.0.0'
    );
  }
}

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSec?: number } {
  const now   = Date.now();
  const entry = attempts.get(ip);

  if (!entry) return { blocked: false };

  // Currently locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  // Window expired — reset
  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(ip);
    return { blocked: false };
  }

  return { blocked: false };
}

function recordFailure(ip: string): void {
  const now   = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(ip, entry);
}

function recordSuccess(ip: string): void {
  attempts.delete(ip);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** POST /api/auth — login, returns JWT */
export const POST: RequestHandler = async (event) => {
  const ip = getClientIp(event);
  const limit = checkRateLimit(ip);

  if (limit.blocked) {
    return json(
      { error: `Too many failed attempts. Try again in ${limit.retryAfterSec}s.` },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSec) },
      },
    );
  }

  const body = await event.request.json().catch(() => null);
  if (!body?.username || !body?.password) {
    return json({ error: 'username and password required' }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, username, password_hash, role, needs_password_change FROM users WHERE username = ?')
    .get(body.username) as { id: number; username: string; password_hash: string; role: string; needs_password_change: number } | undefined;

  if (!user || !checkPassword(body.password, user.password_hash)) {
    recordFailure(ip);
    // Use the same error message regardless of whether the user exists
    return json({ error: 'Invalid credentials' }, { status: 401 });
  }

  recordSuccess(ip);
  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  return json({
    token,
    username:            user.username,
    role:                user.role,
    needsPasswordChange: user.needs_password_change === 1,
  });
};

/** GET /api/auth — verify current token */
export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  // Include the needs_password_change flag so the UI can show a warning banner
  const db   = getDb();
  const row  = db
    .prepare('SELECT needs_password_change FROM users WHERE id = ?')
    .get(user.sub) as { needs_password_change: number } | undefined;

  return json({
    username:              user.username,
    role:                  user.role,
    needsPasswordChange:   row?.needs_password_change === 1,
  });
};
