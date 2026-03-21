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
  'serper_api_key',
  'ai_model',
  'ai_enabled',
  'ai_system_prompt',
  // Telegram
  'telegram_bot_token',
  'telegram_webhook_url',
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
    const sensitive = new Set<StoreKey>(['claude_api_key', 'gemini_api_key', 'serper_api_key', 'telegram_bot_token']);
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
  return json(readSettings(db, !!slug));
};
