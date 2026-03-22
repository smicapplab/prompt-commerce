import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getDb, getStoreDb } from '$lib/server/db.js';

// ─── Server-level settings (registry DB) ─────────────────────────────────────
const SERVER_KEYS = [
  'gateway_url',
  'admin_base_url',
] as const;

// ─── Per-store settings (store DB) ───────────────────────────────────────────
const STORE_KEYS = [
  // Display
  'store_display_name',
  'store_currency',
  'store_timezone',
  // AI
  'claude_api_key',
  'gemini_api_key',
  'openai_api_key',
  'serper_api_key',
  'ai_provider',
  'ai_model',
  'ai_enabled',
  'ai_system_prompt',
  // Telegram
  'telegram_bot_token',
  'telegram_webhook_url',
  // Payments
  'payment_provider',
  'payment_api_key',
  'payment_public_key',
  'payment_webhook_secret',
] as const;

type ServerKey = typeof SERVER_KEYS[number];
type StoreKey  = typeof STORE_KEYS[number];

function getSettingsDb(slug?: string | null) {
  return slug ? getStoreDb(slug) : getDb();
}

function allowedKeys(slug?: string | null) {
  return slug ? (STORE_KEYS as readonly string[]) : (SERVER_KEYS as readonly string[]);
}

/** Read all settings rows and return as record, masking sensitive keys with _set flags. */
function readSettings(db: ReturnType<typeof getDb>, isStore: boolean): Record<string, string | boolean> {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as { key: string; value: string }[];
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;

  const out: Record<string, string | boolean> = {};

  if (isStore) {
    // Mask sensitive keys — return _set boolean instead of value
    const sensitive = new Set<StoreKey>([
      'claude_api_key', 'gemini_api_key', 'openai_api_key', 'serper_api_key', 'telegram_bot_token',
      'payment_api_key', 'payment_webhook_secret',
    ]);
    for (const key of STORE_KEYS) {
      if (sensitive.has(key)) {
        out[`${key}_set`] = !!raw[key];
      } else {
        if (raw[key] !== undefined) out[key] = raw[key];
      }
    }
  } else {
    for (const key of SERVER_KEYS) {
      if (raw[key] !== undefined) out[key] = raw[key];
    }
  }

  return out;
}

export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store') || null;
  const db = getSettingsDb(slug);
  return json(readSettings(db, !!slug));
};

export const PATCH: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store') || null;
  const db = getSettingsDb(slug);
  const body = await event.request.json();
  const allowed = allowedKeys(slug);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const entries = Object.entries(body).filter(
    ([key, value]) => allowed.includes(key) && value !== '' && value !== undefined
  ) as [string, string][];

  if (entries.length === 0) {
    return json({ error: 'No valid keys provided' }, { status: 400 });
  }

  const updateMany = db.transaction((rows: [string, string][]) => {
    for (const [key, value] of rows) upsert.run(key, String(value), now);
  });

  updateMany(entries);

  // ── Fire-and-forget: push config changes to gateway ─────────────────────────
  if (slug) {
    const AI_KEYS      = new Set(['ai_provider', 'gemini_api_key', 'claude_api_key', 'openai_api_key', 'ai_model', 'ai_system_prompt', 'serper_api_key']);
    const PAYMENT_KEYS = new Set(['payment_provider', 'payment_api_key', 'payment_public_key', 'payment_webhook_secret']);

    const hasAiChange      = entries.some(([key]) => AI_KEYS.has(key));
    const hasPaymentChange = entries.some(([key]) => PAYMENT_KEYS.has(key));

    if (hasAiChange || hasPaymentChange) {
      void (async () => {
        try {
          const registry = getDb();

          const gatewayUrlRow = registry
            .prepare('SELECT value FROM settings WHERE key = ?')
            .get('gateway_url') as { value: string } | undefined;
          const gatewayUrl = gatewayUrlRow?.value?.replace(/\/$/, '');
          if (!gatewayUrl) return;

          const storeRow = registry
            .prepare('SELECT gateway_key FROM stores WHERE slug = ? AND active = 1')
            .get(slug) as { gateway_key: string | null } | undefined;
          if (!storeRow?.gateway_key) return;

          // Read all relevant settings from the store DB (post-save)
          const storeDb = getStoreDb(slug);
          const allKeys = [
            'ai_provider', 'gemini_api_key', 'claude_api_key', 'openai_api_key', 'ai_model', 'ai_system_prompt', 'serper_api_key',
            'payment_provider', 'payment_api_key', 'payment_public_key', 'payment_webhook_secret',
          ];
          const settingRows = storeDb
            .prepare(`SELECT key, value FROM settings WHERE key IN (${allKeys.map(() => '?').join(',')})`)
            .all(...allKeys) as { key: string; value: string }[];
          const s: Record<string, string> = {};
          for (const r of settingRows) s[r.key] = r.value;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-gateway-key': storeRow.gateway_key,
          };

          // ── Push AI config ─────────────────────────────────────────────────
          if (hasAiChange) {
            const provider = s['ai_provider'] || 'claude';
            const apiKey   = provider === 'gemini'
              ? s['gemini_api_key']
              : provider === 'openai'
                ? s['openai_api_key']
                : s['claude_api_key'];
            if (apiKey) {
              await fetch(`${gatewayUrl}/api/stores/${slug}/ai-config`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  aiProvider:     provider,
                  aiApiKey:       apiKey,
                  aiModel:        s['ai_model']        || null,
                  aiSystemPrompt: s['ai_system_prompt'] || null,
                  serperApiKey:   s['serper_api_key']  || null,
                }),
              });
            }
          }

          // ── Push payment config ────────────────────────────────────────────
          if (hasPaymentChange) {
            await fetch(`${gatewayUrl}/api/stores/${slug}/payment-config`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                paymentProvider:      s['payment_provider']       || 'mock',
                paymentApiKey:        s['payment_api_key']        || null,
                paymentPublicKey:     s['payment_public_key']     || null,
                paymentWebhookSecret: s['payment_webhook_secret'] || null,
              }),
            });
          }
        } catch {
          // Non-blocking — log but don't fail the response
          console.error('[settings] Failed to push config to gateway');
        }
      })();
    }
  }

  return json(readSettings(db, !!slug));
};
