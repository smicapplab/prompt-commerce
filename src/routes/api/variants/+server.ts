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
		active: !!v.active
	}));

	return json({ variants });
};

export const POST: RequestHandler = async (event: RequestEvent) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising', 'store_admin', 'admin']);
	if (auth instanceof Response) return auth;
	if (!store) return apiError(400, 'store is required');

	const body = await event.request.json().catch(() => null);
	if (!body) return apiError(400, 'Invalid JSON body');

	const { product_id, sku, price, stock, active, attributes, images, is_always_available } = body;

	if (!product_id) return apiError(400, 'product_id is required');
	if (price === undefined || price < 0) return apiError(400, 'Invalid price');
	if (stock === undefined || stock < 0) return apiError(400, 'Invalid stock');

	const db = getStoreDb(store);
	const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
	if (!product) return apiError(404, 'Product not found');

	const result = db.prepare(`
		INSERT INTO product_variants (product_id, sku, price, stock, active, attributes, images, is_always_available)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		product_id,
		sku || null,
		price,
		stock,
		active === false ? 0 : 1,
		JSON.stringify(attributes || {}),
		JSON.stringify(images || []),
		is_always_available ? 1 : 0
	);

	db.prepare('UPDATE products SET is_synced = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), product_id);

	const newVariant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(result.lastInsertRowid) as any;
	
	return json({
		...newVariant,
		attributes: newVariant.attributes ? JSON.parse(newVariant.attributes) : {},
		active: !!newVariant.active
	}, { status: 201 });
};
