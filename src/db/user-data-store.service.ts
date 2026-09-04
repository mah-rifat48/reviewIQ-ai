import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class UserDataStoreService {
  constructor(private readonly dbService: DatabaseService) {}

  async deleteUserData(userId: string): Promise<{ user_id: string; deleted_count: number }> {
    let deletedCount = 0;

    const r1 = await this.dbService.run('DELETE FROM user_businesses WHERE user_id = ?', [userId]);
    deletedCount += r1.changes || 0;

    const r2 = await this.dbService.run('DELETE FROM business_contexts WHERE user_id = ?', [userId]);
    deletedCount += r2.changes || 0;

    const r3 = await this.dbService.run('DELETE FROM actionable_recommendations WHERE user_id = ?', [userId]);
    deletedCount += r3.changes || 0;

    const r4 = await this.dbService.run('DELETE FROM route_hits WHERE user_id = ?', [userId]);
    deletedCount += r4.changes || 0;

    const r5 = await this.dbService.run('DELETE FROM route_hit_events WHERE user_id = ?', [userId]);
    deletedCount += r5.changes || 0;

    return {
      user_id: userId,
      deleted_count: deletedCount,
    };
  }
}
