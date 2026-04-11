import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { getDb, getStoreDb } from '$lib/server/db.js';

// ─── Server-level settings (registry DB) ─────────────────────────────────────
const SERVER_KEYS = [
  'gateway_url',
  'seller_public_url',
  'admin_base_url',
  'google_places_api_key',
] as const;

// ─── Per-store settings (store DB) ───────────────────────────────────────────
const STORE_KEYS = [
  // Display
  'store_display_name',
  'store_currency',
  'store_timezone',
  'allows_pickup',
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
  'telegram_enabled',
  'whatsapp_enabled',
  // Payments
  'payment_provider',
  'payment_api_key',
  'payment_public_key',
  'payment_webhook_secret',
  'payment_instructions',
  'payment_link_template',
  'assisted_label',
  'allow_cod',
  'payment_methods',
  // Telegram and WhatsApp seller notifications
  'telegram_notify_chat_id',
  'whatsapp_notify_number',
  // Google Cloud
  'google_places_browser_key',
  'google_maps_embed_key',
] as const;

type ServerKey = typeof SERVER_KEYS[number];
type StoreKey = typeof STORE_KEYS[number];

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
      'payment_api_key', 'payment_webhook_secret', 'google_places_browser_key', 'google_maps_embed_key',
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
  const slug = event.url.searchParams.get('store') || null;
  // If store is set, require store_admin. If not (server wide), require global admin.
  const auth = await requireStoreRole(event, slug, slug ? ['store_admin'] : []);
  if (auth instanceof Response) return auth;

  const db = getSettingsDb(slug);
  return json(readSettings(db, !!slug));
};

