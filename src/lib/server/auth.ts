import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { RequestEvent } from '@sveltejs/kit';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

export interface JwtPayload {
  sub: number;   // user id
  username: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
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
