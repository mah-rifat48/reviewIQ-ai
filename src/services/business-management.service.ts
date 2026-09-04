import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessStoreService } from '../db/business-store.service';

@Injectable()
export class BusinessManagementService {
  constructor(private readonly businessStore: BusinessStoreService) {}

  async buildBusinessManagement(userId?: string, photoUrlBuilder?: (ref: string) => string | null): Promise<any> {
    const effectiveUserId = userId || 'user_123';
    const businesses = await this.businessStore.getUserBusinesses(effectiveUserId);

    const locations = businesses.map((b) => {
      const payload = b.place_payload || {};
      const photos = payload.photos || [];
      const photoRef = photos[0]?.photo_reference;

      return {
        id: b.id,
        user_id: b.user_id,
        business_name: b.business_name,
        business_category: b.business_category,
        location: b.business_address || b.input_address,
        place_id: b.place_id,
        rating: payload.rating || 0,
        user_ratings_total: payload.user_ratings_total || 0,
        account_status: b.account_status || 'active',
        is_suspended: b.is_suspended || false,
        photo_url: photoUrlBuilder && photoRef ? photoUrlBuilder(photoRef) : null,
      };
    });

    return {
      user_id: effectiveUserId,
      total_locations: locations.length,
      locations,
    };
  }

  async buildBusinessManagementDetail(
    businessName?: string,
    userId?: string,
    overlook?: string,
    photoUrlBuilder?: (ref: string) => string | null,
  ): Promise<any> {
    const effectiveUserId = userId || 'user_123';
    const businesses = await this.businessStore.getUserBusinesses(effectiveUserId);

    let match = businesses[0];
    if (businessName) {
      match = businesses.find(
        (b) => b.business_name.toLowerCase() === businessName.toLowerCase(),
      ) || match;
    }

    if (!match) {
      throw new HttpException('Business not found', HttpStatus.NOT_FOUND);
    }

    const payload = match.place_payload || {};
    const reviews = payload.reviews || [];

    return {
      business_name: match.business_name,
      location: match.business_address || match.input_address,
      overlook: overlook || 'overview',
      total_reviews: reviews.length,
      rating: payload.rating || 0,
      reviews,
    };
  }

  async buildBusinessCategories(): Promise<any> {
    return {
      categories: [
        'Restaurant',
        'Cafe & Bakery',
        'Hotel & Hospitality',
        'Retail & Shopping',
        'Healthcare & Wellness',
        'Automotive Services',
        'Professional Services',
        'Entertainment & Fitness',
      ],
    };
  }
}
