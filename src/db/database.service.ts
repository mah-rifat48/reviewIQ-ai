import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString =
      this.configService.get<string>('DATABASE_URL') ||
      'postgresql://aimalya_user:secure_password_here@localhost:5433/aimalya_db?schema=public';

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await this.pool.connect();
      client.release();
    } catch (err: any) {
      console.error(
        `\n❌ [DatabaseService] Could not connect to PostgreSQL at ${connectionString}.` +
          `\n👉 Ensure the PostgreSQL container is running! Run:` +
          `\n   cd "f:\\My All Project\\aimalya\\amaliya-backend"` +
          `\n   docker compose --profile dev up -d\n`,
      );
      throw err;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  private convertSql(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  async run(sql: string, params: any[] = []): Promise<{ rowCount: number; rows: any[]; lastID?: number; changes?: number }> {
    const converted = this.convertSql(sql);
    const res = await this.pool.query(converted, params);
    const lastID = res.rows && res.rows[0] && res.rows[0].id ? Number(res.rows[0].id) : undefined;
    return {
      rowCount: res.rowCount || 0,
      changes: res.rowCount || 0,
      rows: res.rows || [],
      lastID,
    };
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const converted = this.convertSql(sql);
    const res = await this.pool.query(converted, params);
    return res.rows && res.rows[0] ? (res.rows[0] as T) : undefined;
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const converted = this.convertSql(sql);
    const res = await this.pool.query(converted, params);
    return (res.rows || []) as T[];
  }
}
