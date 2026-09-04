import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { ReviewAnalysisService } from '../services/review-analysis.service';
import { businessMatches } from '../utils/business-matching';

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
    const matched = businesses.find((b) =>
      businessMatches(b, businessName, address),
    );

    if (!matched) {
      throw new HttpException('Business not found for this user.', HttpStatus.NOT_FOUND);
    }

    const placeData = await this.placeStore.getPlaceData(matched.place_id);
    const reviews = placeData?.reviews || [];

    return this.reviewAnalysisService.buildReviewsAnalysisPage(reviews);
  }
}
