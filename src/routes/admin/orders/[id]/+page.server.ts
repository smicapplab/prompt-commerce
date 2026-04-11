import type { PageServerLoad } from './$types.js';
import { getDb, getStoreDb } from '$lib/server/db.js';

export const load: PageServerLoad = async (event) => {
  const slug = event.url.searchParams.get('store');
  const registry = getDb();
  
  let storeKey: string | undefined;
  if (slug) {
    const storeDb = getStoreDb(slug);
    const row = storeDb.prepare('SELECT value FROM settings WHERE key = ?').get('google_maps_embed_key') as { value: string } | undefined;
    storeKey = row?.value;
  }

  const registryKeyRow = registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('google_maps_embed_key') as { value: string } | undefined;

  const legacyKeyRow = registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('google_places_api_key') as { value: string } | undefined;

  return {
    googlePlacesApiKey: storeKey || 
                        registryKeyRow?.value || 
                        legacyKeyRow?.value || 
                        process.env.GOOGLE_MAPS_EMBED_KEY || 
                        process.env.GOOGLE_PLACES_API_KEY || 
                        ''
  };
};
