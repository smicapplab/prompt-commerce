/**
 * Re-exports DB helpers for use in SvelteKit +server.ts routes.
 *
 * getDb() / getRegistryDb()  — catalog.db  (users, settings, stores)
 * getStoreDb(slug)            — stores/{slug}.db  (products, categories, …)
 * getUploadDir()              — _data/uploads/
 */
export { getDb, getRegistryDb, getStoreDb, getUploadDir } from '../../mcp/db/client.js';
