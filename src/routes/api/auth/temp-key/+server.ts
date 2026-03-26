import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
  requireAuth,
  generateTempKey,
  listTempKeys,
  revokeTempKey,
  roleRank,
} from '$lib/server/auth.js';

// Valid roles that can be scoped to
const ALLOWED_SCOPED_ROLES = ['merchandising', 'ops', 'store_admin', 'admin', 'super_admin'];

/** POST /api/auth/temp-key — generate a new temp key */
export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const body = await event.request.json().catch(() => ({}));

  const expiresInMinutes = Number(body.expiresIn) || 60;
  const finalExpiresIn = Math.min(expiresInMinutes, 24 * 60); // cap at 24h

  // Validate optional scoped role — must not exceed the requesting user's rank
  let scopedRole: string | null = null;
  if (body.scopedRole) {
    if (!ALLOWED_SCOPED_ROLES.includes(body.scopedRole)) {
      return json({ error: `Invalid role. Must be one of: ${ALLOWED_SCOPED_ROLES.join(', ')}` }, { status: 400 });
    }
    if (roleRank(body.scopedRole) > roleRank(user.role)) {
      return json({ error: `Cannot generate a key with role "${body.scopedRole}" — it exceeds your own role "${user.role}".` }, { status: 403 });
    }
    scopedRole = body.scopedRole;
  }

  const label: string | null = typeof body.label === 'string' ? body.label.slice(0, 100) : null;

  const token = generateTempKey(user.sub, finalExpiresIn, scopedRole, label);

  return json({
    token,
    scopedRole,
    label,
    expiresIn: finalExpiresIn,
    expiresAt: new Date(Date.now() + finalExpiresIn * 60000).toISOString(),
  });
};

/** GET /api/auth/temp-key — list active keys for the current user */
export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const keys = listTempKeys(user.sub);
  return json({ keys });
};

/** DELETE /api/auth/temp-key?id=<id> — revoke a specific key */
export const DELETE: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const id = Number(event.url.searchParams.get('id'));
  if (!id) return json({ error: 'Missing key id' }, { status: 400 });

  const ok = revokeTempKey(id, user.sub);
  if (!ok) return json({ error: 'Key not found or not yours' }, { status: 404 });

  return json({ ok: true });
};
