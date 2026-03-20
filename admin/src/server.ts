import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import * as xlsx from 'xlsx';
import axios from 'axios';

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.ADMIN_PORT ?? '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-to-a-long-random-string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Database ─────────────────────────────────────────────────────────────────
const DB_PATH =
  process.env.DATABASE_PATH ||
  path.resolve(__dirname, '../../../data/catalog.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
console.log(`   Database path: ${DB_PATH}`);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Create all tables (idempotent — safe to call on every startup). */
function initSchema(): void {
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
      stock_quantity INTEGER NOT NULL DEFAULT 0,
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

/** Seed the default admin user if no users exist yet. */
async function seedAdmin(): Promise<void> {
  // Only seed if the DB file was just created
  if (!fs.existsSync(DB_PATH)) {
    const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
    if (count > 0) return;

    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`).run(
      DEFAULT_ADMIN_USERNAME,
      hash,
    );
    console.log(
      `   Admin seeded  : username="${DEFAULT_ADMIN_USERNAME}" / password="${DEFAULT_ADMIN_PASSWORD}" — change this after first login!`,
    );
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────
interface AdminTokenPayload {
  sub: number;
  username: string;
  role: string;
}

function signToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as unknown as AdminTokenPayload;
    (req as Request & { user: AdminTokenPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// ─── File uploads ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(__dirname, '../../../data/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));

// Serve static assets from admin/public
app.use(express.static(path.join(__dirname, '../public')));

// Uploaded images accessible at /uploads/<filename>
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string; role: string } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.json({ access_token: token });
});

app.post('/api/auth/change-password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body ?? {};
  if (!current_password || !new_password) {
    res.status(400).json({ error: 'current_password and new_password are required.' }); return;
  }
  if (typeof new_password !== 'string' || new_password.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long.' }); return;
  }

  const user = req as Request & { user: AdminTokenPayload };
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.user.sub) as
    | { password_hash: string }
    | undefined;
  if (!row || !bcrypt.compareSync(current_password, row.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.user.sub);
  res.json({ ok: true });
});

// ─── Products routes ──────────────────────────────────────────────────────────
app.get('/api/products', requireAuth, (req: Request, res: Response): void => {
  const { q, active, page, limit } = req.query;
  const p = parseInt(page as string, 10) || 1;
  const l = parseInt(limit as string, 10) || 20;
  const offset = (p - 1) * l;

  let whereSql = ' WHERE 1=1';
  const params: any[] = [];
  if (q) {
    whereSql += ' AND (p.title LIKE ? OR p.sku LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (active !== undefined && active !== '') {
    whereSql += ' AND p.active = ?';
    params.push(active === '1' ? 1 : 0);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as n FROM products p ${whereSql}`).get(...params) as { n: number };
  const totalCount = countRow.n;

  const sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereSql}
    ORDER BY p.updated_at DESC
    LIMIT ? OFFSET ?
  `;
  const products = db.prepare(sql).all(...params, l, offset);

  res.json({ products, totalCount, page: p, limit: l });
});

app.get('/api/products/:id', requireAuth, (req: Request, res: Response): void => {
  const row = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) { res.status(404).json({ error: 'Product not found.' }); return; }
  res.json(row);
});

app.post('/api/products', requireAuth, (req: Request, res: Response): void => {
  const { sku, title, description, category_id, price, stock_quantity, tags, images, active } = req.body ?? {};
  if (!title) { res.status(400).json({ error: 'title is required.' }); return; }

  const info = db.prepare(`
    INSERT INTO products (sku, title, description, category_id, price, stock_quantity, tags, images, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    sku || null,
    title,
    description || null,
    category_id || null,
    price ?? null,
    stock_quantity !== undefined ? parseInt(stock_quantity, 10) : 0,
    tags ? JSON.stringify(tags) : null,
    images ? JSON.stringify(images) : null,
    active !== false ? 1 : 0,
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', requireAuth, (req: Request, res: Response): void => {
  const { sku, title, description, category_id, price, stock_quantity, tags, images, active } = req.body ?? {};

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Product not found.' }); return; }

  db.prepare(`
    UPDATE products
    SET sku=?, title=?, description=?, category_id=?, price=?, stock_quantity=?,
        tags=?, images=?, active=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    sku || null,
    title,
    description || null,
    category_id || null,
    price ?? null,
    stock_quantity !== undefined ? parseInt(stock_quantity, 10) : 0,
    tags ? JSON.stringify(tags) : null,
    images ? JSON.stringify(images) : null,
    active !== false ? 1 : 0,
    req.params.id,
  );
  res.json({ ok: true });
});

app.delete('/api/products/:id', requireAuth, (req: Request, res: Response): void => {
  db.prepare("UPDATE products SET active=0, updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.status(204).end();
});

// Image upload for a product
app.post('/api/products/:id/images', requireAuth, upload.single('image'), (req: Request, res: Response): void => {
  if (!req.file) { res.status(400).json({ error: 'No image file provided.' }); return; }
  const url = `/uploads/${req.file.filename}`;

  // Append new image URL to the product's images JSON array
  const row = db.prepare('SELECT images FROM products WHERE id=?').get(req.params.id) as { images: string | null } | undefined;
  if (!row) { res.status(404).json({ error: 'Product not found.' }); return; }

  const images: string[] = row.images ? JSON.parse(row.images) : [];
  images.push(url);
  db.prepare("UPDATE products SET images=?, updated_at=datetime('now') WHERE id=?").run(JSON.stringify(images), req.params.id);
  res.json({ url });
});

// ─── Categories routes ────────────────────────────────────────────────────────
app.get('/api/categories', requireAuth, (_req: Request, res: Response): void => {
  res.json(db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
    FROM categories c
    ORDER BY c.name
  `).all());
});