export const PATCH: RequestHandler = async (event) => {
  const slug = event.url.searchParams.get('store') || null;
  // If store is set, require store_admin. If not (server wide), require global admin.
  const auth = await requireStoreRole(event, slug, slug ? ['store_admin'] : []);
  if (auth instanceof Response) return auth;

  const db = getSettingsDb(slug);
  const body = await event.request.json();
  const allowed = allowedKeys(slug);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const deleteKey = db.prepare(`DELETE FROM settings WHERE key = ?`);

  // null → delete the key (clear it); '' → skip (no-op); string → upsert
  const entries = Object.entries(body).filter(
    ([key, value]) => allowed.includes(key) && value !== undefined
  ) as [string, string | null][];

  if (entries.length === 0) {
    return json({ error: 'No valid keys provided' }, { status: 400 });
  }

  const updateMany = db.transaction((rows: [string, string | null][]) => {
    for (const [key, value] of rows) {
      if (value === null) deleteKey.run(key);
      else upsert.run(key, String(value), now);
    }
  });

  updateMany(entries);

  // ── Fire-and-forget: push config changes to gateway ─────────────────────────
  if (slug) {
    const AI_KEYS = new Set(['ai_enabled', 'ai_provider', 'gemini_api_key', 'claude_api_key', 'openai_api_key', 'ai_model', 'ai_system_prompt', 'serper_api_key']);
    const PAYMENT_KEYS = new Set(['payment_provider', 'payment_api_key', 'payment_public_key', 'payment_webhook_secret', 'payment_instructions', 'payment_link_template', 'assisted_label', 'allow_cod', 'payment_methods']);
    const MESSAGING_KEYS = new Set(['telegram_enabled', 'whatsapp_enabled', 'telegram_notify_chat_id', 'whatsapp_notify_number']);
    const TELEGRAM_BOT_KEYS = new Set(['telegram_webhook_url']);
    const STORE_CONFIG_KEYS = new Set(['allows_pickup']);
    const GOOGLE_KEYS = new Set(['google_places_browser_key', 'google_maps_embed_key']);

    const hasAiChange = entries.some(([key]) => AI_KEYS.has(key));
    const hasPaymentChange = entries.some(([key]) => PAYMENT_KEYS.has(key));
    const hasMessagingChange = entries.some(([key]) => MESSAGING_KEYS.has(key));
    const hasTelegramBotChange = entries.some(([key]) => TELEGRAM_BOT_KEYS.has(key));
    const hasStoreConfigChange = entries.some(([key]) => STORE_CONFIG_KEYS.has(key));
    const hasGoogleChange = entries.some(([key]) => GOOGLE_KEYS.has(key));

    if (hasAiChange || hasPaymentChange || hasMessagingChange || hasTelegramBotChange || hasStoreConfigChange || hasGoogleChange) {
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
            'ai_enabled', 'ai_provider', 'gemini_api_key', 'claude_api_key', 'openai_api_key', 'ai_model', 'ai_system_prompt', 'serper_api_key',
            'payment_provider', 'payment_api_key', 'payment_public_key', 'payment_webhook_secret', 'payment_instructions', 'payment_link_template', 'assisted_label', 'allow_cod', 'payment_methods',
            'telegram_enabled', 'whatsapp_enabled', 'telegram_notify_chat_id', 'telegram_webhook_url', 'whatsapp_notify_number',
            'allows_pickup',
            'google_places_browser_key', 'google_maps_embed_key'
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
            const apiKey = provider === 'gemini'
              ? s['gemini_api_key']
              : provider === 'openai'
                ? s['openai_api_key']
                : s['claude_api_key'];
            if (apiKey) {
              await fetch(`${gatewayUrl}/api/stores/${slug}/ai-config`, {
                method: 'PATCH',
                headers,
                signal: AbortSignal.timeout(10000),
                body: JSON.stringify({
                  aiEnabled: s['ai_enabled'] === '1',
                  aiProvider: provider,
                  aiApiKey: apiKey,
                  aiModel: s['ai_model'] || null,
                  aiSystemPrompt: s['ai_system_prompt'] || null,
                  serperApiKey: s['serper_api_key'] || null,
                }),
              });
            }
          }

          // ── Push payment config ────────────────────────────────────────────
          if (hasPaymentChange) {
            await fetch(`${gatewayUrl}/api/stores/${slug}/payment-config`, {
              method: 'PATCH',
              headers,
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                paymentProvider: s['payment_provider'] || 'mock',
                paymentApiKey: s['payment_api_key'] || null,
                paymentPublicKey: s['payment_public_key'] || null,
                paymentWebhookSecret: s['payment_webhook_secret'] || null,
                paymentInstructions: s['payment_instructions'] || null,
                paymentLinkTemplate: s['payment_link_template'] || null,
                assistedLabel: s['assisted_label'] || null,
                allowCod: s['allow_cod'] !== '0', // Default true if missing or not '0'
                paymentMethods: s['payment_methods'] || null,
              }),
            });
          }

          // ── Push store config (pickup) ─────────────────────────────────────
          if (hasStoreConfigChange) {
            await fetch(`${gatewayUrl}/api/stores/${slug}/store-config`, {
              method: 'PATCH',
              headers,
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                allowsPickup: s['allows_pickup'] === '1',
              }),
            });
          }

          // ── Push Messaging notification config ────────────────────────────────────
          if (hasMessagingChange) {
            await fetch(`${gatewayUrl}/api/stores/${slug}/messaging-config`, {
              method: 'PATCH',
              headers,
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                telegramEnabled: s['telegram_enabled'] === '1',
                whatsappEnabled: s['whatsapp_enabled'] === '1',
                telegramChatId: s['telegram_notify_chat_id'] || null,
                whatsappNumber: s['whatsapp_notify_number'] || null,
              }),
            });
          }

          // ── Push Telegram bot webhook config ───────────────────────────────
          if (hasTelegramBotChange) {
            await fetch(`${gatewayUrl}/api/bot/telegram`, {
              method: 'PATCH',
              headers,
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                webhookUrl: s['telegram_webhook_url'] || null,
              }),
            });
          }

          // ── Push Google Cloud config ───────────────────────────────────────
          if (hasGoogleChange) {
            await fetch(`${gatewayUrl}/api/stores/${slug}/google-config`, {
              method: 'PATCH',
              headers,
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                googlePlacesBrowserKey: s['google_places_browser_key'] || null,
                googleMapsEmbedKey:     s['google_maps_embed_key']     || null,
              }),
            });
          }

          // ── Push Server config (seller_public_url) ────────────────────────
          const sellerPublicUrlRow = registry
            .prepare('SELECT value FROM settings WHERE key = ?')
            .get('seller_public_url') as { value: string } | undefined;
          const sellerPublicUrl = sellerPublicUrlRow?.value;

          if (sellerPublicUrl) {
            await fetch(`${gatewayUrl}/api/stores/${slug}/server-config`, {
              method: 'PATCH',
              headers,
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                publicUrl: sellerPublicUrl,
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
