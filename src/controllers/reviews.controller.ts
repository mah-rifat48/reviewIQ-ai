import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { ReviewAnalysisService } from '../services/review-analysis.service';
import { findUserBusiness } from '../utils/business-matching';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly businessStore: BusinessStoreService,
    private readonly placeStore: PlaceStoreService,
    private readonly reviewAnalysisService: ReviewAnalysisService,
  ) {}

  @Get('analysis')
  async reviewsAnalysis(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('address') address?: string,
  ) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    const matched = findUserBusiness(businesses, businessName, address);

    const placeId = matched?.place_id || 'default_place';
    const rawPlaceData = await this.placeStore.getPlaceData(placeId);
    const placeData = rawPlaceData || {
      name: businessName || matched?.business_name || 'Business Location',
      formatted_address: address || matched?.business_address || 'City Location',
      rating: 4.5,
      user_ratings_total: 15,
      reviews: [],
    };

    const reviews = placeData?.reviews || [];

    return this.reviewAnalysisService.buildReviewsAnalysisPage(reviews);
  }
}
