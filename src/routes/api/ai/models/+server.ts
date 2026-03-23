import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

/**
 * GET /api/ai/models?store=<slug>
 * Fetches available Gemini models using the store's gemini_api_key.
 */
export const GET: RequestHandler = async (event) => {
  const authResult = await requireAuth(event);
  if (authResult instanceof Response) return authResult;

  const slug = event.url.searchParams.get('store');
  if (!slug) return json({ error: 'store param required' }, { status: 400 });

  const db = getStoreDb(slug);
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'gemini_api_key'`).get() as { value: string } | undefined;
  if (!row?.value) return json({ error: 'Gemini API key not configured for this store.' }, { status: 400 });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(row.value)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json({ error: err.error?.message ?? 'Gemini API error' }, { status: res.status });
    }
    const data = await res.json();
    const models = (data.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        id:          m.name.replace('models/', ''),
        displayName: m.displayName ?? m.name.replace('models/', ''),
      }));
    return json({ models });
  } catch {
    return json({ error: 'Failed to reach Gemini API.' }, { status: 502 });
  }
};
