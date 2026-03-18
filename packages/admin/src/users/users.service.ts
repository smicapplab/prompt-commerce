import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import { DATABASE } from '../db/db.module';

export interface UserRecord {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

interface UserRow extends UserRecord {
  password_hash: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  findAll(): UserRecord[] {
    return this.db
      .prepare(`SELECT id, username, role, created_at FROM users ORDER BY created_at`)
      .all() as UserRecord[];
  }

  findOne(id: number): UserRecord {
    const row = this.db
      .prepare(`SELECT id, username, role, created_at FROM users WHERE id = ?`)
      .get(id) as UserRecord | undefined;

    if (!row) throw new NotFoundException(`User ${id} not found.`);
    return row;
  }

  async create(username: string, password: string, role = 'admin'): Promise<UserRecord> {
    const existing = this.db
      .prepare(`SELECT id FROM users WHERE username = ?`)
      .get(username) as { id: number } | undefined;

    if (existing) throw new ConflictException(`Username "${username}" is already taken.`);

    const hash = await bcrypt.hash(password, 12);
    const result = this.db
      .prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`)
      .run(username, hash, role);

    return this.findOne(result.lastInsertRowid as number);
  }

  async changePassword(id: number, newPassword: string): Promise<void> {
    this.findOne(id); // throws NotFoundException if not found
    const hash = await bcrypt.hash(newPassword, 12);
    this.db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, id);
  }

  delete(id: number): void {
    // Prevent deleting the last admin account
    const count = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }
    ).n;
    if (count <= 1) {
      throw new ConflictException('Cannot delete the last admin account.');
    }
    this.findOne(id); // throws if not found
    this.db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  }
}
