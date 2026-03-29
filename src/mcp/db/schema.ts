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
      first_name    TEXT    NOT NULL DEFAULT '',
      last_name     TEXT    NOT NULL DEFAULT '',
      email         TEXT    NOT NULL DEFAULT '',
      mobile        TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
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

    -- ─── User-Store mappings (RBAC) ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_stores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_slug    TEXT    NOT NULL REFERENCES stores(slug) ON DELETE CASCADE,
      role          TEXT    NOT NULL, -- store_admin, merchandising, ops
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, store_slug)
    );

    -- ─── Temporary LLM Keys for MCP ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_temp_keys (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token         TEXT    NOT NULL UNIQUE,
      scoped_role   TEXT,           -- narrower role override; NULL = inherit user's full role
      label         TEXT,           -- human-readable name e.g. "Claude Desktop - MacBook"
      expires_at    TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Triggers ────────────────────────────────────────────────────────────
    CREATE TRIGGER IF NOT EXISTS users_updated_at AFTER UPDATE ON users FOR EACH ROW BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS settings_updated_at AFTER UPDATE ON settings FOR EACH ROW BEGIN
      UPDATE settings SET updated_at = datetime('now') WHERE key = OLD.key;
    END;
    CREATE TRIGGER IF NOT EXISTS stores_updated_at AFTER UPDATE ON stores FOR EACH ROW BEGIN
      UPDATE stores SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS user_stores_updated_at AFTER UPDATE ON user_stores FOR EACH ROW BEGIN
      UPDATE user_stores SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS user_temp_keys_updated_at AFTER UPDATE ON user_temp_keys FOR EACH ROW BEGIN
      UPDATE user_temp_keys SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
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
      is_synced  INTEGER NOT NULL DEFAULT 0,  -- 0=dirty (needs push), 1=synced
      deleted_at TEXT    DEFAULT NULL,        -- NULL=active; timestamp=soft-deleted
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
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
      is_synced      INTEGER NOT NULL DEFAULT 0,  -- 0=dirty (needs push), 1=synced
      deleted_at     TEXT    DEFAULT NULL,        -- NULL=active; timestamp=soft-deleted
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
      is_synced      INTEGER NOT NULL DEFAULT 0,
      deleted_at     TEXT    DEFAULT NULL,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Reviews ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      customer_name TEXT,
      rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment       TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
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
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Triggers: update_at ─────────────────────────────────────────────────
    CREATE TRIGGER IF NOT EXISTS settings_updated_at AFTER UPDATE ON settings FOR EACH ROW BEGIN
      UPDATE settings SET updated_at = datetime('now') WHERE key = OLD.key;
    END;
    CREATE TRIGGER IF NOT EXISTS categories_updated_at AFTER UPDATE ON categories FOR EACH ROW
    WHEN (NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL)
    BEGIN
      UPDATE categories SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS products_updated_at AFTER UPDATE ON products FOR EACH ROW
    WHEN (NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL)
    BEGIN
      UPDATE products SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS promotions_updated_at AFTER UPDATE ON promotions FOR EACH ROW
    WHEN (NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL)
    BEGIN
      UPDATE promotions SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS reviews_updated_at AFTER UPDATE ON reviews FOR EACH ROW
    WHEN (NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL)
    BEGIN
      UPDATE reviews SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS orders_updated_at AFTER UPDATE ON orders FOR EACH ROW BEGIN
      UPDATE orders SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS conversations_updated_at AFTER UPDATE ON conversations FOR EACH ROW BEGIN
      UPDATE conversations SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS messages_updated_at AFTER UPDATE ON messages FOR EACH ROW BEGIN
      UPDATE messages SET updated_at = datetime('now') WHERE id = OLD.id;
    END;

    -- ─── Triggers: is_synced (Auto-dirty on change) ──────────────────────────
    CREATE TRIGGER IF NOT EXISTS categories_sync_dirty AFTER UPDATE ON categories FOR EACH ROW
    WHEN NEW.is_synced = OLD.is_synced AND NEW.is_synced = 1 AND NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE categories SET is_synced = 0 WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS products_sync_dirty AFTER UPDATE ON products FOR EACH ROW
    WHEN NEW.is_synced = OLD.is_synced AND NEW.is_synced = 1 AND NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE products SET is_synced = 0 WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS promotions_sync_dirty AFTER UPDATE ON promotions FOR EACH ROW
    WHEN NEW.is_synced = OLD.is_synced AND NEW.is_synced = 1 AND NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE promotions SET is_synced = 0 WHERE id = OLD.id;
    END;
  `);
}

// ─── Legacy alias ─────────────────────────────────────────────────────────────
// migrate.ts still imports initSchema — point it to initRegistrySchema.
export { initRegistrySchema as initSchema };
