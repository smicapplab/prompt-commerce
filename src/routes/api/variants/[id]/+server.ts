import { json, type RequestHandler, type RequestEvent } from '@sveltejs/kit';
import { getStoreDb } from '../../../../lib/server/db.js';
import { apiError } from '../../../../lib/server/response.js';
import { requireStoreRole } from '../../../../lib/server/auth.js';

export const PATCH: RequestHandler = async (event: RequestEvent) => {
	const store = event.url.searchParams.get('store');
	if (!store) return apiError(400, 'store is required');

	const auth = await requireStoreRole(event, store, ['merchandising', 'store_admin', 'admin']);
	if (auth instanceof Response) return auth;

	const id = event.params.id;
	const db = getStoreDb(store);
	const existing = db.prepare(`SELECT * FROM product_variants WHERE id = ?`).get(id) as any;
	if (!existing) return json({ error: 'Variant not found' }, { status: 404 });

	const body = await event.request.json().catch(() => null);
	if (!body) return apiError(400, 'Invalid JSON body');

	const updates: string[] = [];
	const values: any[] = [];

	if (body.sku !== undefined) { updates.push('sku = ?'); values.push(body.sku || null); }
	if (body.price !== undefined) { 
		if (body.price < 0) return apiError(400, 'Invalid price');
		updates.push('price = ?'); values.push(body.price); 
	}
	if (body.stock !== undefined) { 
		if (body.stock < 0) return apiError(400, 'Invalid stock');
		updates.push('stock = ?'); values.push(body.stock); 
	}
	if (body.active !== undefined) { updates.push('active = ?'); values.push(body.active ? 1 : 0); }
	if (body.attributes !== undefined) { updates.push('attributes = ?'); values.push(JSON.stringify(body.attributes)); }
	if (body.images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(body.images)); }
	if (body.is_always_available !== undefined) { updates.push('is_always_available = ?'); values.push(body.is_always_available ? 1 : 0); }

	if (updates.length > 0) {		updates.push('is_synced = 0');
		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(id);
		db.prepare(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = ?`).run(...values);
		
		db.prepare('UPDATE products SET is_synced = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), existing.product_id);
	}

	const updated = db.prepare(`SELECT * FROM product_variants WHERE id = ?`).get(id) as any;

	return json({
		...updated,
		attributes: updated.attributes ? JSON.parse(updated.attributes) : {},
		active: !!updated.active
	});
};

export const DELETE: RequestHandler = async (event: RequestEvent) => {
	const store = event.url.searchParams.get('store');
	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const auth = await requireStoreRole(event, store, ['merchandising', 'store_admin', 'admin']);
	if (auth instanceof Response) return auth;

	const id = event.params.id;
	const db = getStoreDb(store);
	const existing = db.prepare(`SELECT * FROM product_variants WHERE id = ?`).get(id) as any;
	if (!existing) return apiError(404, 'Variant not found');

	// Soft delete wrapper — sets active = 0, is_synced = 0
	db.prepare(`
		UPDATE product_variants SET active = 0, is_synced = 0, updated_at = ?
		WHERE id = ?
	`).run(new Date().toISOString(), id);
	
	db.prepare('UPDATE products SET is_synced = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), existing.product_id);

	return new Response(null, { status: 204 });
};
