import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { getStoreDb, getUploadDir } from '$lib/server/db.js';
import { writeFileSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ALLOWED_EXTENSIONS    = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

function getFileExtension(filename: string): string {
	const parts = filename.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
}

/** Returns an error string if the file is invalid, or null if OK. */
function validateImageFile(file: File): string | null {
	if (file.size > MAX_UPLOAD_BYTES) {
		return `File "${file.name}" exceeds the 10 MB size limit.`;
	}
	const mimeOk = ALLOWED_MIME_PREFIXES.some(p => file.type.startsWith(p));
	const ext    = getFileExtension(file.name);
	const extOk  = ALLOWED_EXTENSIONS.has(ext);
	if (!mimeOk || !extOk) {
		return `File "${file.name}" is not an allowed image type (jpeg, png, webp, gif, avif).`;
	}
	return null;
}

async function saveUploadedFile(file: File): Promise<string> {
	const uploadDir = getUploadDir();
	mkdirSync(uploadDir, { recursive: true });
	const buffer = Buffer.from(await file.arrayBuffer());
	// Use a safe, random filename — never use the original name to avoid path injection
	const ext      = getFileExtension(file.name);
	const filename = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
	const filepath = join(uploadDir, filename);
	writeFileSync(filepath, buffer);
	return `/uploads/${filename}`;
}

export const GET: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const page = parseInt(event.url.searchParams.get('page') ?? '1');
	const limit = parseInt(event.url.searchParams.get('limit') ?? '20');
	const q = event.url.searchParams.get('q') ?? '';
	const active = event.url.searchParams.get('active') ?? '';
	const offset = (page - 1) * limit;

	const db = getStoreDb(store);

	let query = `
		SELECT p.*, c.name AS category_name
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.deleted_at IS NULL
	`;
	const params: any[] = [];

	if (q) {
		query += ` AND (p.title LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
		const s = `%${q}%`;
		params.push(s, s, s);
	}
	if (active !== '') {
		query += ` AND p.active = ?`;
		params.push(active === '1' ? 1 : 0);
	}

	query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
	params.push(limit, offset);

	const products = db.prepare(query).all(...params) as any[];
	const parsedProducts = products.map((p) => ({
		...p,
		images: p.images ? JSON.parse(p.images) : [],
		tags: p.tags ? JSON.parse(p.tags) : []
	}));

	let countQuery = `SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL`;
	const countParams: any[] = [];
	if (q) {
		countQuery += ` AND (title LIKE ? OR sku LIKE ? OR description LIKE ?)`;
		const s = `%${q}%`;
		countParams.push(s, s, s);
	}
	if (active !== '') {
		countQuery += ` AND active = ?`;
		countParams.push(active === '1' ? 1 : 0);
	}
	const { count } = db.prepare(countQuery).get(...countParams) as any;

	return json({ products: parsedProducts, totalCount: count });
};

export const POST: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const formData = await event.request.formData();

	const title = formData.get('title') as string;
	const sku = formData.get('sku') as string;
	const description = formData.get('description') as string;
	const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null;
	const stock_quantity = formData.get('stock_quantity')
		? parseInt(formData.get('stock_quantity') as string)
		: 0;
	const category_id = formData.get('category_id')
		? parseInt(formData.get('category_id') as string)
		: null;
	const tagsStr = formData.get('tags') as string;
	const active = (formData.get('active') as string) === '1' ? 1 : 0;

	if (!title) return json({ error: 'title is required' }, { status: 400 });

	const imageFiles = formData.getAll('images[]') as File[];
	const imageUrls = (formData.get('images_urls') as string) ?? '';
	const uploadedImages: string[] = [];

	for (const file of imageFiles) {
		if (file.size === 0) continue;
		const validationError = validateImageFile(file);
		if (validationError) return json({ error: validationError }, { status: 422 });
		const imgPath = await saveUploadedFile(file);
		uploadedImages.push(imgPath);
	}

	const existingImages = imageUrls.split(',').map((u) => u.trim()).filter(Boolean);
	const allImages = [...existingImages, ...uploadedImages];
	const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

	const db = getStoreDb(store);
	const now = new Date().toISOString();

	const result = db.prepare(`
		INSERT INTO products (title, sku, description, price, stock_quantity, category_id, images, tags, active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		title,
		sku || null,
		description || null,
		price,
		stock_quantity,
		category_id,
		JSON.stringify(allImages),
		JSON.stringify(tags),
		active,
		now, now
	);

	const product = db.prepare(`
		SELECT p.*, c.name AS category_name
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.id = ?
	`).get(result.lastInsertRowid) as any;

	return json({
		...product,
		images: product.images ? JSON.parse(product.images) : [],
		tags: product.tags ? JSON.parse(product.tags) : []
	}, { status: 201 });
};
