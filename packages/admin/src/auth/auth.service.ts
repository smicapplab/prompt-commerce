import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import { DATABASE } from '../db/db.module';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly db: Database.Database,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates username + password.
   * Returns the user (without password hash) on success, or null on failure.
   */
  async validateUser(
    username: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const row = this.db
      .prepare(`SELECT id, username, password_hash, role FROM users WHERE username = ?`)
      .get(username) as UserRow | undefined;

    if (!row) return null;

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return null;

    return { id: row.id, username: row.username, role: row.role };
  }

  /** Issues a signed JWT for the given user. */
  login(user: AuthenticatedUser): { access_token: string } {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }
}
