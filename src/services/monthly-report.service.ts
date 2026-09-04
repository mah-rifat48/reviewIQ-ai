import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { OpenAiService } from './openai.service';

const MONTHLY_AI_PROMPT_VERSION = 'monthly_report_ai_v1';

const MONTHLY_AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executive_summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          estimated_impact: { type: 'string' },
        },
        required: ['title', 'description', 'estimated_impact'],
      },
    },
    action_plan: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['executive_summary', 'recommendations', 'action_plan'],
};

@Injectable()
export class MonthlyReportService {
  constructor(private readonly openAiService: OpenAiService) {}

  normalizeReportFrequency(reportFrequency: string): string {
    const raw = (reportFrequency || '').trim().toLowerCase().replace('_', '-');
    const aliases: Record<string, string> = {
      day: 'daily',
      daily: 'daily',
      week: 'weekly',
      weekly: 'weekly',
      month: 'monthly',
      monthly: 'monthly',
      quarter: 'quarterly',
      quarterly: 'quarterly',
      year: 'yearly',
      yearly: 'yearly',
      annual: 'yearly',
      annually: 'yearly',
    };
    const frequency = aliases[raw];
    if (!frequency) {
      throw new HttpException(
        'report_frequency must be one of: daily, monthly, quarterly, weekly, yearly.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return frequency;
  }

  filterReviewsByDate(reviews: any[], startDateStr: string, endDateStr: string): any[] {
    const start = new Date(startDateStr).getTime() / 1000;
    const end = new Date(endDateStr).getTime() / 1000 + 86400;

    return (reviews || []).filter((r) => {
      if (!r.time) return true;
      return r.time >= start && r.time <= end;
    });
  }

  buildReportKpis(reviews: any[], analysis: any): any {
    const ratings = (reviews || [])
      .map((r) => r.rating)
      .filter((r) => typeof r === 'number');

    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    return {
      avg_rating: { value: avgRating, change: null },
      reviews: { value: reviews.length, change: null },
      satisfaction: {
        value: analysis?.satisfaction_index ?? 0,
        change: null,
      },
      response_rate: { value: null, change: null },
    };
  }

  async generateMonthlyAiSummary(summaryInput: Record<string, any>): Promise<any> {
    const fallback = {
      executive_summary:
        'Overall business performance during this period shows stable customer feedback with opportunities for service enhancement.',
      recommendations: [
        {
          title: 'Improve Peak Hour Responsiveness',
          priority: 'High',
          description: 'Ensure staff allocation matches customer influx during peak hours.',
        },
        {
          title: 'Enhance Staff Customer Service Training',
          priority: 'Medium',
          description: 'Conduct training workshops focusing on proactive guest support.',
        },
      ],
      action_plan: [
        {
          step: 1,
          action: 'Review weekly customer feedback and queue lengths',
          timeline: 'Week 1',
        },
        {
          step: 2,
          action: 'Implement staff training and shift adjustments',
          timeline: 'Week 2-3',
        },
      ],
    };

    try {
      const instructions = `
You are an executive business analyst summarizing performance over a designated reporting period.
Return a structured JSON object strictly matching the schema.
`;
      const res = await this.openAiService.generateJsonCached(
        'monthly_report_ai',
        MONTHLY_AI_PROMPT_VERSION,
        summaryInput,
        'monthly_report_ai',
        MONTHLY_AI_SCHEMA,
        instructions,
        JSON.stringify(summaryInput),
      );
      return res || fallback;
    } catch {
      return fallback;
    }
  }

  buildMonthlyReport(
    reviews: any[],
    analysis: any,
    kpis: any,
    aiSummary: any,
    reportFrequency: string,
    startDateStr: string,
    endDateStr: string,
    totalReviewsAvailable: number,
  ): any {
    const reviewsAnalysis = analysis.reviews_analysis || [];

    const sentimentCounter: Record<string, number> = { Positive: 0, Neutral: 0, Negative: 0 };
    const strengthsCounter: Record<string, number> = {};
    const issuesCounter: Record<string, number> = {};

    for (const ar of reviewsAnalysis) {
      const sentiment = ar.sentiment || 'Neutral';
      sentimentCounter[sentiment] = (sentimentCounter[sentiment] || 0) + 1;

      for (const s of ar.strengths || []) {
        strengthsCounter[s] = (strengthsCounter[s] || 0) + 1;
      }
      for (const i of ar.issues || []) {
        issuesCounter[i] = (issuesCounter[i] || 0) + 1;
      }
    }

    const totalReviews = reviews.length;
    const percent = (count: number) => (totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0);

    const sentimentBreakdown = {
      positive: {
        percent: percent(sentimentCounter.Positive),
        count: sentimentCounter.Positive,
      },
      neutral: {
        percent: percent(sentimentCounter.Neutral),
        count: sentimentCounter.Neutral,
      },
      negative: {
        percent: percent(sentimentCounter.Negative),
        count: sentimentCounter.Negative,
      },
    };

    const topComplaints = Object.entries(issuesCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => ({ issue: k, mentions: v }));

    const topPraises = Object.entries(strengthsCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => ({ strength: k, mentions: v }));

    const capitalizedFreq = reportFrequency.charAt(0).toUpperCase() + reportFrequency.slice(1);

    return {
      report_title: `${capitalizedFreq} Report: ${startDateStr} to ${endDateStr}`,
      period: `${startDateStr} to ${endDateStr}`,
      date_range: {
        start_date: startDateStr,
        end_date: endDateStr,
      },
      report_frequency: reportFrequency,
      reviews_in_period: totalReviews,
      total_reviews_available: totalReviewsAvailable,
      kpis,
      executive_summary: aiSummary?.executive_summary || 'Executive summary of performance.',
      review_volume_trend: [
        { period: 'Week 1', count: Math.ceil(totalReviews / 4) },
        { period: 'Week 2', count: Math.floor(totalReviews / 4) },
        { period: 'Week 3', count: Math.floor(totalReviews / 4) },
        { period: 'Week 4', count: Math.floor(totalReviews / 4) },
      ],
      rating_trend: [
        { period: 'Week 1', rating: kpis?.avg_rating?.value || 4.5 },
        { period: 'Week 2', rating: kpis?.avg_rating?.value || 4.5 },
        { period: 'Week 3', rating: kpis?.avg_rating?.value || 4.5 },
        { period: 'Week 4', rating: kpis?.avg_rating?.value || 4.5 },
      ],
      sentiment_breakdown: sentimentBreakdown,
      top_complaints: topComplaints,
      top_praises: topPraises,
      ai_recommendations: aiSummary?.recommendations || [],
      action_plan: aiSummary?.action_plan || [],
    };
  }
}
