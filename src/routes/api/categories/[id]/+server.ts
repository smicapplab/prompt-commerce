import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getStoreDb } from '$lib/server/db.js';

export const PATCH: RequestHandler = async (event) => {
	const authResult = await requireAuth(event);
	if (authResult instanceof Response) return authResult;

	const id = event.params.id;
	const store = event.url.searchParams.get('store');
	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const db = getStoreDb(store);
	const existing = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	const body = await event.request.json();
	const { name, parent_id } = body;

	const updates: string[] = [];
	const values: any[] = [];

	if (name !== undefined) { updates.push('name = ?'); values.push(name); }
	if (parent_id !== undefined) { updates.push('parent_id = ?'); values.push(parent_id || null); }
	if (updates.length === 0) return json({ error: 'No fields to update' }, { status: 400 });

	values.push(id);
	db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	const category = db.prepare(`
		SELECT c.*, p.name as parent_name
		FROM categories c
		LEFT JOIN categories p ON c.parent_id = p.id
		WHERE c.id = ?
	`).get(id) as any;

	return json(category);
};

export const DELETE: RequestHandler = async (event) => {
	const authResult = await requireAuth(event);
	if (authResult instanceof Response) return authResult;

	const id = event.params.id;
	const store = event.url.searchParams.get('store');
	if (!store) return json({ error: 'store is required' }, { status: 400 });

	const db = getStoreDb(store);
	const existing = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
	if (!existing) return json({ error: 'Category not found' }, { status: 404 });

	db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
	return new Response(null, { status: 204 });
};
