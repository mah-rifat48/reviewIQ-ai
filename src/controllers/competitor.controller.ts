import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { BusinessContextStoreService } from '../db/business-context-store.service';
import { GooglePlacesService } from '../services/google-places.service';
import { CompetitorAnalysisService } from '../services/competitor-analysis.service';
import { findUserBusiness } from '../utils/business-matching';

@ApiTags('Competitor Analysis')
@Controller('competitors')
export class CompetitorController {
  constructor(
    private readonly businessStore: BusinessStoreService,
    private readonly placeStore: PlaceStoreService,
    private readonly businessContextStore: BusinessContextStoreService,
    private readonly googlePlacesService: GooglePlacesService,
    private readonly competitorAnalysis: CompetitorAnalysisService,
  ) {}

  @Get('analysis')
  async competitorReport(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('address') address?: string,
  ) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    const matched = findUserBusiness(businesses, businessName, address);

    const placeId = matched?.place_id || 'default_place';
    const [rawPlaceData, context] = await Promise.all([
      this.placeStore.getPlaceData(placeId),
      this.businessContextStore.getLatestBusinessContext(placeId, userId),
    ]);

    const placeData = rawPlaceData || {
      name: businessName || matched?.business_name || 'My Business',
      formatted_address: address || matched?.business_address || 'City Location',
      rating: 4.5,
      user_ratings_total: 15,
      reviews: [],
    };

    const my = placeData || {};
    const myRating = my.rating || 0;
    const myPriceLevel = my.price_level || 2;
    const myReviews = my.user_ratings_total || 0;

    const myBusiness = {
      name: my.name || matched?.business_name || 'My Business',
      map_url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      rating: myRating,
      reviews: myReviews,
      sentiment: myRating ? Math.round((myRating / 5) * 100) : 0,
      response_rate: myRating ? Math.round(50 + myRating * 5) : 0,
      criteria: this.competitorAnalysis.estimateCriteriaScores(myRating, myPriceLevel),
    };

    const compPlaces = await this.googlePlacesService.searchCompetitorPlaces(
      my.location,
      my.types || [],
    );

    const competitorBusinesses = compPlaces.map((c) => {
      const rating = c.rating || 0;
      return {
        name: c.name || 'Unknown',
        map_url: c.map_url,
        rating,
        reviews: c.reviews || 0,
        sentiment: rating ? Math.round((rating / 5) * 100) : 0,
        response_rate: rating ? Math.round(50 + rating * 5) : 0,
        criteria: this.competitorAnalysis.estimateCriteriaScores(rating, c.price_level || 2),
      };
    });

    const allBusinesses = [myBusiness, ...competitorBusinesses];

    const performance = this.competitorAnalysis.buildPerformanceComparison(allBusinesses);
    const radar = this.competitorAnalysis.buildCategoryRadar(allBusinesses);
    const criteria = this.competitorAnalysis.buildCriteriaComparison(
      allBusinesses,
      myBusiness.name,
    );

    const { advantages, whereCompetitorsExcel } = this.competitorAnalysis.extractAdvantages(
      criteria,
      myBusiness.name,
    );

    const competitorExcelEvidence = this.competitorAnalysis.buildCompetitorExcelEvidence(
      myBusiness,
      competitorBusinesses,
    );

    const businessGoals = context?.goals || [];
    const reportFrequency = context?.report_frequency;

    const ai = await this.competitorAnalysis.generateCompetitiveStrategy({
      my_business: myBusiness,
      competitors: competitorBusinesses,
      criteria_comparison: criteria,
      where_competitors_excel_evidence: competitorExcelEvidence,
      competitive_advantages: advantages,
      business_goals: businessGoals,
      report_frequency: reportFrequency,
    });

    return {
      business_goals: businessGoals,
      report_frequency: reportFrequency,
      cards: allBusinesses,
      performance_comparison: performance,
      category_radar: radar,
      criteria_comparison: criteria,
      where_competitors_excel: ai.where_competitors_excel,
      competitive_advantages: advantages,
      strategic_recommendations: ai.recommendations,
    };
  }
}
