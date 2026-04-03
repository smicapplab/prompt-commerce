import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireStoreRole } from '$lib/server/auth.js';
import { getDb, getStoreDb, getUploadDir } from '$lib/server/db.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg',
  'pdf', 'xlsx', 'xls', 'docx', 'doc'
]);
const ALLOWED_MIME_PREFIXES = [
  'image/', 'application/pdf', 
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

export const GET: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const orderId = parseInt(event.params.id);
  const showDeleted = event.url.searchParams.get('show_deleted') === '1';
  
  const db = getStoreDb(store);
  let query = 'SELECT * FROM order_files WHERE order_id = ?';
  if (!showDeleted) {
    query += ' AND deleted_at IS NULL';
  }
  query += ' ORDER BY uploaded_at DESC';
  
  const files = db.prepare(query).all(orderId);
  return json(files);
};

export const POST: RequestHandler = async (event) => {
  const store = event.url.searchParams.get('store');
  const auth = await requireStoreRole(event, store, ['ops']);
  if (auth instanceof Response) return auth;

  if (!store) return json({ error: 'store is required' }, { status: 400 });

  const orderId = parseInt(event.params.id);
  const db = getStoreDb(store);

  // SEC-4: Verify order exists before writing to disk
  const existing = db.prepare('SELECT id FROM orders WHERE id = ? AND deleted_at IS NULL').get(orderId);
  if (!existing) {
    return json({ error: 'Order not found' }, { status: 404 });
  }

  const formData = await event.request.formData();
  const file = formData.get('file') as File;

  if (!file || file.size === 0) {
    return json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return json({ error: `File exceeds the 20 MB size limit.` }, { status: 422 });
  }

  const ext = getFileExtension(file.name);
  const mimeOk = ALLOWED_MIME_PREFIXES.some(p => file.type.startsWith(p));
  if (!ALLOWED_EXTENSIONS.has(ext) || !mimeOk) {
    return json({ error: `File type not allowed.` }, { status: 422 });
  }

  // ── 1. Resolve absolute base URL for the file link ────────────────────────
  const registry = getDb();
  const publicUrlSetting = (registry
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seller_public_url') as { value: string } | undefined)?.value;

  let sellerPublicUrl = process.env.SELLER_PUBLIC_URL ?? publicUrlSetting;
  
  if (sellerPublicUrl) {
    try {
      sellerPublicUrl = new URL(sellerPublicUrl).origin;
    } catch {
      sellerPublicUrl = event.url.origin;
    }
  } else {
    sellerPublicUrl = event.url.origin;
  }

  // ── 2. Save to disk ────────────────────────────────────────────────────────
  const uploadBase = getUploadDir();
  const orderFilesDir = join(uploadBase, 'orders', String(orderId));
  mkdirSync(orderFilesDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const diskFilename = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
  const filepath = join(orderFilesDir, diskFilename);
  writeFileSync(filepath, buffer);

  // ── 3. Store absolute URL ──────────────────────────────────────────────────
  const relativePath = `/uploads/orders/${orderId}/${diskFilename}`;
  const fileUrl = `${sellerPublicUrl}${relativePath}`;

  const result = db.prepare(`
    INSERT INTO order_files (
      order_id, filename, original_name, file_url, 
      mime_type, size_bytes, uploaded_by, uploaded_at, is_synced
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    orderId, diskFilename, file.name, fileUrl, 
    file.type, file.size, auth.user.username, new Date().toISOString()
  );

  // Mark order as dirty
  db.prepare('UPDATE orders SET updated_at = datetime(\'now\'), is_synced = 0 WHERE id = ?').run(orderId);

  const newFile = db.prepare('SELECT * FROM order_files WHERE id = ?').get(result.lastInsertRowid);
  return json(newFile, { status: 201 });
};
