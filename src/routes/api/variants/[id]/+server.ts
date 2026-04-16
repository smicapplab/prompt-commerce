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

	const formData = await event.request.formData();
	const updates: string[] = [];
	const values: any[] = [];

	if (formData.has('sku')) { updates.push('sku = ?'); values.push(formData.get('sku') || null); }
	if (formData.has('price')) {
		const price = parseFloat(formData.get('price') as string);
		if (isNaN(price) || price < 0) return apiError(400, 'Invalid price');
		updates.push('price = ?'); values.push(price);
	}
	if (formData.has('stock')) {
		const stock = parseInt(formData.get('stock') as string);
		if (isNaN(stock) || stock < 0) return apiError(400, 'Invalid stock');
		updates.push('stock = ?'); values.push(stock);
	}
	if (formData.has('active')) { updates.push('active = ?'); values.push(formData.get('active') === '1' ? 1 : 0); }
	if (formData.has('is_always_available')) { updates.push('is_always_available = ?'); values.push(formData.get('is_always_available') === '1' ? 1 : 0); }
	if (formData.has('attributes')) { updates.push('attributes = ?'); values.push(formData.get('attributes')); }

	// Process images if provided
	if (formData.has('images_urls') || formData.has('images[]')) {
		const imageUrlsRaw = (formData.get('images_urls') as string) || '';
		const imageFiles = formData.getAll('images[]') as File[];
		
		const uploadedImages: string[] = [];
		for (const file of imageFiles) {
			if (file.size === 0) continue;
			const imgPath = await (await import('../../../../lib/server/uploads.js')).saveUploadedFile(file, store);
			uploadedImages.push(imgPath);
		}

		const existingImages = imageUrlsRaw ? imageUrlsRaw.split(',').map(u => u.trim()).filter(Boolean) : [];
		// Note: we could use filterSecureImageUrls here if we wanted to enforce HTTPS on existing external URLs
		const allImages = [...existingImages, ...uploadedImages];
		
		updates.push('images = ?');
		values.push(JSON.stringify(allImages));
	}

	if (updates.length > 0) {
		updates.push('is_synced = 0');
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
		images: updated.images ? JSON.parse(updated.images) : [],
		active: !!updated.active,
		is_always_available: !!updated.is_always_available
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
