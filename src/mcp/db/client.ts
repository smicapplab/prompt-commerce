import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initRegistrySchema, initStoreSchema } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Root data directory ───────────────────────────────────────────────────────
// Defaults to <git-root>/_data  (one level above the prompt-commerce package).
// Override with DATA_DIR env var — relative paths are resolved from process.cwd()
// so DATA_DIR=../_data works when the server is started from prompt-commerce/.
export const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.resolve(__dirname, '../../../../_data')
);

// ─── Registry DB ──────────────────────────────────────────────────────────────
// _data/catalog.db  — holds global tables: users, settings, stores
let _registry: Database.Database | null = null;

export function getRegistryDb(): Database.Database {
  if (_registry) return _registry;

  const dbPath = path.join(DATA_DIR, 'catalog.db');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  _registry = new Database(dbPath);
  initRegistrySchema(_registry);
  return _registry;
}

/** Alias kept for backward-compat with auth + settings API routes. */
export function getDb(): Database.Database {
  return getRegistryDb();
}

// ─── Per-store DBs ────────────────────────────────────────────────────────────
// _data/stores/{slug}.db  — one file per store, no store_id columns needed
const _storeCache = new Map<string, Database.Database>();

export function getStoreDb(slug: string): Database.Database {
  const cached = _storeCache.get(slug);
  if (cached) return cached;

  const storesDir = path.join(DATA_DIR, 'stores');
  fs.mkdirSync(storesDir, { recursive: true });

  const dbPath = path.join(storesDir, `${slug}.db`);
  const db = new Database(dbPath);
  initStoreSchema(db);
  _storeCache.set(slug, db);
  return db;
}

// ─── Uploads directory ────────────────────────────────────────────────────────
// _data/uploads/  — shared across all stores
export function getUploadDir(): string {
  const dir = path.join(DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
