import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const GET: RequestHandler = async (event) => {
	const authResult = await requireAuth(event);
	if (authResult instanceof Response) return authResult;

	const store = event.url.searchParams.get('store');
	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const db = getStoreDb(store);
	const categories = db.prepare(`
		SELECT c.*, p.name as parent_name
		FROM categories c
		LEFT JOIN categories p ON c.parent_id = p.id
		ORDER BY c.name
	`).all() as any[];

	return json(categories);
};

export const POST: RequestHandler = async (event) => {
	const authResult = await requireAuth(event);
	if (authResult instanceof Response) return authResult;

	const store = event.url.searchParams.get('store');
	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const body = await event.request.json();
	const { name, parent_id } = body;
	if (!name) return json({ error: 'name is required' }, { status: 400 });

	const db = getStoreDb(store);

	const existing = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(name);
	if (existing) return json({ error: 'Category with this name already exists' }, { status: 400 });

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
