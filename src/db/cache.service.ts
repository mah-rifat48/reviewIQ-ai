import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';
import * as crypto from 'crypto';

@Injectable()
export class CacheService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS llm_cache (
        cache_key TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  makeCacheKey(
    kind: string,
    model: string,
    promptVersion: string,
    inputObj: Record<string, any>,
  ): string {
    const sortedObj = this.sortObjectKeys(inputObj);
    const raw = JSON.stringify(sortedObj);
    const digest = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
    return `${kind}:${model}:${promptVersion}:${digest}`;
  }

  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObjectKeys(item));
    }
    return Object.keys(obj)
      .sort()
      .reduce((acc: Record<string, any>, key: string) => {
        acc[key] = this.sortObjectKeys(obj[key]);
        return acc;
      }, {});
  }

  async getCachedResponse<T = any>(cacheKey: string): Promise<T | null> {
    const row = await this.dbService.get<{ payload: string }>(
      'SELECT payload FROM llm_cache WHERE cache_key = ?',
      [cacheKey],
    );
    if (!row || !row.payload) {
      return null;
    }
    try {
      return JSON.parse(row.payload);
    } catch {
      return null;
    }
  }

  async setCachedResponse(
    cacheKey: string,
    payload: any,
    kind: string,
    model: string,
    promptVersion: string,
  ): Promise<void> {
    const payloadStr = JSON.stringify(payload);
    const createdAt = new Date().toISOString();
    await this.dbService.run(
      `INSERT INTO llm_cache
       (cache_key, kind, model, prompt_version, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         kind = EXCLUDED.kind,
         model = EXCLUDED.model,
         prompt_version = EXCLUDED.prompt_version,
         payload = EXCLUDED.payload,
         created_at = EXCLUDED.created_at`,
      [cacheKey, kind, model, promptVersion, payloadStr, createdAt],
    );
  }
}
