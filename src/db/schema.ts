import type Database from 'better-sqlite3';

/**
 * Creates all tables and seeds the default admin user if this is the first run.
 * Safe to call on every startup — all statements use IF NOT EXISTS.
 */
export function initSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ─── Users ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE,
      password_hash TEXT   NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'admin',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Settings (key-value store) ─────────────────────────────────────────
    -- Keys in use: 'llm_api_key', 'gateway_key'
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
      tags           TEXT,    -- JSON array, e.g. '["sale","new"]'
      images         TEXT,    -- JSON array of URLs
      active         INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Ensure stock_quantity exists for existing installations
    -- This is a simple migration check
    PRAGMA table_info(products);
  `);

  // Check if stock_quantity column exists
  const columns = db.prepare("PRAGMA table_info(products)").all() as any[];
  const hasStock = columns.some((c) => c.name === 'stock_quantity');
  if (!hasStock) {
    db.exec("ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0");
  }

  db.exec(`
    -- ─── Promotions ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS promotions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      title          TEXT    NOT NULL,
      product_id     INTEGER REFERENCES products(id) ON DELETE CASCADE,
      voucher_code   TEXT    UNIQUE,
      discount_type  TEXT    NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
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
  `);
}
