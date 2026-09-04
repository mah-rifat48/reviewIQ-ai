import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class BusinessContextStoreService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS business_contexts (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        primary_place_id TEXT NOT NULL,
        place_ids TEXT NOT NULL,
        competitor_place_ids TEXT NOT NULL,
        business_name TEXT,
        business_address TEXT,
        business_category TEXT,
        report_frequency TEXT,
        goals TEXT NOT NULL,
        raw_input TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    await this.dbService.run(
      'CREATE INDEX IF NOT EXISTS idx_business_contexts_user_created ON business_contexts(user_id, created_at, id)',
    );
    await this.dbService.run(
      'CREATE INDEX IF NOT EXISTS idx_business_contexts_primary_place ON business_contexts(primary_place_id)',
    );
  }

  async saveBusinessContext(payload: {
    user_id?: string;
    primary_place_id: string;
    place_ids: string[];
    competitor_place_ids: string[];
    business_name?: string;
    business_address?: string;
    business_category?: string;
    report_frequency?: string;
    goals: string[];
    raw_input?: any;
  }): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.dbService.run(
      `INSERT INTO business_contexts (
        user_id, primary_place_id, place_ids, competitor_place_ids,
        business_name, business_address, business_category, report_frequency,
        goals, raw_input, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        payload.user_id || null,
        payload.primary_place_id,
        JSON.stringify(payload.place_ids || []),
        JSON.stringify(payload.competitor_place_ids || []),
        payload.business_name || null,
        payload.business_address || null,
        payload.business_category || null,
        payload.report_frequency || null,
        JSON.stringify(payload.goals || []),
        JSON.stringify(payload.raw_input || {}),
        now,
      ],
    );

    return result.lastID || 1;
  }

  async getLatestBusinessContext(placeId: string, userId?: string): Promise<any | null> {
    let row: any = null;
    if (userId) {
      row = await this.dbService.get(
        `SELECT * FROM business_contexts
         WHERE user_id = ? AND primary_place_id = ?
         ORDER BY id DESC LIMIT 1`,
        [userId, placeId],
      );
    }
    if (!row) {
      row = await this.dbService.get(
        `SELECT * FROM business_contexts
         WHERE primary_place_id = ?
         ORDER BY id DESC LIMIT 1`,
        [placeId],
      );
    }
    if (!row) return null;

    return {
      ...row,
      place_ids: JSON.parse(row.place_ids || '[]'),
      competitor_place_ids: JSON.parse(row.competitor_place_ids || '[]'),
      goals: JSON.parse(row.goals || '[]'),
      raw_input: JSON.parse(row.raw_input || '{}'),
    };
  }

  async updateBusinessContextGoals(
    contextId: number,
    competitorPlaceIds: string[],
    goals: string[],
    goalsInput: any,
  ): Promise<any | null> {
    const row = await this.dbService.get(
      'SELECT * FROM business_contexts WHERE id = ?',
      [contextId],
    );
    if (!row) return null;

    let rawInputObj: any = {};
    try {
      rawInputObj = JSON.parse(row.raw_input || '{}');
    } catch {}

    const businessSetup = rawInputObj.business_setup || rawInputObj;
    const updatedRawInput = {
      business_setup: businessSetup,
      goals_setup: goalsInput,
    };

    await this.dbService.run(
      `UPDATE business_contexts
       SET competitor_place_ids = ?, goals = ?, raw_input = ?
       WHERE id = ?`,
      [
        JSON.stringify(competitorPlaceIds),
        JSON.stringify(goals),
        JSON.stringify(updatedRawInput),
        contextId,
      ],
    );

    return {
      ...row,
      competitor_place_ids: competitorPlaceIds,
      goals,
      raw_input: updatedRawInput,
      place_ids: JSON.parse(row.place_ids || '[]'),
    };
  }
}