app.post('/api/categories', requireAuth, (req: Request, res: Response): void => {
  const { name, parent_id } = req.body ?? {};
  if (!name) { res.status(400).json({ error: 'name is required.' }); return; }

  try {
    const info = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(name, parent_id || null);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch {
    res.status(409).json({ error: 'A category with that name already exists.' });
  }
});

app.get('/api/categories/:id', requireAuth, (req: Request, res: Response): void => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) { res.status(404).json({ error: 'Category not found.' }); return; }
  res.json(row);
});

app.put('/api/categories/:id', requireAuth, (req: Request, res: Response): void => {
  const { name, parent_id } = req.body ?? {};
  if (!name) { res.status(400).json({ error: 'name is required.' }); return; }

  try {
    db.prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?')
      .run(name, parent_id || null, req.params.id);
    res.json({ ok: true, name });
  } catch {
    res.status(409).json({ error: 'A category with that name already exists.' });
  }
});

app.delete('/api/categories/:id', requireAuth, (req: Request, res: Response): void => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.status(204).end();
});

// ─── Promotions routes ────────────────────────────────────────────────────────
app.get('/api/promotions', requireAuth, (_req: Request, res: Response): void => {
  res.json(db.prepare(`
    SELECT pr.*, p.title as product_title
    FROM promotions pr
    LEFT JOIN products p ON pr.product_id = p.id
    ORDER BY pr.created_at DESC
  `).all());
});

