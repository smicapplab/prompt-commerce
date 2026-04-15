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
		SELECT p.*, c.name AS category_name,
			(SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = 1) as variant_count,
			(SELECT MIN(price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = 1) as min_price,
			(SELECT SUM(stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = 1) as total_stock
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.id = ?
	`).get(id) as any;

	if (!product) return apiError(404, 'Product not found');

	return json({
		...product,
		images: product.images ? JSON.parse(product.images) : [],
		tags: product.tags ? JSON.parse(product.tags) : [],
		metadata: product.metadata ? JSON.parse(product.metadata) : {},
		active: !!product.active
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
	const track_inventory = formData.has('track_inventory') ? (formData.get('track_inventory') as string) === '1' ? 1 : 0 : null;
	const product_type = formData.has('product_type') ? (formData.get('product_type') as string) : null;
	const metadataStr = formData.has('metadata') ? (formData.get('metadata') as string) : null;	let metadata = null;
	if (metadataStr !== null) {
		try {
			metadata = metadataStr ? JSON.parse(metadataStr) : null;
		} catch (e) {
			return apiError(400, 'Invalid metadata JSON');
		}
	}

	if (price !== null && (!Number.isFinite(price) || price < 0)) {
		return apiError(422, 'price must be a non-negative number');
	}
	if (stock_quantity !== null && (!Number.isInteger(stock_quantity) || stock_quantity < 0)) {
		return apiError(422, 'stock_quantity must be a non-negative integer');
	}
	if (category_id !== null) {
		if (isNaN(category_id) || category_id < 0) return apiError(422, 'Invalid category_id');
		const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL').get(category_id);
		if (!cat) return apiError(422, 'Category not found');
	}

	const imageFiles = formData.getAll('images[]') as File[];
	const imageUrls = (formData.get('images_urls') as string) ?? '';
	const uploadedImages: string[] = [];

	for (const file of imageFiles) {
		if (file.size === 0) continue;
		const validationError = validateImageFile(file);
		if (validationError) return apiError(422, validationError);
		const imgPath = await saveUploadedFile(file, store);
		uploadedImages.push(imgPath);
	}

	const existingImages = imageUrls ? imageUrls.split(',').map((u) => u.trim()).filter(Boolean) : [];
	const validatedExistingImages = filterSecureImageUrls(existingImages);

	const allImages = [...validatedExistingImages, ...uploadedImages];
	const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

	const updates: string[] = [];
	const values: any[] = [];

	if (title !== null) { updates.push('title = ?'); values.push(title); }
	if (sku !== null) { updates.push('sku = ?'); values.push(sku); }
	if (description !== null) { updates.push('description = ?'); values.push(description); }
	if (price !== null) { updates.push('price = ?'); values.push(price); }
	if (stock_quantity !== null) { updates.push('stock_quantity = ?'); values.push(stock_quantity); }
	if (category_id !== null) { updates.push('category_id = ?'); values.push(category_id); }
	if (formData.has('tags')) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
	if (formData.has('images_urls') || imageFiles.length > 0) { updates.push('images = ?'); values.push(JSON.stringify(allImages)); }
	if (active !== null) { updates.push('active = ?'); values.push(active); }
	if (track_inventory !== null) { updates.push('track_inventory = ?'); values.push(track_inventory); }
	if (product_type !== null) { updates.push('product_type = ?'); values.push(product_type); }
	if (metadataStr !== null) { updates.push('metadata = ?'); values.push(metadata ? JSON.stringify(metadata) : null); }

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
		tags: product.tags ? JSON.parse(product.tags) : [],
		metadata: product.metadata ? JSON.parse(product.metadata) : {},
		active: !!product.active
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
