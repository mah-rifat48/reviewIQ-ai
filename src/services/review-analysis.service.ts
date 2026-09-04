import { Injectable } from '@nestjs/common';
import { DashboardAnalysisService } from './dashboard-analysis.service';

@Injectable()
export class ReviewAnalysisService {
  constructor(private readonly dashboardAnalysis: DashboardAnalysisService) {}

  async buildReviewsAnalysisPage(reviews: any[]): Promise<any> {
    const ratings: number[] = [];
    const sentimentCounter: Record<string, number> = {
      Positive: 0,
      Neutral: 0,
      Negative: 0,
    };
    const analyzedReviews: any[] = [];

    for (const r of reviews) {
      const ai = await this.dashboardAnalysis.analyzeReview(r.text || '');
      ratings.push(r.rating || 0);

      const sent = ai.sentiment || 'Neutral';
      sentimentCounter[sent] = (sentimentCounter[sent] || 0) + 1;

      const dateStr = r.time
        ? new Date(r.time * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      analyzedReviews.push({
        author: r.author_name || 'Anonymous',
        rating: r.rating || 0,
        date: dateStr,
        text: r.text || '',
        sentiment: ai.sentiment,
        emotions: ai.emotions || [],
        strengths: ai.strengths || [],
      });
    }

    const avgRating = ratings.length
      ? Number(
          (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
        )
      : 0.0;

    return {
      stats: {
        total_reviews: reviews.length,
        avg_ratings: avgRating,
        Positive_sentiments: sentimentCounter['Positive'] || 0,
        negetive_sentiments: sentimentCounter['Negative'] || 0,
      },
      reviews: analyzedReviews,
    };
  }
}
