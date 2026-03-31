import { getDb } from './db.js';

export async function callGateway(slug: string, method: string, path: string, body: any) {
  const registry = getDb();
  
  const store = registry
    .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
    .get(slug) as { gateway_key: string | null } | undefined;

  if (!store || !store.gateway_key) {
    console.warn(`[Gateway] No gateway key found for store ${slug}`);
    return null;
  }

  const gatewayUrlRow = registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('gateway_url') as { value: string } | undefined;
  const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');
  
  if (!gatewayUrl) {
    console.warn(`[Gateway] No gateway_url configured`);
    return null;
  }

  try {
    const res = await fetch(`${gatewayUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-key': store.gateway_key,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gateway] Call failed (${res.status}): ${errText}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error(`[Gateway] Error calling gateway:`, err);
    return null;
  }
}

/**
 * Deliver a message from a human seller to a Telegram buyer via the gateway.
 * We pass the buyerRef (Telegram ID) since the seller app doesn't know the gateway's internal conversation ID.
 */
export async function deliverToTelegram(slug: string, buyerRef: string, body: string, senderName: string) {
  return callGateway(slug, 'POST', `/api/stores/${slug}/conversations/deliver`, {
    buyerRef,
    body,
    senderName,
  });
}
