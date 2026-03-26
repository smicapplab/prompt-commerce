import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getStoreDb } from '../../../../lib/server/db.js';
import { apiError } from '../../../../lib/server/response.js';
import { filterSecureImageUrls } from '../../../../lib/server/images.js';
import { validateImageFile, saveUploadedFile } from '../../../../lib/server/uploads.js';
import { requireStoreRole } from '../../../../lib/server/auth.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

export const GET: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	if (!store) return apiError(400, 'store is required');

	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	const id = event.params.id;
	const db = getStoreDb(store);
	const product = db.prepare(`
		SELECT p.*, c.name AS category_name
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.id = ?
	`).get(id) as any;

	if (!product) return apiError(404, 'Product not found');

	return json({
		...product,
		images: product.images ? JSON.parse(product.images) : [],
		tags: product.tags ? JSON.parse(product.tags) : []
	});
};

export const PATCH: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	if (!store) return apiError(400, 'store is required');

	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	const id = event.params.id;
	const db = getStoreDb(store);
	const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
	if (!existing) return json({ error: 'Product not found' }, { status: 404 });

	const formData = await event.request.formData();

	const title = formData.get('title') as string;
	const sku = formData.get('sku') as string;
	const description = formData.get('description') as string;
	const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null;
	const stock_quantity = formData.get('stock_quantity')
		? parseInt(formData.get('stock_quantity') as string)
		: null;
	const category_id = formData.get('category_id')
		? parseInt(formData.get('category_id') as string)
		: null;
	const tagsStr = formData.get('tags') as string;
	const active = formData.get('active') ? (formData.get('active') as string) === '1' ? 1 : 0 : null;

	const imageFiles = formData.getAll('images[]') as File[];
	const imageUrls = (formData.get('images_urls') as string) ?? '';
	const uploadedImages: string[] = [];

	for (const file of imageFiles) {
		if (file.size === 0) continue;
		const validationError = validateImageFile(file);
		if (validationError) return apiError(422, validationError);
		const imgPath = await saveUploadedFile(file);
		uploadedImages.push(imgPath);
	}

	const existingImages = imageUrls.split(',').map((u) => u.trim()).filter(Boolean);
	const validatedExistingImages = filterSecureImageUrls(existingImages);

	const allImages = [...validatedExistingImages, ...uploadedImages];
	const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : null;

	const updates: string[] = [];
	const values: any[] = [];

	if (title !== null) { updates.push('title = ?'); values.push(title); }
	if (sku !== null) { updates.push('sku = ?'); values.push(sku); }
	if (description !== null) { updates.push('description = ?'); values.push(description); }
	if (price !== null) { updates.push('price = ?'); values.push(price); }
	if (stock_quantity !== null) { updates.push('stock_quantity = ?'); values.push(stock_quantity); }
	if (category_id !== null) { updates.push('category_id = ?'); values.push(category_id); }
	if (tags !== null) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
	if (allImages.length > 0 || imageUrls !== '') { updates.push('images = ?'); values.push(JSON.stringify(allImages)); }
	if (active !== null) { updates.push('active = ?'); values.push(active); }

	if (updates.length > 0) {
		updates.push('is_synced = 0');
		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(id);
		db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);
	}

	const product = db.prepare(`
		SELECT p.*, c.name AS category_name
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.id = ?
	`).get(id) as any;

	return json({
		...product,
		images: product.images ? JSON.parse(product.images) : [],
		tags: product.tags ? JSON.parse(product.tags) : []
	});
};

export const DELETE: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	const id = event.params.id;
	const db = getStoreDb(store);
	const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
	if (!existing) return apiError(404, 'Product not found');

	// Soft delete — preserves the row so the next delta sync can tell the gateway to remove it
	db.prepare(`
		UPDATE products SET deleted_at = datetime('now'), is_synced = 0, active = 0, updated_at = ?
		WHERE id = ?
	`).run(new Date().toISOString(), id);
	return new Response(null, { status: 204 });
};
