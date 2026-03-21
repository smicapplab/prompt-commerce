import type Database from 'better-sqlite3';

// ─── Registry schema ──────────────────────────────────────────────────────────
// Stored in _data/catalog.db — server-level tables shared across all stores.
export function initRegistrySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ─── Admin users ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'admin',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Server-level key-value settings ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Store registry ──────────────────────────────────────────────────────
    -- Each row here corresponds to one _data/stores/{slug}.db file.
    CREATE TABLE IF NOT EXISTS stores (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT    NOT NULL UNIQUE,
      name         TEXT    NOT NULL,
      description  TEXT,
      gateway_key  TEXT,
      active       INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Per-store schema ─────────────────────────────────────────────────────────
// Stored in _data/stores/{slug}.db — one file per store.
// No store_id columns needed: each file IS one store.
export function initStoreSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ─── Per-store key-value settings ────────────────────────────────────────
    -- Holds AI keys, display preferences, Telegram config, etc. for this store.
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Categories ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Products ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS products (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sku            TEXT    UNIQUE,
      title          TEXT    NOT NULL,
      description    TEXT,
      category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price          REAL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      tags           TEXT,
      images         TEXT,
      active         INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Promotions ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS promotions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      title          TEXT    NOT NULL,
      product_id     INTEGER REFERENCES products(id) ON DELETE CASCADE,
      voucher_code   TEXT    UNIQUE,
      discount_type  TEXT    NOT NULL DEFAULT 'percentage',
      discount_value REAL    NOT NULL,
      start_date     TEXT,
      end_date       TEXT,
      active         INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Reviews ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      customer_name TEXT,
      rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment       TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Orders ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_ref    TEXT,
      channel      TEXT    NOT NULL DEFAULT 'telegram',
      status       TEXT    NOT NULL DEFAULT 'pending',
      total        REAL,
      notes        TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Order Items ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      title      TEXT    NOT NULL,
      price      REAL    NOT NULL,
      quantity   INTEGER NOT NULL DEFAULT 1
    );

    -- ─── Conversations ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_ref  TEXT    NOT NULL,
      channel    TEXT    NOT NULL DEFAULT 'telegram',
      status     TEXT    NOT NULL DEFAULT 'open',
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Messages ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender          TEXT    NOT NULL,
      body            TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Legacy alias ─────────────────────────────────────────────────────────────
// migrate.ts still imports initSchema — point it to initRegistrySchema.
export { initRegistrySchema as initSchema };
