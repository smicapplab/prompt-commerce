import { Inject, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { DATABASE } from '../db/db.module';

export interface KeysSnapshot {
  llm_api_key: string | null;
  gateway_key: string | null;
}

@Injectable()
export class KeysService {
  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  private getSetting(key: string): string | null {
    const row = this.db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private upsertSetting(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value);
  }

  /** Returns both keys (masking the LLM API key except the last 4 chars). */
  getKeys(): KeysSnapshot & { llm_api_key_masked: string | null } {
    const llm = this.getSetting('llm_api_key');
    const gw = this.getSetting('gateway_key');

    return {
      llm_api_key: llm,
      llm_api_key_masked: llm
        ? `${'*'.repeat(Math.max(0, llm.length - 4))}${llm.slice(-4)}`
        : null,
      gateway_key: gw,
    };
  }

  /** Save or update the LLM API key. */
  setLlmApiKey(key: string): void {
    this.upsertSetting('llm_api_key', key);
  }

  /**
   * Generate a new cryptographically-random gateway key and persist it.
   * Overwrites any existing gateway key.
   */
  generateGatewayKey(): string {
    const key = `gk_${crypto.randomBytes(24).toString('hex')}`;
    this.upsertSetting('gateway_key', key);
    return key;
  }

  /** Revoke the gateway key (sets it to empty — re-opens access until a new key is generated). */
  revokeGatewayKey(): void {
    this.db
      .prepare(`DELETE FROM settings WHERE key = 'gateway_key'`)
      .run();
  }
}
