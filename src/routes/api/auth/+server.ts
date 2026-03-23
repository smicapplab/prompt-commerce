import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/server/db.js';
import { checkPassword, signToken, requireAuth } from '$lib/server/auth.js';

/** POST /api/auth — login, returns JWT */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json().catch(() => null);
  if (!body?.username || !body?.password) {
    return json({ error: 'username and password required' }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?')
    .get(body.username) as { id: number; username: string; password_hash: string; role: string } | undefined;

  if (!user || !checkPassword(body.password, user.password_hash)) {
    return json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  return json({ token, username: user.username, role: user.role });
}

/** GET /api/auth — verify current token */
export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;
  return json({ username: user.username, role: user.role });
}
