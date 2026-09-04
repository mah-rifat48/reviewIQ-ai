import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { BusinessStoreService } from './business-store.service';
import { PlaceStoreService } from './place-store.service';
import { BusinessContextStoreService } from './business-context-store.service';
import { RecommendationStoreService } from './recommendation-store.service';
import { RouteHitStoreService } from './route-hit-store.service';
import { UserDataStoreService } from './user-data-store.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    CacheService,
    BusinessStoreService,
    PlaceStoreService,
    BusinessContextStoreService,
    RecommendationStoreService,
    RouteHitStoreService,
    UserDataStoreService,
  ],
  exports: [
    DatabaseService,
    CacheService,
    BusinessStoreService,
    PlaceStoreService,
    BusinessContextStoreService,
    RecommendationStoreService,
    RouteHitStoreService,
    UserDataStoreService,
  ],
})
export class DbModule {}
