import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';
import * as crypto from 'crypto';

@Injectable()
export class PlaceStoreService implements OnModuleInit {
  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS places (
        place_id TEXT PRIMARY KEY,
        name TEXT,
        business_status TEXT,
        types TEXT,
        formatted_address TEXT,
        rating REAL,
        user_ratings_total INTEGER,
        price_level INTEGER,
        opening_hours_open_now INTEGER,
        opening_hours_weekday_text TEXT,
        formatted_phone_number TEXT,
        international_phone_number TEXT,
        website TEXT,
        geometry_location_lat REAL,
        geometry_location_lng REAL,
        geometry_viewport_ne_lat REAL,
        geometry_viewport_ne_lng REAL,
        geometry_viewport_sw_lat REAL,
        geometry_viewport_sw_lng REAL,
        wheelchair_accessible_entrance INTEGER,
        serves_vegetarian_food INTEGER,
        takeout INTEGER,
        dine_in INTEGER,
        delivery INTEGER,
        updated_at TEXT
      )
    `);

    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        place_id TEXT NOT NULL,
        height INTEGER,
        width INTEGER,
        photo_reference TEXT UNIQUE,
        html_attributions TEXT
      )
    `);

    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        place_id TEXT NOT NULL,
        author_name TEXT,
        rating INTEGER,
        text TEXT,
        time BIGINT,
        relative_time_description TEXT,
        language TEXT,
        review_hash TEXT UNIQUE
      )
    `);

    await this.dbService.run(`
      CREATE TABLE IF NOT EXISTS place_rating_snapshots (
        id SERIAL PRIMARY KEY,
        place_id TEXT NOT NULL,
        rating REAL,
        user_ratings_total INTEGER,
        recorded_at TEXT NOT NULL
      )
    `);

    await this.dbService.run(
      'CREATE INDEX IF NOT EXISTS idx_place_rating_snapshots_place_recorded ON place_rating_snapshots(place_id, recorded_at)',
    );
  }

  async getPlaceData(placeId: string): Promise<any | null> {
    const place = await this.dbService.get<any>(
      'SELECT * FROM places WHERE place_id = ?',
      [placeId],
    );
    if (!place) return null;

    const photos = await this.dbService.all(
      'SELECT * FROM photos WHERE place_id = ?',
      [placeId],
    );

    const reviews = await this.dbService.all(
      'SELECT * FROM reviews WHERE place_id = ? ORDER BY time DESC',
      [placeId],
    );

    return {
      ...place,
      opening_hours_weekday_text: place.opening_hours_weekday_text
        ? JSON.parse(place.opening_hours_weekday_text)
        : [],
      photos: photos.map((p) => ({
        ...p,
        html_attributions: p.html_attributions
          ? JSON.parse(p.html_attributions)
          : [],
      })),
      reviews: reviews.map((r) => ({
        author_name: r.author_name,
        rating: r.rating ? Number(r.rating) : 0,
        text: r.text,
        time: r.time ? Number(r.time) : 0,
        relative_time_description: r.relative_time_description,
        language: r.language,
      })),
    };
  }

  async upsertPlaceData(place: any): Promise<void> {
    const now = new Date().toISOString();
    const placeId = place.place_id || place.id;

    await this.dbService.run(
      `INSERT INTO places (
        place_id, name, business_status, types, formatted_address,
        rating, user_ratings_total, price_level, opening_hours_open_now,
        opening_hours_weekday_text, formatted_phone_number, international_phone_number,
        website, geometry_location_lat, geometry_location_lng,
        wheelchair_accessible_entrance, serves_vegetarian_food, takeout,
        dine_in, delivery, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(place_id) DO UPDATE SET
        name = EXCLUDED.name,
        business_status = EXCLUDED.business_status,
        types = EXCLUDED.types,
        formatted_address = EXCLUDED.formatted_address,
        rating = EXCLUDED.rating,
        user_ratings_total = EXCLUDED.user_ratings_total,
        price_level = EXCLUDED.price_level,
        opening_hours_open_now = EXCLUDED.opening_hours_open_now,
        opening_hours_weekday_text = EXCLUDED.opening_hours_weekday_text,
        formatted_phone_number = EXCLUDED.formatted_phone_number,
        international_phone_number = EXCLUDED.international_phone_number,
        website = EXCLUDED.website,
        updated_at = EXCLUDED.updated_at`,
      [
        placeId,
        place.name,
        place.business_status,
        Array.isArray(place.types) ? place.types.join(',') : place.types,
        place.formatted_address,
        place.rating,
        place.user_ratings_total,
        place.price_level,
        place.opening_hours_open_now ? 1 : 0,
        JSON.stringify(place.opening_hours_weekday_text || []),
        place.formatted_phone_number,
        place.international_phone_number,
        place.website,
        place.geometry_location_lat || (place.location ? place.location.lat : null),
        place.geometry_location_lng || (place.location ? place.location.lng : null),
        place.wheelchair_accessible_entrance ? 1 : 0,
        place.serves_vegetarian_food ? 1 : 0,
        place.takeout ? 1 : 0,
        place.dine_in ? 1 : 0,
        place.delivery ? 1 : 0,
        now,
      ],
    );

    // Photos
    if (Array.isArray(place.photos)) {
      for (const p of place.photos) {
        if (!p.photo_reference) continue;
        await this.dbService.run(
          `INSERT INTO photos (place_id, height, width, photo_reference, html_attributions)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(photo_reference) DO UPDATE SET
             height = EXCLUDED.height,
             width = EXCLUDED.width,
             html_attributions = EXCLUDED.html_attributions`,
          [
            placeId,
            p.height,
            p.width,
            p.photo_reference,
            JSON.stringify(p.html_attributions || []),
          ],
        );
      }
    }

    // Reviews
    if (Array.isArray(place.reviews)) {
      for (const r of place.reviews) {
        const rawText = (r.text || '').trim();
        const hash = crypto
          .createHash('sha256')
          .update(`${placeId}:${r.author_name}:${r.time}:${rawText}`, 'utf8')
          .digest('hex');

        await this.dbService.run(
          `INSERT INTO reviews (
             place_id, author_name, rating, text, time, relative_time_description, language, review_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(review_hash) DO UPDATE SET
             rating = EXCLUDED.rating,
             text = EXCLUDED.text,
             relative_time_description = EXCLUDED.relative_time_description`,
          [
            placeId,
            r.author_name,
            r.rating,
            rawText,
            r.time,
            r.relative_time_description,
            r.language,
            hash,
          ],
        );
      }
    }

    // Snapshot rating
    if (place.rating !== undefined || place.user_ratings_total !== undefined) {
      await this.dbService.run(
        `INSERT INTO place_rating_snapshots (place_id, rating, user_ratings_total, recorded_at)
         VALUES (?, ?, ?, ?)`,
        [placeId, place.rating, place.user_ratings_total, now],
      );
    }
  }

  async getPlaceRatingSnapshotAtOrBefore(placeId: string, recordedAt: string): Promise<any | null> {
    return this.dbService.get(
      `SELECT * FROM place_rating_snapshots
       WHERE place_id = ? AND recorded_at <= ?
       ORDER BY recorded_at DESC LIMIT 1`,
      [placeId, recordedAt],
    );
  }
}
