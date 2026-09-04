import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

export function recommendationTitleKey(title: string): string {
  return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

@Injectable()
export class RecommendationStoreService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS actionable_recommendations (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        title_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unread',
        payload TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        read_at TEXT,
        UNIQUE(user_id, title_key)
      )
    `);

    await this.dbService.run(
      'CREATE INDEX IF NOT EXISTS idx_actionable_recommendations_user_status ON actionable_recommendations(user_id, status, updated_at)',
    );
  }

  async saveActionableRecommendations(userId: string, recommendations: any[]): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const rec of recommendations) {
      const title = (rec.title || '').trim();
      if (!title) continue;
      const key = recommendationTitleKey(title);
      const payloadStr = JSON.stringify(rec);

      await this.dbService.run(
        `INSERT INTO actionable_recommendations (
           user_id, title, title_key, status, payload, created_at, updated_at
         ) VALUES (?, ?, ?, 'unread', ?, ?, ?)
         ON CONFLICT(user_id, title_key) DO UPDATE SET
           title = EXCLUDED.title,
           payload = EXCLUDED.payload,
           updated_at = EXCLUDED.updated_at`,
        [userId, title, key, payloadStr, now, now],
      );
      count++;
    }
    return count;
  }

  async saveActionableRecommendationTitles(userId: string, titles: string[]): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const rawTitle of titles) {
      const title = (rawTitle || '').trim();
      if (!title) continue;
      const key = recommendationTitleKey(title);

      await this.dbService.run(
        `INSERT INTO actionable_recommendations (
           user_id, title, title_key, status, created_at, updated_at
         ) VALUES (?, ?, ?, 'unread', ?, ?)
         ON CONFLICT(user_id, title_key) DO UPDATE SET
           title = EXCLUDED.title,
           updated_at = EXCLUDED.updated_at`,
        [userId, title, key, now, now],
      );
      count++;
    }
    return count;
  }

  async getUnreadActionableRecommendations(userId: string): Promise<any[]> {
    const rows = await this.dbService.all(
      `SELECT payload FROM actionable_recommendations
       WHERE user_id = ? AND status = 'unread' AND payload IS NOT NULL
       ORDER BY updated_at DESC`,
      [userId],
    );
    return rows
      .map((r) => {
        try {
          return JSON.parse(r.payload);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  async getReadActionableRecommendationTitleKeys(userId: string): Promise<Set<string>> {
    const rows = await this.dbService.all<{ title_key: string }>(
      `SELECT title_key FROM actionable_recommendations
       WHERE user_id = ? AND status = 'read'`,
      [userId],
    );
    return new Set(rows.map((r) => r.title_key));
  }

  async updateActionableRecommendationStatus(
    userId: string,
    title: string,
    status: string,
  ): Promise<any | null> {
    if (!['unread', 'read'].includes(status)) {
      throw new Error(`Status must be 'unread' or 'read', got '${status}'`);
    }

    const key = recommendationTitleKey(title);
    const now = new Date().toISOString();
    const readAt = status === 'read' ? now : null;

    const existing = await this.dbService.get(
      'SELECT * FROM actionable_recommendations WHERE user_id = ? AND title_key = ?',
      [userId, key],
    );

    if (!existing) return null;

    await this.dbService.run(
      `UPDATE actionable_recommendations
       SET status = ?, read_at = ?, updated_at = ?
       WHERE user_id = ? AND title_key = ?`,
      [status, readAt, now, userId, key],
    );

    const payload = existing.payload ? JSON.parse(existing.payload) : {};
    return {
      title: existing.title,
      status,
      user_id: userId,
      read_at: readAt,
      ...payload,
    };
  }
}
