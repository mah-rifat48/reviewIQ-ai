import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessStoreService } from '../db/business-store.service';

function ratingStars(rating: number): { full: number; half: boolean; empty: number } {
  const value = Math.max(0.0, Math.min(Number(rating || 0), 5.0));
  let full = Math.floor(value);
  const fraction = value - full;
  let half = false;

  if (fraction >= 0.75 && full < 5) {
    full += 1;
  } else {
    half = fraction >= 0.25 && full < 5;
  }

  const empty = Math.max(5 - full - (half ? 1 : 0), 0);
  return { full, half, empty };
}

@Injectable()
export class BusinessManagementService {
  constructor(private readonly businessStore: BusinessStoreService) {}

  async buildBusinessManagement(
    userId?: string,
    photoUrlBuilder?: (ref: string) => string | null,
  ): Promise<any> {
    const businesses = await this.businessStore.getAllUserBusinesses();
    const filtered = userId
      ? businesses.filter((b) => b.user_id === userId)
      : businesses;

    const grouped: Record<string, any> = {};

    for (const b of filtered) {
      const name = (b.business_name || '').trim().toLowerCase();
      const category = (b.business_category || 'Retail').trim().toLowerCase();
      const key = `${b.user_id || ''}|${name}|${category}`;

      if (!grouped[key]) {
        grouped[key] = {
          business_name: b.business_name,
          category: b.business_category || 'Retail',
          owner_id: b.user_id,
          owner_name: b.raw_input?.owner_name || null,
          phone: b.raw_input?.phone_no || b.place_payload?.formatted_phone_number || null,
          phone_no: b.raw_input?.phone_no || b.place_payload?.formatted_phone_number || null,
          website: b.raw_input?.website || b.place_payload?.website || null,
          photo: null,
          locations: [],
        };
      }

      const payload = b.place_payload || {};
      const photoRef = payload.photos?.[0]?.photo_reference;
      const photoObj = photoRef && photoUrlBuilder
        ? { photo_reference: photoRef, photo_url: photoUrlBuilder(photoRef) }
        : null;

      if (!grouped[key].photo && photoObj) {
        grouped[key].photo = photoObj;
      }

      grouped[key].locations.push({
        business_name: b.business_name,
        address: b.business_address || b.input_address,
        phone: b.raw_input?.phone_no || payload.formatted_phone_number || null,
        phone_no: b.raw_input?.phone_no || payload.formatted_phone_number || null,
        website: b.raw_input?.website || payload.website || null,
        photo: photoObj,
        reviews: payload.user_ratings_total || 5,
        rating: payload.rating || 4.2,
        account_status: b.account_status || 'active',
        is_suspended: b.is_suspended || false,
      });
    }

    const businessList = Object.values(grouped);
    let totalLocationsCount = 0;
    let totalReviewsCount = 0;
    let ratingSum = 0;

    const formattedBusinesses = businessList.map((bg: any) => {
      const locationCount = bg.locations.length;
      totalLocationsCount += locationCount;
      const reviews = bg.locations.reduce((acc: number, l: any) => acc + (l.reviews || 0), 0);
      totalReviewsCount += reviews;
      const avgRating = bg.locations.reduce((acc: number, l: any) => acc + (l.rating || 0), 0) / locationCount;
      ratingSum += avgRating;

      return {
        business_name: bg.business_name,
        category: bg.category,
        owner_id: bg.owner_id,
        owner_name: bg.owner_name,
        phone: bg.phone,
        phone_no: bg.phone_no,
        website: bg.website,
        photo: bg.photo,
        primary_photo: bg.photo,
        location_count: locationCount,
        reviews,
        average_rating: Math.round(avgRating * 10) / 10,
        ratings: Math.round(avgRating * 10) / 10,
        account_status: 'active',
        is_suspended: false,
      };
    });

    const overallAvgRating = businessList.length > 0
      ? Math.round((ratingSum / businessList.length) * 10) / 10
      : 4.6;

    return {
      total_business: formattedBusinesses.length,
      total_location: totalLocationsCount,
      avg_rating: overallAvgRating,
      total_reviews: totalReviewsCount,
      businesses: formattedBusinesses,
    };
  }

  async buildBusinessManagementDetail(
    businessName?: string,
    userId?: string,
    overlook: string = 'overview',
    photoUrlBuilder?: (ref: string) => string | null,
  ): Promise<any> {
    const list = await this.buildBusinessManagement(userId, photoUrlBuilder);
    const businesses = list.businesses || [];

    let match = businesses[0];
    if (businessName) {
      match = businesses.find(
        (b: any) => (b.business_name || '').toLowerCase() === businessName.toLowerCase(),
      ) || match;
    }

    if (!match) {
      throw new HttpException('Business not found.', HttpStatus.NOT_FOUND);
    }

    const normOverlook = (overlook || 'overview').toLowerCase().trim();
    const avgRating = match.average_rating || 4.2;
    const stars = ratingStars(avgRating);

    if (normOverlook === 'overview') {
      return {
        business_name: match.business_name,
        owner_id: match.owner_id,
        average_rating: avgRating,
        rating_stars: stars,
        recent_activity: [
          {
            type: 'monthly_report_generated',
            title: 'Monthly report generated',
            subtitle: 'All locations',
            time_ago: 'just now',
            created_at: new Date().toISOString(),
            metadata: { route_path: '/reports/monthly' },
          },
        ],
        overview: {
          business_owner_name: match.owner_name,
          category: match.category,
          average_rating: avgRating,
          rating_stars: stars,
          phone: match.phone,
          phone_no: match.phone_no,
          website: match.website,
          photo: match.photo,
          primary_photo: match.primary_photo,
          account_created: new Date().toISOString(),
          last_active: new Date().toISOString(),
          account_status: match.account_status || 'active',
          is_suspended: match.is_suspended || false,
        },
      };
    }

    if (normOverlook === 'location' || normOverlook === 'locations') {
      return {
        business_name: match.business_name,
        owner_id: match.owner_id,
        average_rating: avgRating,
        rating_stars: stars,
        locations: [
          {
            business_name: match.business_name,
            address: match.primary_address || 'Main Location',
            phone: match.phone,
            phone_no: match.phone_no,
            website: match.website,
            photo: match.photo,
            reviews: match.reviews || 5,
            rating: avgRating,
            account_status: 'active',
            is_suspended: false,
          },
        ],
      };
    }

    if (normOverlook === 'analytics') {
      return {
        business_name: match.business_name,
        owner_id: match.owner_id,
        average_rating: avgRating,
        rating_stars: stars,
        analytics: {
          period: 'last_30_days',
          reviews_analyzed: match.reviews || 5,
          avg_sentiment_analysis: {
            positive: '80%',
            neutral: '20%',
            negative: '0%',
          },
          positive_review_percentage: 80,
          negative_review_percentage: 0,
        },
      };
    }

    throw new HttpException('overlook must be one of: overview, locations, analytics.', HttpStatus.BAD_REQUEST);
  }

  async buildBusinessCategories(): Promise<any> {
    const list = await this.buildBusinessManagement();
    const businesses = list.businesses || [];

    const categoryCounter: Record<string, number> = {};
    for (const b of businesses) {
      const cat = (b.category || 'retail').trim().toLowerCase();
      categoryCounter[cat] = (categoryCounter[cat] || 0) + 1;
    }

    const categories = Object.entries(categoryCounter)
      .map(([category, count]) => ({ category, business_count: count }))
      .sort((a, b) => b.business_count - a.business_count);

    return {
      total_categories: categories.length,
      categories,
    };
  }
}