app.post('/api/promotions', requireAuth, (req: Request, res: Response): void => {
  const { title, product_id, voucher_code, discount_type, discount_value, start_date, end_date, active } = req.body ?? {};
  if (!title) { res.status(400).json({ error: 'title is required.' }); return; }
  if (discount_value == null) { res.status(400).json({ error: 'discount_value is required.' }); return; }

  try {
    const info = db.prepare(`
      INSERT INTO promotions (title, product_id, voucher_code, discount_type, discount_value, start_date, end_date, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      product_id || null,
      voucher_code || null,
      discount_type || 'percentage',
      discount_value,
      start_date || null,
      end_date || null,
      active !== false ? 1 : 0,
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'Voucher code already exists.' });
  }
});

app.put('/api/promotions/:id', requireAuth, (req: Request, res: Response): void => {
  const { title, product_id, voucher_code, discount_type, discount_value, start_date, end_date, active } = req.body ?? {};
  try {
    db.prepare(`
      UPDATE promotions
      SET title=?, product_id=?, voucher_code=?, discount_type=?,
          discount_value=?, start_date=?, end_date=?, active=?
      WHERE id=?
    `).run(
      title,
      product_id || null,
      voucher_code || null,
      discount_type || 'percentage',
      discount_value,
      start_date || null,
      end_date || null,
      active !== false ? 1 : 0,
      req.params.id,
    );
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Voucher code already exists.' });
  }
});

app.delete('/api/promotions/:id', requireAuth, (req: Request, res: Response): void => {
  db.prepare('DELETE FROM promotions WHERE id=?').run(req.params.id);
  res.status(204).end();
});

// ─── Reviews routes ───────────────────────────────────────────────────────────
app.get('/api/reviews', requireAuth, (_req: Request, res: Response): void => {
  res.json(db.prepare(`
    SELECT r.*, p.title as product_title
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
  `).all());
});

app.delete('/api/reviews/:id', requireAuth, (req: Request, res: Response): void => {
  db.prepare('DELETE FROM reviews WHERE id=?').run(req.params.id);
  res.status(204).end();
});

// ─── Settings routes ──────────────────────────────────────────────────────────
app.get('/api/settings', requireAuth, (_req: Request, res: Response): void => {
  const rows = db.prepare('SELECT key, value, updated_at FROM settings').all() as {
    key: string; value: string; updated_at: string;
  }[];

  // Never expose the raw gateway key value — just whether it's set
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.key === 'gateway_key') {
      result['gateway_key'] = row.value ? '••••••••' : '';
      result['gateway_key_set'] = !!row.value;
      result['gateway_key_updated_at'] = row.updated_at;
    } else if (row.key === 'gemini_api_key' || row.key === 'claude_api_key' || row.key === 'serper_api_key') {
      result[row.key] = row.value ? '••••••••' : '';
      result[`${row.key}_set`] = !!row.value;
    } else if (row.key === 'ai_model' || row.key === 'base_url') {
      result[row.key] = row.value;
    }
  }
  res.json(result);
});

app.put('/api/settings', requireAuth, (req: Request, res: Response): void => {
  const { gateway_key, base_url } = req.body ?? {};

  if (gateway_key !== undefined) {
    const trimmed = (gateway_key as string).trim();
    if (trimmed && !trimmed.startsWith('gk_')) {
      res.status(400).json({ error: 'Invalid gateway key format. It should start with "gk_".' });
      return;
    }
    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('gateway_key', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(trimmed);
  }

  if (base_url !== undefined) {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('base_url', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run((base_url as string).trim());
  }

  // AI Assistant Settings
  const aiSettings = ['gemini_api_key', 'claude_api_key', 'ai_model', 'serper_api_key'];
  for (const key of aiSettings) {
    if (req.body[key] !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run(key, (req.body[key] as string).trim());
    }
  }


  res.json({ ok: true });
});

// ─── Claude Desktop setup script download ────────────────────────────────────
function getClaudeSetupValues(): { baseUrl: string; gatewayKey: string } | null {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN ('base_url', 'gateway_key')`).all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  rows.forEach(r => (map[r.key] = r.value));
  if (!map.base_url || !map.gateway_key) return null;
  return { baseUrl: map.base_url.trim(), gatewayKey: map.gateway_key.trim() };
}

app.get('/api/settings/claude-setup-mac', requireAuth, (req: Request, res: Response): void => {
  const vals = getClaudeSetupValues();
  if (!vals) {
    res.status(400).json({ error: 'Base URL and Gateway Key must both be configured before downloading the setup script.' });
    return;
  }
  const sseUrl = `${vals.baseUrl.replace(/\/$/, '')}/sse`;

  const script = `#!/bin/bash
# ============================================================
#  Claude Desktop — Add Prompt Commerce MCP Server
#  Mac version
#  Right-click this file -> Open With -> Terminal
# ============================================================

CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
BACKUP="$HOME/Library/Application Support/Claude/claude_desktop_config.backup.json"

clear
echo "================================================"
echo "  Claude Desktop — Prompt Commerce Setup"
echo "================================================"
echo ""

if [ ! -d "$HOME/Library/Application Support/Claude" ]; then
  echo "ERROR: Claude Desktop does not appear to be installed."
  echo "Download it from https://claude.ai/download then run this again."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

[ ! -f "$CONFIG" ] && echo "{}" > "$CONFIG"
cp "$CONFIG" "$BACKUP"
echo "Backup saved."
echo ""
echo "Adding Prompt Commerce to Claude Desktop..."

python3 - <<'PYEOF'
import json, os, sys
config_path = os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")
try:
    with open(config_path) as f:
        config = json.load(f)
except Exception:
    config = {}
if "mcpServers" not in config:
    config["mcpServers"] = {}
config["mcpServers"]["prompt-commerce"] = {
    "command": "npx",
    "args": ["-y", "mcp-remote", "${sseUrl}", "--header", "x-gateway-key:${vals.gatewayKey}"]
}
with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
print("Done!")
PYEOF

if [ $? -eq 0 ]; then
  echo ""
  echo "================================================"
  echo "  SUCCESS!"
  echo ""
  echo "  Please QUIT and RESTART Claude Desktop"
  echo "  for the change to take effect."
  echo "================================================"
else
  echo "ERROR: Setup failed. Restoring backup..."
  cp "$BACKUP" "$CONFIG"
fi

echo ""
read -p "Press Enter to exit..."
`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="add_mcp_mac.sh"');
  res.send(script);
});

app.get('/api/settings/claude-setup-win', requireAuth, (req: Request, res: Response): void => {
  const vals = getClaudeSetupValues();
  if (!vals) {
    res.status(400).json({ error: 'Base URL and Gateway Key must both be configured before downloading the setup script.' });
    return;
  }
  const sseUrl = `${vals.baseUrl.replace(/\/$/, '')}/sse`;

  const script = `@echo off
:: ============================================================
::  Claude Desktop — Add Prompt Commerce MCP Server
::  Windows version — double-click to run
:: ============================================================
setlocal enabledelayedexpansion

set "CONFIG=%APPDATA%\Claude\claude_desktop_config.json"
set "BACKUP=%APPDATA%\Claude\claude_desktop_config.backup.json"

cls
echo ================================================
echo   Claude Desktop -- Prompt Commerce Setup
echo ================================================
echo.

if not exist "%APPDATA%\Claude" (
  echo ERROR: Claude Desktop does not appear to be installed.
  echo Download it from https://claude.ai/download then run this again.
  echo.
  pause & exit /b 1
)

if not exist "%CONFIG%" echo {} > "%CONFIG%"
copy /Y "%CONFIG%" "%BACKUP%" >nul
echo Backup saved.
echo.
echo Adding Prompt Commerce to Claude Desktop...

set "PS=%TEMP%\pc_mcp_setup.ps1"
(
echo $$p = "$$env:APPDATA\Claude\claude_desktop_config.json"
echo $$raw = Get-Content $$p -Raw -Encoding UTF8
echo try { $$c = $$raw ^| ConvertFrom-Json } catch { $$c = [PSCustomObject]@{} }
echo if (-not $$c.PSObject.Properties["mcpServers"]) { $$c ^| Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{}) }
echo $$entry = [PSCustomObject]@{ command = "npx"; args = @("-y", "mcp-remote", "${sseUrl}", "--header", "x-gateway-key:${vals.gatewayKey}") }
echo $$c.mcpServers ^| Add-Member -NotePropertyName "prompt-commerce" -NotePropertyValue $$entry -Force
echo $$c ^| ConvertTo-Json -Depth 10 ^| Set-Content $$p -Encoding UTF8
echo Write-Host "Done!"
) > "%%PS%%"

powershell -ExecutionPolicy Bypass -File "%%PS%%"
del "%%PS%%" >nul 2>&1

if %%errorlevel%% equ 0 (
  echo.
  echo ================================================
  echo   SUCCESS!
  echo.
  echo   Please QUIT and RESTART Claude Desktop
  echo   for the change to take effect.
  echo ================================================
) else (
  echo ERROR: Setup failed. Restoring backup...
  copy /Y "%%BACKUP%%" "%%CONFIG%%" >nul
)

echo.
pause
`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="add_mcp_win.bat"');
  res.send(script);
});

// ─── AI tool executor (shared between Claude and Gemini) ──────────────────────
async function executeAiTool(name: string, args: any): Promise<any> {
  if (name === 'web_search') {
    const key = db.prepare("SELECT value FROM settings WHERE key = 'serper_api_key'").get() as { value: string } | undefined;
    if (!key?.value) return { error: 'Web search is not configured. Please add a Serper API key in Settings.' };
    
    try {
      const response = await axios.post('https://google.serper.dev/search', {
        q: args.query,
      }, {
        headers: {
          'X-API-KEY': key.value,
          'Content-Type': 'application/json'
        }
      });
      return response.data; // Return object directly for Gemini
    } catch (e: any) {
      return { error: `Web search failed: ${e.message}` };
    }
  }
  if (name === 'search_products') {
    let sql = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1`;
    const params: any[] = [];
    if (args.query) { sql += ` AND (p.title LIKE ? OR p.description LIKE ?)`; params.push(`%${args.query}%`, `%${args.query}%`); }
    if (args.category) { sql += ` AND c.name LIKE ?`; params.push(`%${args.category}%`); }
    sql += ` LIMIT 10`;
    return db.prepare(sql).all(...params);
  }
  if (name === 'batch_add_categories') {
    const results = [];
    for (const cat of args.categories) {
      let parentId = null;
      if (cat.parent_name) {
        const parent = db.prepare('SELECT id FROM categories WHERE name = ?').get(cat.parent_name) as { id: number } | undefined;
        parentId = parent ? parent.id : db.prepare('INSERT INTO categories (name) VALUES (?)').run(cat.parent_name).lastInsertRowid;
      }
      const info = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET name=name').run(cat.name, parentId);
      results.push({ name: cat.name, id: info.lastInsertRowid });
    }
    return { success: true, count: results.length, results };
  }
  if (name === 'add_product') {
    const { sku, title, description, category_id, price, stock_quantity, tags, images, active } = args;
    const info = db.prepare(`
      INSERT INTO products (sku, title, description, category_id, price, stock_quantity, tags, images, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sku || null,
      title,
      description || null,
      category_id || null,
      price ?? null,
      stock_quantity !== undefined ? parseInt(stock_quantity, 10) : 0,
      tags ? JSON.stringify(tags) : null,
      images ? JSON.stringify(images) : null,
      active !== false ? 1 : 0,
    );
    return { success: true, id: info.lastInsertRowid };
  }
  if (name === 'update_product') {
    const { id, ...fields } = args;
    const sets = Object.keys(fields).map(key => `${key} = ?`).join(', ');
    const params = Object.values(fields);
    db.prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...params, id);
    return { success: true, id };
  }
  return { error: `Unknown tool: ${name}` };
}

// Shared tool definitions (used by both Gemini and Claude)
const localTools: any[] = [
  {
    name: 'web_search',
    description: 'Search the web for information, such as product descriptions, specifications, or images.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
      },
      required: ['query'],
    }
  },
  {
    name: 'search_products',
    description: 'Search for products by query, category, or price range.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword' },
        category: { type: 'string', description: 'Filter by category name' },
        min_price: { type: 'number', description: 'Minimum price' },
        max_price: { type: 'number', description: 'Maximum price' },
      }
    }
  },
  {
    name: 'batch_add_categories',
    description: 'Add multiple categories at once. Supports hierarchy via parent_name.',
    input_schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parent_name: { type: 'string' }
            },
            required: ['name']
          }
        }
      },
      required: ['categories']
    }
  },
  {
    name: 'add_product',
    description: 'Add a new product to the catalog.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Product name' },
        sku: { type: 'string', description: 'Optional unique SKU' },
        description: { type: 'string', description: 'Product description' },
        price: { type: 'number' },
        stock_quantity: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
        images: { type: 'array', items: { type: 'string' } },
        active: { type: 'boolean' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_product',
    description: 'Update an existing product by ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Product ID' },
        title: { type: 'string' },
        price: { type: 'number' },
        stock_quantity: { type: 'number' },
        active: { type: 'boolean' }
      },
      required: ['id']
    }
  }
];

