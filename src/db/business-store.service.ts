import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';

export interface UserBusinessRow {
  id?: number;
  user_id: string;
  context_id: number;
  business_name: string;
  business_category?: string;
  phone_no?: string;
  website?: string;
  business_address?: string;
  input_address?: string;
  place_id: string;
  place_payload: any;
  raw_input: any;
  account_status?: string;
  created_at?: string;
  updated_at?: string;
  is_suspended?: boolean;
}

@Injectable()
export class BusinessStoreService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS user_businesses (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        context_id INTEGER NOT NULL,
        business_name TEXT NOT NULL,
        business_category TEXT,
        phone_no TEXT,
        website TEXT,
        business_address TEXT,
        input_address TEXT,
        place_id TEXT NOT NULL,
        place_payload TEXT NOT NULL,
        raw_input TEXT NOT NULL,
        account_status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, place_id)
      )
    `);

    await this.dbService.run(
      'CREATE INDEX IF NOT EXISTS idx_user_businesses_user ON user_businesses(user_id, updated_at)',
    );
    await this.dbService.run(
      'CREATE INDEX IF NOT EXISTS idx_user_businesses_context ON user_businesses(context_id)',
    );
  }

  private parseRow(row: any): UserBusinessRow {
    if (!row) return null;
    return {
      ...row,
      place_payload:
        typeof row.place_payload === 'string'
          ? JSON.parse(row.place_payload || '{}')
          : row.place_payload || {},
      raw_input:
        typeof row.raw_input === 'string'
          ? JSON.parse(row.raw_input || '{}')
          : row.raw_input || {},
      account_status: row.account_status || 'active',
      is_suspended: (row.account_status || 'active') === 'suspended',
    };
  }

  async getUserBusinesses(userId: string): Promise<UserBusinessRow[]> {
    const rows = await this.dbService.all(
      'SELECT * FROM user_businesses WHERE user_id = ? ORDER BY updated_at DESC',
      [userId],
    );
    return rows.map((r) => this.parseRow(r));
  }

  async saveUserBusinesses(
    contextId: number,
    userId: string,
    businesses: any[],
  ): Promise<void> {
    const now = new Date().toISOString();
    for (const b of businesses) {
      const existing = await this.dbService.get(
        'SELECT id FROM user_businesses WHERE user_id = ? AND place_id = ?',
        [userId, b.place_id],
      );

      const placePayloadStr = JSON.stringify(b.place_payload || {});
      const rawInputStr = JSON.stringify(b.raw_input || {});

      if (existing) {
        await this.dbService.run(
          `UPDATE user_businesses
           SET context_id = ?, business_name = ?, business_category = ?,
               phone_no = ?, website = ?, business_address = ?, input_address = ?,
               place_payload = ?, raw_input = ?, updated_at = ?
           WHERE user_id = ? AND place_id = ?`,
          [
            contextId,
            b.business_name,
            b.business_category,
            b.phone_no,
            b.website,
            b.business_address,
            b.input_address,
            placePayloadStr,
            rawInputStr,
            now,
            userId,
            b.place_id,
          ],
        );
      } else {
        await this.dbService.run(
          `INSERT INTO user_businesses (
             user_id, context_id, business_name, business_category,
             phone_no, website, business_address, input_address, place_id,
             place_payload, raw_input, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            contextId,
            b.business_name,
            b.business_category,
            b.phone_no,
            b.website,
            b.business_address,
            b.input_address,
            b.place_id,
            placePayloadStr,
            rawInputStr,
            now,
            now,
          ],
        );
      }
    }
  }

  async deleteUserBusiness(
    userId: string,
    businessName: string,
    location?: string,
  ): Promise<{ user_id: string; business_name: string; location?: string; deleted_count: number } | null> {
    const businesses = await this.getUserBusinesses(userId);
    const toDelete = businesses.filter((b) => {
      if (b.business_name.toLowerCase() !== businessName.toLowerCase()) {
        return false;
      }
      if (!location) return true;
      const addr = (b.business_address || b.input_address || '').toLowerCase();
      return addr.includes(location.toLowerCase());
    });

    if (toDelete.length === 0) return null;

    for (const item of toDelete) {
      await this.dbService.run('DELETE FROM user_businesses WHERE id = ?', [item.id]);
    }

    return {
      user_id: userId,
      business_name: businessName,
      location,
      deleted_count: toDelete.length,
    };
  }

  async updateAccountStatus(
    userId: string,
    businessName: string,
    action: string,
  ): Promise<any | null> {
    const statusMap: Record<string, string> = {
      pause: 'paused',
      resume: 'active',
      suspend: 'suspended',
      activate: 'active',
    };
    const newStatus = statusMap[action.toLowerCase()];
    if (!newStatus) {
      throw new Error(`Invalid action '${action}'`);
    }

    const businesses = await this.getUserBusinesses(userId);
    const matched = businesses.find(
      (b) => b.business_name.toLowerCase() === businessName.toLowerCase(),
    );

    if (!matched) return null;

    const now = new Date().toISOString();
    await this.dbService.run(
      'UPDATE user_businesses SET account_status = ?, updated_at = ? WHERE id = ?',
      [newStatus, now, matched.id],
    );

    matched.account_status = newStatus;
    matched.is_suspended = newStatus === 'suspended';
    return matched;
  }

  async getBusinessProfile(userId: string, businessName: string, location?: string): Promise<any | null> {
    const businesses = await this.getUserBusinesses(userId);
    if (businesses.length === 0) return null;

    let match = businesses.find((b) => {
      if (b.business_name.toLowerCase() !== (businessName || '').toLowerCase()) return false;
      if (!location) return true;
      const addr = (b.business_address || b.input_address || '').toLowerCase();
      return addr.includes(location.toLowerCase()) || location.toLowerCase().includes(addr);
    });

    if (!match) {
      match = businesses.find(
        (b) => b.business_name.toLowerCase() === (businessName || '').toLowerCase(),
      );
    }
    if (!match) {
      match = businesses[0];
    }

    const place = await this.dbService.get(
      'SELECT * FROM places WHERE place_id = ?',
      [match.place_id],
    );

    return {
      user_id: userId,
      business_name: match.business_name,
      category: match.business_category || (place ? place.types : null),
      location: match.business_address || match.input_address || location || 'Default Location',
      place_id: match.place_id,
      map_url: `https://www.google.com/maps/place/?q=place_id:${match.place_id}`,
      phone_no: match.phone_no || (place ? place.formatted_phone_number : null),
      website: match.website || (place ? place.website : null),
    };
  }

  async updateBusinessProfile(
    userId: string,
    existingBusinessName: string,
    existingLocation: string,
    updates: {
      new_business_name?: string;
      category?: string;
      new_location?: string;
      place_id?: string;
      phone_no?: string;
      website?: string;
    },
  ): Promise<any | null> {
    const businesses = await this.getUserBusinesses(userId);
    if (businesses.length === 0) return null;

    let match = businesses.find((b) => {
      if (b.business_name.toLowerCase() !== (existingBusinessName || '').toLowerCase()) return false;
      if (!existingLocation) return true;
      const addr = (b.business_address || b.input_address || '').toLowerCase();
      return addr.includes(existingLocation.toLowerCase()) || existingLocation.toLowerCase().includes(addr);
    });

    if (!match) {
      match = businesses.find(
        (b) => b.business_name.toLowerCase() === (existingBusinessName || '').toLowerCase(),
      );
    }
    if (!match) {
      match = businesses[0];
    }

    const newName = updates.new_business_name || match.business_name;
    const newCategory = updates.category || match.business_category;
    const newAddr = updates.new_location || match.business_address;
    const newPlaceId = updates.place_id || match.place_id;
    const newPhone = updates.phone_no || match.phone_no;
    const newWebsite = updates.website || match.website;
    const now = new Date().toISOString();

    await this.dbService.run(
      `UPDATE user_businesses
       SET business_name = ?, business_category = ?, business_address = ?,
           place_id = ?, phone_no = ?, website = ?, updated_at = ?
       WHERE id = ?`,
      [
        newName,
        newCategory,
        newAddr,
        newPlaceId,
        newPhone,
        newWebsite,
        now,
        match.id,
      ],
    );

    return this.getBusinessProfile(userId, newName, newAddr || existingLocation);
  }
}
