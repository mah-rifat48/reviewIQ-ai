import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class RouteHitStoreService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS route_hits (
        user_id TEXT NOT NULL,
        route_path TEXT NOT NULL,
        hit_count INTEGER DEFAULT 0,
        last_hit_at TEXT,
        PRIMARY KEY (user_id, route_path)
      )
    `);

    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS route_hit_events (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        route_path TEXT,
        created_at TEXT
      )
    `);

    try {
      await this.dbService.run('ALTER TABLE route_hit_events ADD COLUMN IF NOT EXISTS user_id TEXT');
      await this.dbService.run('ALTER TABLE route_hit_events ADD COLUMN IF NOT EXISTS route_path TEXT');
      await this.dbService.run('ALTER TABLE route_hit_events ADD COLUMN IF NOT EXISTS created_at TEXT');
    } catch {
      // Ignore if alter table is not supported or column exists
    }

    try {
      await this.dbService.run(
        'CREATE INDEX IF NOT EXISTS idx_route_hit_events_user_route ON route_hit_events(user_id, route_path, created_at)',
      );
    } catch {
      // Safe catch for index creation
    }
  }

  async incrementAndGetHitCount(userId: string, routePath: string): Promise<number> {
    const now = new Date().toISOString();
    await this.dbService.run(
      `INSERT INTO route_hits (user_id, route_path, hit_count, last_hit_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, route_path) DO UPDATE SET
         hit_count = route_hits.hit_count + 1,
         last_hit_at = EXCLUDED.last_hit_at`,
      [userId, routePath, now],
    );

    await this.dbService.run(
      `INSERT INTO route_hit_events (user_id, route_path, created_at)
       VALUES (?, ?, ?)`,
      [userId, routePath, now],
    );

    const row = await this.dbService.get<{ hit_count: number }>(
      'SELECT hit_count FROM route_hits WHERE user_id = ? AND route_path = ?',
      [userId, routePath],
    );

    return row ? Number(row.hit_count) : 1;
  }
}
