import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getStoreDb } from '../../../lib/server/db.js';
import { apiError } from '../../../lib/server/response.js';
import { filterSecureImageUrls } from '../../../lib/server/images.js';
import { validateImageFile, saveUploadedFile } from '../../../lib/server/uploads.js';
import { requireStoreRole } from '../../../lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	if (!store) return apiError(400, 'store is required');

	// SEC-8: Clamp pagination parameters
	const rawPage = parseInt(event.url.searchParams.get('page') ?? '1');
	const rawLimit = parseInt(event.url.searchParams.get('limit') ?? '20');
	const page = Math.min(Math.max(1, isNaN(rawPage) ? 1 : rawPage), 500);
	const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 200);
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

	if (!store) return apiError(400, 'store is required');

	const formData = await event.request.formData();

	const title = formData.get('title') as string;
	const sku = formData.get('sku') as string;
	const description = formData.get('description') as string;

	// SEC-7: Numeric bounds and NaN checks
	const priceRaw = formData.get('price') as string;
	const price = priceRaw ? parseFloat(priceRaw) : null;
	if (priceRaw && (price === null || isNaN(price) || price < 0)) {
		return apiError(400, 'Invalid price: must be a non-negative number');
	}

	const stockRaw = formData.get('stock_quantity') as string;
	const stock_quantity = stockRaw ? parseInt(stockRaw) : 0;
	if (stockRaw && (isNaN(stock_quantity) || stock_quantity < 0)) {
		return apiError(400, 'Invalid stock_quantity: must be a non-negative integer');
	}

	const catIdRaw = formData.get('category_id') as string;
	const category_id = catIdRaw ? parseInt(catIdRaw) : null;
	if (catIdRaw && (category_id === null || isNaN(category_id) || category_id < 0)) {
		return apiError(400, 'Invalid category_id');
	}
	const tagsStr = formData.get('tags') as string;
	const active = (formData.get('active') as string) === '1' ? 1 : 0;

	if (!title) return apiError(400, 'title is required');

	const db = getStoreDb(store);
	if (category_id !== null) {
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
		const imgPath = await saveUploadedFile(file);
		uploadedImages.push(imgPath);
	}

	const existingImages = imageUrls.split(',').map((u) => u.trim()).filter(Boolean);
	const validatedExistingImages = filterSecureImageUrls(existingImages);

	const allImages = [...validatedExistingImages, ...uploadedImages];
	const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

	const result = db.prepare(`
		INSERT INTO products (title, sku, description, price, stock_quantity, category_id, images, tags, active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		title,
		sku || null,
		description || null,
		price ?? null,
		stock_quantity,
		category_id ?? null,
		JSON.stringify(allImages),
		JSON.stringify(tags),
		active
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
