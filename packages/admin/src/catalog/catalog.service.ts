import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type Database from 'better-sqlite3';
import { DATABASE } from '../db/db.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductRecord {
  id: number;
  sku: string | null;
  title: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  price: number | null;
  tags: string[];
  images: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryRecord {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

interface ProductRow {
  id: number;
  sku: string | null;
  title: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  price: number | null;
  tags: string | null;
  images: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateProductDto {
  title: string;
  description?: string;
  sku?: string;
  category_id?: number;
  price?: number;
  tags?: string[];
  images?: string[];
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  active?: boolean;
}

export interface CreateCategoryDto {
  name: string;
  parent_id?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CatalogService {
  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  private parseProduct(row: ProductRow): ProductRecord {
    return {
      ...row,
      active: Boolean(row.active),
      tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
      images: row.images ? (JSON.parse(row.images) as string[]) : [],
    };
  }

  // ── Products ────────────────────────────────────────────────────────────────

  listProducts(search?: string, categoryId?: number): ProductRecord[] {
    let sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (search) {
      sql += ` AND (p.title LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId !== undefined) {
      sql += ` AND p.category_id = ?`;
      params.push(categoryId);
    }
    sql += ` ORDER BY p.updated_at DESC`;

    return (this.db.prepare(sql).all(...params) as ProductRow[]).map((r) =>
      this.parseProduct(r),
    );
  }

  getProduct(id: number): ProductRecord {
    const row = this.db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`,
      )
      .get(id) as ProductRow | undefined;

    if (!row) throw new NotFoundException(`Product ${id} not found.`);
    return this.parseProduct(row);
  }

  createProduct(dto: CreateProductDto): ProductRecord {
    const result = this.db
      .prepare(
        `INSERT INTO products (title, description, sku, category_id, price, tags, images)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        dto.title,
        dto.description ?? null,
        dto.sku ?? null,
        dto.category_id ?? null,
        dto.price ?? null,
        dto.tags ? JSON.stringify(dto.tags) : null,
        dto.images ? JSON.stringify(dto.images) : null,
      );
    return this.getProduct(result.lastInsertRowid as number);
  }

  updateProduct(id: number, dto: UpdateProductDto): ProductRecord {
    this.getProduct(id); // throws if not found

    const sets: string[] = ['updated_at = datetime(\'now\')'];
    const params: (string | number | null)[] = [];

    if (dto.title !== undefined) { sets.push('title = ?'); params.push(dto.title); }
    if (dto.description !== undefined) { sets.push('description = ?'); params.push(dto.description); }
    if (dto.sku !== undefined) { sets.push('sku = ?'); params.push(dto.sku); }
    if (dto.category_id !== undefined) { sets.push('category_id = ?'); params.push(dto.category_id); }
    if (dto.price !== undefined) { sets.push('price = ?'); params.push(dto.price); }
    if (dto.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(dto.tags)); }
    if (dto.images !== undefined) { sets.push('images = ?'); params.push(JSON.stringify(dto.images)); }
    if (dto.active !== undefined) { sets.push('active = ?'); params.push(dto.active ? 1 : 0); }

    params.push(id);
    this.db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    return this.getProduct(id);
  }

  deleteProduct(id: number): void {
    this.getProduct(id); // throws if not found
    this.db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  listCategories(): CategoryRecord[] {
    return this.db
      .prepare(`SELECT * FROM categories ORDER BY name`)
      .all() as CategoryRecord[];
  }

  createCategory(dto: CreateCategoryDto): CategoryRecord {
    const existing = this.db
      .prepare(`SELECT id FROM categories WHERE name = ?`)
      .get(dto.name) as { id: number } | undefined;

    if (existing) throw new ConflictException(`Category "${dto.name}" already exists.`);

    const result = this.db
      .prepare(`INSERT INTO categories (name, parent_id) VALUES (?, ?)`)
      .run(dto.name, dto.parent_id ?? null);

    return this.db
      .prepare(`SELECT * FROM categories WHERE id = ?`)
      .get(result.lastInsertRowid) as CategoryRecord;
  }

  deleteCategory(id: number): void {
    const row = this.db
      .prepare(`SELECT id FROM categories WHERE id = ?`)
      .get(id) as { id: number } | undefined;

    if (!row) throw new NotFoundException(`Category ${id} not found.`);
    this.db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  }
}
