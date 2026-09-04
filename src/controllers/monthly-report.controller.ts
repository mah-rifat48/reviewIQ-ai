import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { BusinessContextStoreService } from '../db/business-context-store.service';
import { DashboardAnalysisService } from '../services/dashboard-analysis.service';
import { MonthlyReportService } from '../services/monthly-report.service';
import { findUserBusiness } from '../utils/business-matching';

@ApiTags('Reports')
@Controller('reports')
export class MonthlyReportController {
  constructor(
    private readonly businessStore: BusinessStoreService,
    private readonly placeStore: PlaceStoreService,
    private readonly businessContextStore: BusinessContextStoreService,
    private readonly dashboardAnalysis: DashboardAnalysisService,
    private readonly monthlyReportService: MonthlyReportService,
  ) {}

  @Get('monthly')
  async monthlyReport(
    @Query('user_id') userId: string = 'user_123',
    @Query('business_name') businessName: string = 'Softvence Ltd',
    @Query('report_frequency') reportFrequency: string = 'monthly',
    @Query('start_date') startDate: string = '2026-05-01',
    @Query('end_date') endDate: string = '2026-05-31',
    @Query('address') address?: string,
  ) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new HttpException('end_date must be on or after start_date.', HttpStatus.BAD_REQUEST);
    }

    const normFreq = this.monthlyReportService.normalizeReportFrequency(reportFrequency);

    const businesses = await this.businessStore.getUserBusinesses(userId);
    const matched = findUserBusiness(businesses, businessName, address);

    const placeId = matched?.place_id || 'default_place';
    const [rawPlaceData, context] = await Promise.all([
      this.placeStore.getPlaceData(placeId),
      this.businessContextStore.getLatestBusinessContext(placeId, userId),
    ]);

    const placeData = rawPlaceData || {
      name: businessName || matched?.business_name || 'Business Location',
      formatted_address: address || matched?.business_address || 'City Location',
      rating: 4.5,
      user_ratings_total: 15,
      reviews: [],
    };

    const allReviews = placeData?.reviews || [];
    const reviews = this.monthlyReportService.filterReviewsByDate(
      allReviews,
      startDate,
      endDate,
    );

    const analysis = await this.dashboardAnalysis.analyzeReviews(reviews);
    const kpis = this.monthlyReportService.buildReportKpis(reviews, analysis);

    const sentimentCounter: Record<string, number> = {};
    for (const r of analysis.reviews_analysis) {
      sentimentCounter[r.sentiment] = (sentimentCounter[r.sentiment] || 0) + 1;
    }

    const aiSummary = await this.monthlyReportService.generateMonthlyAiSummary({
      reviews_count: reviews.length,
      date_range: { start_date: startDate, end_date: endDate },
      sentiments: sentimentCounter,
      kpis,
      total_reviews_available: allReviews.length,
      business_goals: context?.goals || [],
      report_frequency: normFreq,
      requested_report_frequency: reportFrequency,
    });

    const report = this.monthlyReportService.buildMonthlyReport(
      reviews,
      analysis,
      kpis,
      aiSummary,
      normFreq,
      startDate,
      endDate,
      allReviews.length,
    );

    report.business_goals = context?.goals || [];
    report.saved_report_frequency = context?.report_frequency;

    return report;
  }
}
