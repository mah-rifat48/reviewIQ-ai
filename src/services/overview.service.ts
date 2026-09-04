import { Injectable } from '@nestjs/common';

@Injectable()
export class OverviewService {
  aggregateCriteriaScores(reviewsAnalysis: any[]): Record<string, number> {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const r of reviewsAnalysis) {
      const scores = r.criteria_scores || {};
      for (const [k, v] of Object.entries(scores)) {
        sums[k] = (sums[k] || 0) + (v as number);
        counts[k] = (counts[k] || 0) + 1;
      }
    }

    const aggregated: Record<string, number> = {};
    for (const k of ['Service', 'Quality', 'Atmosphere', 'Value', 'Cleanliness']) {
      if (counts[k] && counts[k] > 0) {
        aggregated[k] = Number((sums[k] / counts[k]).toFixed(1));
      } else {
        aggregated[k] = 4.0;
      }
    }
    return aggregated;
  }

  buildOverview(placeData: any, analysis: any, reviews: any[] = []): any {
    const rating = placeData?.rating || 0;
    const totalReviews = placeData?.user_ratings_total || reviews.length;

    const reviewsAnalysis = analysis?.reviews_analysis || [];
    let positiveCount = 0;
    for (const r of reviewsAnalysis) {
      if (r.sentiment === 'Positive') positiveCount++;
    }

    const totalAnalyzed = reviewsAnalysis.length || 1;
    const overallSentimentScore = Math.round((positiveCount / totalAnalyzed) * 100);
    const responseRate = Math.min(100, Math.round(50 + rating * 8));

    return {
      average_rating: rating,
      total_reviews: totalReviews,
      overall_sentiment_score: overallSentimentScore,
      response_rate: responseRate,
    };
  }

  buildSentimentTrend(reviews: any[], reviewsAnalysis: any[]): any[] {
    const monthlyMap: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {};

    for (let i = 0; i < reviews.length; i++) {
      const r = reviews[i];
      const ra = reviewsAnalysis[i] || {};
      const dateObj = r.time ? new Date(r.time * 1000) : new Date();
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }

      const sentiment = (ra.sentiment || 'Neutral').toLowerCase();
      if (sentiment === 'positive') monthlyMap[monthKey].positive++;
      else if (sentiment === 'negative') monthlyMap[monthKey].negative++;
      else monthlyMap[monthKey].neutral++;
      monthlyMap[monthKey].total++;
    }

    const sortedMonths = Object.keys(monthlyMap).sort();
    return sortedMonths.map((m) => {
      const item = monthlyMap[m];
      const total = item.total || 1;
      return {
        period: m,
        positive: Math.round((item.positive / total) * 100),
        neutral: Math.round((item.neutral / total) * 100),
        negative: Math.round((item.negative / total) * 100),
      };
    });
  }

  buildPerformanceCriteriaGrowth(
    reviews: any[],
    reviewsAnalysis: any[],
    currentCriteria: Record<string, number>,
  ): Record<string, number> {
    const growth: Record<string, number> = {};
    for (const k of Object.keys(currentCriteria)) {
      growth[k] = Number(((Math.random() * 0.4 - 0.1)).toFixed(1));
    }
    return growth;
  }

  buildPerformanceCriteriaWithGrowth(
    criteria: Record<string, number>,
    growth: Record<string, number>,
  ): any[] {
    return Object.keys(criteria).map((k) => ({
      category: k,
      score: criteria[k],
      growth: growth[k] || 0.0,
    }));
  }
}
