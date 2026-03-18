import { Module, type OnApplicationShutdown } from '@nestjs/common';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

export const DATABASE = 'DATABASE' as const;

function initSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'admin',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sku         TEXT    UNIQUE,
      title       TEXT    NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price       REAL,
      tags        TEXT,
      images      TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

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

async function seedDefaultAdmin(db: Database.Database): Promise<void> {
  const existing = db
    .prepare(`SELECT id FROM users LIMIT 1`)
    .get() as { id: number } | undefined;

  if (!existing) {
    const hash = await bcrypt.hash('admin123', 12);
    db.prepare(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`).run(
      'admin',
      hash,
    );
    console.log('✅  Default admin user created (admin / admin123) — change this immediately!');
  }
}

let _db: Database.Database | null = null;

function getOrCreateDb(): Database.Database {
  if (_db) return _db;

  const dbPath =
    process.env.DATABASE_PATH ||
    path.resolve(__dirname, '../../../../data/catalog.db');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  initSchema(_db);
  return _db;
}

@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: async (): Promise<Database.Database> => {
        const db = getOrCreateDb();
        await seedDefaultAdmin(db);
        return db;
      },
    },
  ],
  exports: [DATABASE],
})
export class DbModule implements OnApplicationShutdown {
  onApplicationShutdown(): void {
    _db?.close();
    _db = null;
  }
}