// Convert to the two different formats required by the SDKs
const AI_TOOLS_CLAUDE: Anthropic.Tool[] = localTools;
const AI_TOOLS_GEMINI = {
  functionDeclarations: localTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }))
};


const AI_SYSTEM_PROMPT = `You are a helpful store management assistant for a product catalog.
You can search products, update product details, and manage categories.
Always be concise and confirm changes before making them when appropriate.`;

// ─── AI Assistant routes ─────────────────────────────────────────────────────
app.post('/api/ai/chat', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { message, history, file_data, file_mime, file_name } = req.body ?? {};
  if (!message) { res.status(400).json({ error: 'message is required.' }); return; }

  const settingsRows = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)').all(
    'gemini_api_key', 'claude_api_key', 'ai_model', 'serper_api_key'
  ) as { key: string; value: string }[];

  const settings: Record<string, string> = {};
  settingsRows.forEach(row => settings[row.key] = row.value);

  const modelId = (settings.ai_model || 'gemini-flash-latest').trim();
  const isClaude = modelId.startsWith('claude-');
  
  let processedMessage = message;
  let hasImage = false;
  let imageData = '';
  let imageMime = '';

  // ── Handle File Attachments ────────────────────────────────────────────────
  if (file_data && file_mime) {
    if (file_mime.startsWith('image/')) {
      hasImage = true;
      imageData = file_data;
      imageMime = file_mime;
    } else if (file_mime.includes('csv') || file_mime.includes('spreadsheet') || file_mime.includes('excel')) {
      // Parse CSV/Excel and append to prompt
      try {
        const buffer = Buffer.from(file_data, 'base64');
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csvData = xlsx.utils.sheet_to_csv(worksheet);
        
        processedMessage += `

[Context from attached file "${file_name}":]
${csvData}`;
        console.log(`[AI Chat] Appended ${csvData.length} bytes of CSV data from ${file_name}`);
      } catch (e: any) {
        console.error('File parsing error:', e);
        processedMessage += `

[Error reading file "${file_name}": ${e.message}]`;
      }
    }
  }

  console.log(`[AI Chat] Using model: ${modelId} ${hasImage ? '(with image)' : ''}`);

  try {
    // ── Claude path ──────────────────────────────────────────────────────────
    if (isClaude) {
      const claudeApiKey = settings.claude_api_key;
      if (!claudeApiKey) {
        res.status(400).json({ error: 'Claude API key is not configured. Add it in Settings → AI Assistant.' });
        return;
      }

      const anthropic = new Anthropic({ apiKey: claudeApiKey });

      // Convert history to Claude message format
      const claudeMessages: Anthropic.MessageParam[] = (history || []).map((h: any) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      }));

      // Add current message (with image if provided)
      const currentContent: any[] = [{ type: 'text', text: processedMessage }];
      if (hasImage) {
        currentContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMime,
            data: imageData,
          },
        });
      }
      claudeMessages.push({ role: 'user', content: currentContent });

      let response = await anthropic.messages.create({
        model: modelId,
        max_tokens: 1024,
        system: AI_SYSTEM_PROMPT,
        tools: AI_TOOLS_CLAUDE,
        messages: claudeMessages,
      });

      // Agentic tool-use loop
      while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          console.log(`[AI Chat] Claude calling tool: ${block.name} with args:`, block.input);
          const result = await executeAiTool(block.name, block.input);
          console.log(`[AI Chat] Tool ${block.name} result:`, JSON.stringify(result).slice(0, 200) + '...');
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
        
        claudeMessages.push({ role: 'assistant', content: response.content });
        claudeMessages.push({ role: 'user', content: toolResults });

        response = await anthropic.messages.create({
          model: modelId,
          max_tokens: 1024,
          system: AI_SYSTEM_PROMPT,
          tools: AI_TOOLS_CLAUDE,
          messages: claudeMessages,
        });
      }

      const textContent = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined;
      const replyText = textContent?.text ?? '';
      console.log(`[AI Chat] Claude final reply: ${replyText.slice(0, 100)}...`);
      res.json({
        text: replyText,
        history: [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: replyText }],
      });
      return;
    }

    // ── Gemini path ──────────────────────────────────────────────────────────
    const geminiApiKey = settings.gemini_api_key;

    if (!geminiApiKey) {
      res.status(400).json({ error: 'AI Assistant is not connected. Please add a Gemini or Claude API key in Settings.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    const model = genAI.getGenerativeModel({
      model: modelId,
      tools: [AI_TOOLS_GEMINI],
    });

    const chat = model.startChat({
      history: (history || []).map((h: any) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }))
    });

    // For Gemini, we send message and image as separate parts
    const msgParts: any[] = [{ text: processedMessage }];
    if (hasImage) {
      msgParts.push({
        inlineData: {
          mimeType: imageMime,
          data: imageData
        }
      });
    }

    let result = await chat.sendMessage(msgParts);
    let geminiResponse = await result.response;
    let calls = geminiResponse.functionCalls();

    // Loop for multi-round tool use in Gemini
    while (calls && calls.length > 0) {
      const toolResults = [];
      for (const call of calls) {
        console.log(`[AI Chat] Gemini calling tool: ${call.name} with args:`, call.args);
        const res = await executeAiTool(call.name, call.args);
        console.log(`[AI Chat] Tool ${call.name} result:`, JSON.stringify(res).slice(0, 200) + '...');
        toolResults.push({
          functionResponse: {
            name: call.name,
            response: { content: res }
          }
        });
      }
      
      result = await chat.sendMessage(toolResults);
      geminiResponse = await result.response;
      calls = geminiResponse.functionCalls();
    }

    const replyText = geminiResponse.text();
    console.log(`[AI Chat] Gemini final reply: ${replyText.slice(0, 100)}...`);
    res.json({ text: replyText, history: [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: replyText }] });

  } catch (err: any) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ error: err.message || 'An error occurred during AI chat.' });
  }
});

