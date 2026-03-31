import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole, requireGatewayKey } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';
import { deliverToTelegram } from '$lib/server/gateway.js';

export const GET: RequestHandler = async (event) => {
  const id = parseInt(event.params.id);
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const db = getStoreDb(store);
  const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
  if (!conversation) return json({ error: 'Conversation not found' }, { status: 404 });

  const messages = db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
  `).all(id);

  return json({ ...(conversation as any), messages });
};

export const PATCH: RequestHandler = async (event) => {
  const id = parseInt(event.params.id);
  const store = event.url.searchParams.get('store');
  if (!store) return json({ error: 'store is required' }, { status: 400 });

  // Allow either store role or gateway key
  let authResult: any = await requireStoreRole(event, store, ['ops']);
  let isSeller = true;
  if (authResult instanceof Response) {
    const gatewayAuth = requireGatewayKey(event, store);
    if (gatewayAuth instanceof Response) {
      return json({ error: 'Unauthorized: Invalid session or platform key' }, { status: 401 });
    }
    authResult = { user: { username: 'system' } };
    isSeller = false;
  }

  const db = getStoreDb(store);
  const existing = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as any;
  if (!existing) return json({ error: 'Conversation not found' }, { status: 404 });

  const body = await event.request.json();
  const { status, mode, assigned_to } = body;

  const updates: string[] = [];
  const params: any[] = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }
  if (mode) {
    updates.push('mode = ?');
    params.push(mode);
  }
  if (assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    params.push(assigned_to);
  }

  if (updates.length === 0) return json({ error: 'No fields to update' }, { status: 400 });

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // If seller manually took over, notify the gateway to flip the mode there too
  if (isSeller && mode === 'human') {
    const username = authResult.user?.username || 'Seller';
    deliverToTelegram(store, existing.buyer_ref, `👨 ${username} has joined the chat and will assist you shortly.`, 'System')
      .catch(err => console.error(`[Inbox] Failed to notify gateway of handover: ${err}`));
  }

  return json(db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id));
};
