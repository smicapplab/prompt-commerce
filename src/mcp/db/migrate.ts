#!/usr/bin/env tsx
/**
 * Database migration tool for the seller server (SQLite / better-sqlite3).
 *
 * Usage:
 *   npm run db:migrate          — apply schema to registry DB (safe, idempotent)
 *   npm run db:reset            — DROP the registry DB file and recreate from scratch
 *
 * The registry DB (_data/catalog.db) holds: users, settings, stores.
 * Per-store DBs (_data/stores/{slug}.db) are created automatically on first
 * access — no separate migration step needed for them.
 */
import 'dotenv/config'; // ← must be first — loads .env before DATA_DIR is evaluated
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initRegistrySchema, initStoreSchema } from './schema.js';
import { DATA_DIR } from './client.js';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(DATA_DIR, 'catalog.db');

const isReset = process.argv.includes('--reset');

// ── Reset mode: delete registry DB ───────────────────────────────────────────
if (isReset) {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`🗑  Deleted ${DB_PATH}`);
  } else {
    console.log(`ℹ  No DB file found at ${DB_PATH} — will create fresh.`);
  }
}

// ── Ensure directory exists ───────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Connect & run registry schema ────────────────────────────────────────────
console.log(`📦  Registry DB: ${DB_PATH}`);
const db = new Database(DB_PATH);
initRegistrySchema(db);

// Add profile columns to existing users table if they don't exist
for (const stmt of [
  "ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN last_name  TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN email      TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN mobile     TEXT",
]) {
  try {
    db.exec(stmt);
  } catch {
    /* column already exists */
  }
}

console.log('✔  Registry schema applied (users, settings, stores)');

// ── Seed default admin user ───────────────────────────────────────────────────
const userCount = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;

if (userCount === 0) {
  const defaultUser = process.env.ADMIN_USERNAME ?? 'admin';
  const defaultPass = process.env.ADMIN_PASSWORD ?? 'admin123';
  const hash = bcrypt.hashSync(defaultPass, 10);

  db.prepare(
    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`
  ).run(defaultUser, hash);

  console.log(`✔  Default admin user created: ${defaultUser} / ${defaultPass}`);
  console.log('   ⚠  Change this password in Settings before going live!');
}

db.close();

// ── Migrate all existing per-store DBs ────────────────────────────────────────
// Adds is_synced / deleted_at columns if they don't exist yet.
const storesDir = path.join(DATA_DIR, 'stores');
if (fs.existsSync(storesDir)) {
  const storeFiles = fs.readdirSync(storesDir).filter(f => f.endsWith('.db'));
  for (const file of storeFiles) {
    const storePath = path.join(storesDir, file);
    const sdb = new Database(storePath);
    // Re-apply full schema (CREATE TABLE IF NOT EXISTS is safe)
    initStoreSchema(sdb);
    // Add new columns to existing tables — SQLite doesn't support IF NOT EXISTS
    // for ALTER TABLE, so we catch the "duplicate column" error and continue.
    for (const stmt of [
      'ALTER TABLE products   ADD COLUMN is_synced  INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE products   ADD COLUMN deleted_at TEXT    DEFAULT NULL',
      'ALTER TABLE categories ADD COLUMN is_synced  INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE categories ADD COLUMN deleted_at TEXT    DEFAULT NULL',
    ]) {
      try { sdb.exec(stmt); } catch { /* column already exists */ }
    }
    sdb.close();
    console.log(`✔  Migrated store DB: ${file}`);
  }
}

console.log('\n🚀  Migration complete.');
console.log(`   Data directory: ${DATA_DIR}`);