app.get('/api/ai/models', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
  if (!row || !row.value) {
    res.status(400).json({ error: 'Gemini API Key is not configured.' });
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${row.value}`);
    if (!response.ok) {
      const errData = await response.json() as any;
      throw new Error(errData.error?.message || 'Failed to fetch models from Google.');
    }
    const data = await response.json() as any;
    
    // Filter for the chat-capable models
    const discovered = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName,
        description: m.description
      }));
    
    // Recommendations for labeling and sorting
    const recommended = [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Newest)' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-flash-latest', label: 'Gemini Flash (Stable)' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-pro-latest', label: 'Gemini Pro (Most Capable)' }
    ];
    
    const finalModels = discovered.map((m: { id: string; name: any; }) => {
      const rec = recommended.find(r => r.id === m.id || m.id.startsWith(r.id));
      return {
        ...m,
        name: rec ? rec.label : m.name // Use friendly label if known, otherwise raw name
      };
    });

    // Sort: recommended first, then others
    finalModels.sort((a: { id: string; }, b: { id: string; }) => {
      const aRec = recommended.findIndex(r => a.id.startsWith(r.id));
      const bRec = recommended.findIndex(r => b.id.startsWith(r.id));
      if (aRec !== -1 && bRec !== -1) return aRec - bRec;
      if (aRec !== -1) return -1;
      if (bRec !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    res.json({ models: finalModels });
  } catch (err: any) {
    console.error('Model Discovery Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Claude model discovery ───────────────────────────────────────────────────
app.get('/api/ai/models/claude', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('claude_api_key') as { value: string } | undefined;
  if (!row || !row.value) {
    res.status(400).json({ error: 'Claude API key is not configured.' });
    return;
  }

  // Claude models are stable — return curated list verified against the API key
  try {
    const anthropic = new Anthropic({ apiKey: row.value });
    // Lightweight check: list models (SDK v0.27+) or fall back to curated list
    let models: { id: string; name: string; description: string }[] = [];
    try {
      // @ts-ignore — models.list() available in newer SDK versions
      const listed = await anthropic.models.list();
      models = (listed.data ?? [])
        .filter((m: any) => m.id.startsWith('claude-'))
        .map((m: any) => ({ id: m.id, name: m.display_name ?? m.id, description: '' }));
    } catch {
      // Fall back to well-known models if list() not available
    }

    if (!models.length) {
      models = [
        { id: 'claude-opus-4-5', name: 'Claude Opus 4.5 (Most Capable)', description: 'Best for complex reasoning and catalog analysis' },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5 (Recommended)', description: 'Fast and capable — ideal for catalog management' },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Fastest)', description: 'Lightweight and quick for simple updates' },
      ];
    }

    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Claude account info ──────────────────────────────────────────────────────
app.get('/api/ai/account/claude', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('claude_api_key') as { value: string } | undefined;
  if (!row?.value) { res.json({ connected: false }); return; }

  try {
    // Validate key by making a minimal API call
    const anthropic = new Anthropic({ apiKey: row.value });
    await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    res.json({ connected: true, platform: 'Anthropic', status: 'Active' });
  } catch (err: any) {
    const isAuthError = err.status === 401;
    res.status(isAuthError ? 401 : 500).json({
      connected: false,
      error: isAuthError ? 'Invalid API key' : err.message,
    });
  }
});

app.get('/api/ai/account', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
  if (!row || !row.value) {
    res.json({ connected: false });
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${row.value}`);
    if (response.ok) {
       res.json({ 
         connected: true, 
         platform: 'Google Gemini',
         account_hint: 'AI Studio Project',
         status: 'Active'
       });
    } else {
       res.status(401).json({ connected: false, error: 'Invalid API Key' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// Stats endpoint for dashboard
app.get('/api/stats', requireAuth, (_req: Request, res: Response): void => {
  const products = (db.prepare("SELECT COUNT(*) as n FROM products WHERE active=1").get() as { n: number }).n;
  const categories = (db.prepare("SELECT COUNT(*) as n FROM categories").get() as { n: number }).n;
  const promotions = (db.prepare("SELECT COUNT(*) as n FROM promotions WHERE active=1").get() as { n: number }).n;
  const reviews = (db.prepare("SELECT COUNT(*) as n FROM reviews").get() as { n: number }).n;
  const gwRow = db.prepare("SELECT value FROM settings WHERE key='gateway_key'").get() as { value: string } | undefined;

  res.json({ products, categories, promotions, reviews, gateway_connected: !!(gwRow?.value) });
});

// ─── Fallback to admin SPA ────────────────────────────────────────────────────
app.get('*', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  initSchema();
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`
⚡  Prompt Commerce Admin`);
    console.log(`   Admin panel : http://localhost:${PORT}`);
    console.log(`   Default login: ${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('');
  });
})();
