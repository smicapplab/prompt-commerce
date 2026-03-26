import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAuth, requireStoreRole } from '$lib/server/auth.js';
import { apiError } from '$lib/server/response.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const db = getStoreDb(store);
	const categories = db.prepare(`
		SELECT c.*, p.name as parent_name
		FROM categories c
		LEFT JOIN categories p ON c.parent_id = p.id
		WHERE c.deleted_at IS NULL
		ORDER BY c.name
	`).all() as any[];

	return json(categories);
};

export const POST: RequestHandler = async (event) => {
	const store = event.url.searchParams.get('store');
	const auth = await requireStoreRole(event, store, ['merchandising']);
	if (auth instanceof Response) return auth;

	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const body = await event.request.json();
	const { name, parent_id } = body;
	if (!name) return apiError(400, 'name is required');

	// SEC-7: Numeric validation for parent_id
	if (parent_id != null && (!Number.isFinite(parent_id) || parent_id < 0)) {
		return apiError(400, 'Invalid parent_id');
	}

	const db = getStoreDb(store);

	const existing = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(name);
	if (existing) return apiError(400, 'Category with this name already exists');

	const now = new Date().toISOString();
	const result = db.prepare(`INSERT INTO categories (name, parent_id, created_at) VALUES (?, ?, ?)`).run(
		name,
		parent_id || null,
		now
	);

	const category = db.prepare(`
		SELECT c.*, p.name as parent_name
		FROM categories c
		LEFT JOIN categories p ON c.parent_id = p.id
		WHERE c.id = ?
	`).get(result.lastInsertRowid) as any;

	return json(category, { status: 201 });
};
