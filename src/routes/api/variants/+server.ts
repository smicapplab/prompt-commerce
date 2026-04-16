import { json, type RequestHandler, type RequestEvent } from '@sveltejs/kit';
import { getStoreDb } from '../../../lib/server/db.js';
import { apiError } from '../../../lib/server/response.js';
import { requireStoreRole } from '../../../lib/server/auth.js';

export const GET: RequestHandler = async (event: RequestEvent) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising', 'store_admin', 'admin']);
	if (auth instanceof Response) return auth;

	if (!store) return apiError(400, 'store is required');
	const product_id = event.url.searchParams.get('product_id');
	if (!product_id) return apiError(400, 'product_id is required');

	const db = getStoreDb(store);
	const dbRows = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC').all(product_id) as any[];

	const variants = dbRows.map(v => ({
		...v,
		attributes: v.attributes ? JSON.parse(v.attributes) : {},
		images: v.images ? JSON.parse(v.images) : [],
		active: !!v.active,
		is_always_available: !!v.is_always_available
	}));

	return json({ variants });
};

export const POST: RequestHandler = async (event: RequestEvent) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising', 'store_admin', 'admin']);
	if (auth instanceof Response) return auth;
	if (!store) return apiError(400, 'store is required');

	const formData = await event.request.formData();
	const product_id = formData.get('product_id');
	const sku = formData.get('sku') as string;
	const price = parseFloat(formData.get('price') as string);
	const stock = parseInt(formData.get('stock') as string);
	const active = formData.get('active') === '1';
	const is_always_available = formData.get('is_always_available') === '1';
	const attributesRaw = formData.get('attributes') as string;
	const imagesUrlsRaw = formData.get('images_urls') as string;
	const imageFiles = formData.getAll('images[]') as File[];

	if (!product_id) return apiError(400, 'product_id is required');
	if (isNaN(price) || price < 0) return apiError(400, 'Invalid price');
	if (isNaN(stock) || stock < 0) return apiError(400, 'Invalid stock');

	const db = getStoreDb(store);
	const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
	if (!product) return apiError(404, 'Product not found');

	// Process images
	const uploadedImages: string[] = [];
	for (const file of imageFiles) {
		if (file.size === 0) continue;
		const imgPath = await (await import('../../../lib/server/uploads.js')).saveUploadedFile(file, store);
		uploadedImages.push(imgPath);
	}

	const existingImages = imagesUrlsRaw ? imagesUrlsRaw.split(',').map(u => u.trim()).filter(Boolean) : [];
	const allImages = [...existingImages, ...uploadedImages];

	const result = db.prepare(`
		INSERT INTO product_variants (product_id, sku, price, stock, active, attributes, images, is_always_available)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		product_id,
		sku || null,
		price,
		stock,
		active ? 1 : 0,
		attributesRaw || '{}',
		JSON.stringify(allImages),
		is_always_available ? 1 : 0
	);

	db.prepare('UPDATE products SET is_synced = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), product_id);

	const newVariant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(result.lastInsertRowid) as any;
	
	return json({
		...newVariant,
		attributes: newVariant.attributes ? JSON.parse(newVariant.attributes) : {},
		images: newVariant.images ? JSON.parse(newVariant.images) : [],
		active: !!newVariant.active,
		is_always_available: !!newVariant.is_always_available
	}, { status: 201 });
};
