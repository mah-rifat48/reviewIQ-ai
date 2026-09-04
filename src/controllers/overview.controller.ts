import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { DashboardAnalysisService } from '../services/dashboard-analysis.service';
import { OverviewService } from '../services/overview.service';
import { businessMatches } from '../utils/business-matching';

@ApiTags('Dashboard')
@Controller('dashboard')
export class OverviewController {
  constructor(
    private readonly businessStore: BusinessStoreService,
    private readonly placeStore: PlaceStoreService,
    private readonly dashboardAnalysis: DashboardAnalysisService,
    private readonly overviewService: OverviewService,
  ) {}

  @Get('overview')
  async overviewDashboard(
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

    const analysis = await this.dashboardAnalysis.analyzeReviews(reviews);

    const overview = this.overviewService.buildOverview(placeData, analysis, reviews);
    const sentimentTrend = this.overviewService.buildSentimentTrend(
      reviews,
      analysis.reviews_analysis,
    );

    const performanceCriteria = this.overviewService.aggregateCriteriaScores(
      analysis.reviews_analysis,
    );
    const performanceCriteriaGrowth = this.overviewService.buildPerformanceCriteriaGrowth(
      reviews,
      analysis.reviews_analysis,
      performanceCriteria,
    );

    return {
      overview,
      sentiment_trend: sentimentTrend,
      performance_criteria: performanceCriteria,
      performance_criteria_growth: performanceCriteriaGrowth,
      performance_criteria_with_growth: this.overviewService.buildPerformanceCriteriaWithGrowth(
        performanceCriteria,
        performanceCriteriaGrowth,
      ),
    };
  }
}
