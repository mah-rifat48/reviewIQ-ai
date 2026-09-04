import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { OpenAiService } from './services/openai.service';
import { GooglePlacesService } from './services/google-places.service';
import { DashboardAnalysisService } from './services/dashboard-analysis.service';
import { OverviewService } from './services/overview.service';
import { AiInsightsService } from './services/ai-insights.service';
import { MonthlyReportService } from './services/monthly-report.service';
import { CompetitorAnalysisService } from './services/competitor-analysis.service';
import { BusinessManagementService } from './services/business-management.service';

import { BusinessSetupController } from './controllers/business-setup.controller';
import { GoalsSetupController } from './controllers/goals-setup.controller';
import { OverviewController } from './controllers/overview.controller';
import { ReviewsController } from './controllers/reviews.controller';
import { AiInsightsController } from './controllers/ai-insights.controller';
import { MonthlyReportController } from './controllers/monthly-report.controller';
import { CompetitorController } from './controllers/competitor.controller';
import { BusinessManagementController } from './controllers/business-management.controller';
import { BusinessProfileController } from './controllers/business-profile.controller';

import { ReviewAnalysisService } from './services/review-analysis.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DbModule,
  ],
  controllers: [
    BusinessSetupController,
    GoalsSetupController,
    OverviewController,
    ReviewsController,
    AiInsightsController,
    MonthlyReportController,
    CompetitorController,
    BusinessManagementController,
    BusinessProfileController,
  ],
  providers: [
    OpenAiService,
    GooglePlacesService,
    DashboardAnalysisService,
    OverviewService,
    ReviewAnalysisService,
    AiInsightsService,
    MonthlyReportService,
    CompetitorAnalysisService,
    BusinessManagementService,
  ],
})
export class AppModule {}
