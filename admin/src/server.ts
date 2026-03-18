import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import multer from 'multer';

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.ADMIN_PORT ?? '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-to-a-long-random-string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

// ─── Database ─────────────────────────────────────────────────────────────────
const DB_PATH =
  process.env.DATABASE_PATH ||
  path.resolve(__dirname, '../../../data/catalog.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
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
  const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (count > 0) return;

  const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`).run(
    DEFAULT_ADMIN_USERNAME,
    hash,
  );
  console.log(
    `   Admin seeded  : username="${DEFAULT_ADMIN_USERNAME}" — change the password after first login!`,
  );
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
app.use(express.json());

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

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.json({ access_token: token });
});

app.post('/api/auth/change-password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body ?? {};
  if (!current_password || !new_password) {
    res.status(400).json({ error: 'current_password and new_password are required.' });
    return;
  }
  if ((new_password as string).length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  const user = req as Request & { user: AdminTokenPayload };
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.user.sub) as
    | { password_hash: string }
    | undefined;
  if (!row || !(await bcrypt.compare(current_password, row.password_hash))) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const hash = await bcrypt.hash(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.user.sub);
  res.json({ ok: true });
});

// ─── Products routes ──────────────────────────────────────────────────────────
app.get('/api/products', requireAuth, (req: Request, res: Response): void => {
  const { q, active } = req.query;
  let sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (q) { sql += ' AND (p.title LIKE ? OR p.sku LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (active !== undefined) { sql += ' AND p.active = ?'; params.push(active === '1' ? 1 : 0); }
  sql += ' ORDER BY p.updated_at DESC';
  res.json(db.prepare(sql).all(...params));
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
  const { sku, title, description, category_id, price, tags, images, active } = req.body ?? {};
  if (!title) { res.status(400).json({ error: 'title is required.' }); return; }

  const info = db.prepare(`
    INSERT INTO products (sku, title, description, category_id, price, tags, images, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    sku || null,
    title,
    description || null,
    category_id || null,
    price ?? null,
    tags ? JSON.stringify(tags) : null,
    images ? JSON.stringify(images) : null,
    active !== false ? 1 : 0,
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', requireAuth, (req: Request, res: Response): void => {
  const { sku, title, description, category_id, price, tags, images, active } = req.body ?? {};

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Product not found.' }); return; }

  db.prepare(`
    UPDATE products
    SET sku=?, title=?, description=?, category_id=?, price=?,
        tags=?, images=?, active=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    sku || null,
    title,
    description || null,
    category_id || null,
    price ?? null,
    tags ? JSON.stringify(tags) : null,
    images ? JSON.stringify(images) : null,
    active !== false ? 1 : 0,
    req.params.id,
  );
  res.json({ ok: true });
});

app.delete('/api/products/:id', requireAuth, (req: Request, res: Response): void => {
  db.prepare('UPDATE products SET active=0, updated_at=datetime(\'now\') WHERE id=?').run(req.params.id);
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
  db.prepare('UPDATE products SET images=?, updated_at=datetime(\'now\') WHERE id=?').run(JSON.stringify(images), req.params.id);
  res.json({ url });
});

// ─── Categories routes ────────────────────────────────────────────────────────
app.get('/api/categories', requireAuth, (_req: Request, res: Response): void => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
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
    } else {
      result[row.key] = row.value;
    }
  }
  res.json(result);
});

app.put('/api/settings', requireAuth, (req: Request, res: Response): void => {
  const { gateway_key } = req.body ?? {};

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

  res.json({ ok: true });
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
    console.log(`\n⚡  Prompt Commerce Admin`);
    console.log(`   Admin panel : http://localhost:${PORT}`);
    console.log(`   Default login: ${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('');
  });
})();
