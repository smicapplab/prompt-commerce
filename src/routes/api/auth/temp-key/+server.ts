import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, generateTempKey } from '$lib/server/auth.js';

export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event);
  if (user instanceof Response) return user;

  const body = await event.request.json().catch(() => ({}));
  const expiresInMinutes = Number(body.expiresIn) || 60; // default 1 hour
  
  // Limit max expiration to 24 hours for safety
  const finalExpiresIn = Math.min(expiresInMinutes, 24 * 60);

  const token = generateTempKey(user.sub, finalExpiresIn);

  return json({ 
    token, 
    expiresIn: finalExpiresIn,
    expiresAt: new Date(Date.now() + finalExpiresIn * 60000).toISOString()
  });
};
