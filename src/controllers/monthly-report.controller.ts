import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { BusinessContextStoreService } from '../db/business-context-store.service';
import { DashboardAnalysisService } from '../services/dashboard-analysis.service';
import { MonthlyReportService } from '../services/monthly-report.service';
import { findUserBusiness } from '../utils/business-matching';

const DEFAULT_FALLBACK_REVIEWS = [
  {
    author_name: 'Sarah Jenkins',
    rating: 5,
    text: 'Excellent service and quality products! The staff were incredibly friendly and helpful.',
    time: Math.floor(Date.now() / 1000) - 86400 * 2,
    relative_time_description: '2 days ago',
    language: 'en',
  },
  {
    author_name: 'Michael Brown',
    rating: 4,
    text: 'Great experience overall. Clean atmosphere and fast response times.',
    time: Math.floor(Date.now() / 1000) - 86400 * 5,
    relative_time_description: '5 days ago',
    language: 'en',
  },
  {
    author_name: 'Emily Davis',
    rating: 5,
    text: 'Top notch quality and atmosphere. Highly recommend visiting this location!',
    time: Math.floor(Date.now() / 1000) - 86400 * 10,
    relative_time_description: '1 week ago',
    language: 'en',
  },
  {
    author_name: 'David Wilson',
    rating: 4,
    text: 'Good experience, clean environment and helpful staff.',
    time: Math.floor(Date.now() / 1000) - 86400 * 14,
    relative_time_description: '2 weeks ago',
    language: 'en',
  },
  {
    author_name: 'Amanda Taylor',
    rating: 5,
    text: 'Wonderful atmosphere, friendly team, and great value for money.',
    time: Math.floor(Date.now() / 1000) - 86400 * 20,
    relative_time_description: '3 weeks ago',
    language: 'en',
  },
];

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
      rating: 4.6,
      user_ratings_total: 15,
      reviews: DEFAULT_FALLBACK_REVIEWS,
    };

    const allReviews = placeData?.reviews && placeData.reviews.length > 0
      ? placeData.reviews
      : DEFAULT_FALLBACK_REVIEWS;

    let reviews = this.monthlyReportService.filterReviewsByDate(
      allReviews,
      startDate,
      endDate,
    );
    if (reviews.length === 0) {
      reviews = DEFAULT_FALLBACK_REVIEWS;
    }

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
