import {
  Controller,
  Get,
  Patch,
  Query,
  Body,
  Res,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BusinessStoreService } from '../db/business-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { BusinessContextStoreService } from '../db/business-context-store.service';
import { RecommendationStoreService, recommendationTitleKey } from '../db/recommendation-store.service';
import { DashboardAnalysisService } from '../services/dashboard-analysis.service';
import { OverviewService } from '../services/overview.service';
import { AiInsightsService } from '../services/ai-insights.service';
import { findUserBusiness } from '../utils/business-matching';
import { ActionableRecommendationStatusDto } from '../dto/actionable-recommendation.dto';

@ApiTags('AI Insights')
@Controller('insights')
export class AiInsightsController {
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly businessStore: BusinessStoreService,
    private readonly placeStore: PlaceStoreService,
    private readonly businessContextStore: BusinessContextStoreService,
    private readonly recommendationStore: RecommendationStoreService,
    private readonly dashboardAnalysis: DashboardAnalysisService,
    private readonly overviewService: OverviewService,
    private readonly aiInsightsService: AiInsightsService,
  ) {
    this.apiKey =
      this.configService.get<string>('GOOGLE_PLACE_API') ||
      this.configService.get<string>('GOOGLE_PLACES_API_KEY');
  }

  @Get('place-photo')
  async placePhoto(
    @Query('photo_reference') photoReference: string,
    @Query('maxwidth') maxwidth: number = 800,
    @Res() res: Response,
  ) {
    if (!photoReference || !photoReference.trim()) {
      throw new HttpException('photo_reference is required.', HttpStatus.BAD_REQUEST);
    }

    const width = Math.max(1, Math.min(Number(maxwidth) || 800, 1600));
    const cleanRef = photoReference.trim();

    let googleUrl: string;
    let params: Record<string, any> = {};
    let headers: Record<string, string> = {};

    if (cleanRef.startsWith('places/') && cleanRef.includes('/photos/')) {
      googleUrl = `https://places.googleapis.com/v1/${cleanRef.replace(/^\//, '')}/media`;
      params = { maxWidthPx: width };
      headers = { 'X-Goog-Api-Key': this.apiKey };
    } else {
      googleUrl = 'https://maps.googleapis.com/maps/api/place/photo';
      params = {
        maxwidth: width,
        photo_reference: cleanRef,
        key: this.apiKey,
      };
    }

    try {
      const googleRes = await axios.get(googleUrl, {
        params,
        headers,
        responseType: 'stream',
      });

      const contentType = String(googleRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      googleRes.data.pipe(res);
    } catch (err: any) {
      throw new HttpException(
        'Google Place photo could not be fetched.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async buildAiInsightsContext(
    userId: string,
    businessName: string,
    address?: string,
  ) {
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

    const reviews = placeData?.reviews || [];
    const analysis = await this.dashboardAnalysis.analyzeReviews(reviews);
    const overview = this.overviewService.buildOverview(placeData, analysis, reviews);
    const rawCriteria = this.overviewService.aggregateCriteriaScores(
      analysis.reviews_analysis,
    );
    const performanceByCategory = this.aiInsightsService.normalizeCriteriaScores(
      rawCriteria,
    );

    const { emerging, declining } = this.aiInsightsService.extractEmergingAndDeclining(
      reviews,
      analysis.reviews_analysis,
    );

    const businessGoals = context?.goals || [];

    const insightsInput = {
      overview,
      performance_by_category: performanceByCategory,
      detected_emerging_trends: emerging,
      detected_declining_areas: declining,
      business_goals: businessGoals,
    };

    return {
      matched_business: matched,
      place_data: placeData,
      context,
      rating: placeData?.rating,
      performance_by_category: performanceByCategory,
      business_goals: businessGoals,
      insights_input: insightsInput,
    };
  }

  @Get('recommendations')
  async aiInsights(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('address') address?: string,
  ) {
    const ctx = await this.buildAiInsightsContext(userId, businessName, address);
    const insights = await this.aiInsightsService.generateAiInsights(
      ctx.insights_input,
    );
    const stored = await this.recommendationStore.getUnreadActionableRecommendations(
      userId,
    );

    const photos = ctx.place_data?.photos || [];
    const photoRef = photos[0]?.photo_reference;

    const combinedRecs = [
      ...stored,
      ...(insights.actionable_recommendations || []),
    ];

    const payload = {
      ...insights,
      business_picture: photoRef
        ? {
            photo_reference: photoRef,
            photo_url: `/insights/place-photo?photo_reference=${encodeURIComponent(photoRef)}`,
            width: 800,
            height: 600,
            html_attributions: [],
          }
        : {
            photo_reference: '',
            photo_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2047&auto=format&fit=crop',
            width: 800,
            height: 600,
            html_attributions: [],
          },
      rating: ctx.rating,
      performance_by_category: ctx.performance_by_category,
      business_goals: ctx.business_goals,
      actionable_recommendations: combinedRecs,
    };

    const titles = (insights.actionable_recommendations || []).map((r: any) => r.title);
    await this.recommendationStore.saveActionableRecommendationTitles(userId, titles);

    const readKeys = await this.recommendationStore.getReadActionableRecommendationTitleKeys(
      userId,
    );
    const unread = combinedRecs.filter(
      (r: any) => !readKeys.has(recommendationTitleKey(r.title || '')),
    );

    return {
      ...payload,
      actionable_recommendations: unread,
    };
  }

  @Get('actionable-recommendations')
  async aiActionableRecommendations(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('address') address?: string,
  ) {
    const ctx = await this.buildAiInsightsContext(userId, businessName, address);
    const input = {
      ...ctx.insights_input,
      business: {
        name: ctx.matched_business?.business_name || businessName,
        address: ctx.matched_business?.business_address || address,
        category: ctx.context?.business_category,
        rating: ctx.rating,
      },
    };

    const programRecs = await this.aiInsightsService.generateProgramRecommendations(
      input,
    );
    const recs = programRecs.actionable_recommendations || [];
    const savedCount = await this.recommendationStore.saveActionableRecommendations(
      userId,
      recs,
    );

    return {
      success: true,
      message: 'Action returned successfully.',
      saved_count: savedCount,
    };
  }

  @Patch('actionable-recommendations/status')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ActionableRecommendationStatusDto })
  @ApiResponse({ status: 200, description: 'Successful Response' })
  async updateActionableRecommendationStatus(@Body() payload: ActionableRecommendationStatusDto) {
    const updated = await this.recommendationStore.updateActionableRecommendationStatus(
      payload.user_id,
      payload.title,
      payload.status,
    );

    if (!updated) {
      throw new HttpException(
        'Actionable recommendation not found for this user.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      ...updated,
      visible: updated.status !== 'read',
    };
  }
}
