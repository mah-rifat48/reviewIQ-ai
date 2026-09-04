import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

const MONTHLY_AI_PROMPT_VERSION = 'monthly_report_ai_v1';

const MONTHLY_AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executive_summary: { type: 'string' },
    key_highlights: {
      type: 'array',
      items: { type: 'string' },
    },
    critical_concerns: {
      type: 'array',
      items: { type: 'string' },
    },
    strategic_advice: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'executive_summary',
    'key_highlights',
    'critical_concerns',
    'strategic_advice',
  ],
};

@Injectable()
export class MonthlyReportService {
  constructor(private readonly openAiService: OpenAiService) {}

  normalizeReportFrequency(frequency: string): string {
    const valid = ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually'];
    const norm = (frequency || 'monthly').toLowerCase().trim();
    if (!valid.includes(norm)) {
      return 'monthly';
    }
    return norm;
  }

  filterReviewsByDate(reviews: any[], startDateStr: string, endDateStr: string): any[] {
    const start = new Date(startDateStr).getTime() / 1000;
    const end = new Date(endDateStr).getTime() / 1000 + 86400; // include full end day

    return reviews.filter((r) => {
      if (!r.time) return true;
      return r.time >= start && r.time <= end;
    });
  }

  buildReportKpis(reviews: any[], analysis: any): any {
    const reviewsAnalysis = analysis.reviews_analysis || [];
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    const issueMap: Record<string, number> = {};
    const strengthMap: Record<string, number> = {};

    for (const r of reviewsAnalysis) {
      if (r.sentiment === 'Positive') positive++;
      else if (r.sentiment === 'Negative') negative++;
      else neutral++;

      for (const issue of r.issues || []) {
        issueMap[issue] = (issueMap[issue] || 0) + 1;
      }
      for (const strength of r.strengths || []) {
        strengthMap[strength] = (strengthMap[strength] || 0) + 1;
      }
    }

    const topIssues = Object.entries(issueMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => ({ issue: k, count: v }));

    const topStrengths = Object.entries(strengthMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => ({ strength: k, count: v }));

    return {
      total_reviews_analyzed: reviews.length,
      sentiment_breakdown: { positive, neutral, negative },
      top_issues: topIssues,
      top_strengths: topStrengths,
    };
  }

  async generateMonthlyAiSummary(summaryInput: Record<string, any>): Promise<any> {
    const instructions = `
You are an executive business analyst summarizing performance over a designated reporting period.
Return a structured JSON object strictly matching the schema.
`;
    return this.openAiService.generateJsonCached(
      'monthly_report_ai',
      MONTHLY_AI_PROMPT_VERSION,
      summaryInput,
      'monthly_report_ai',
      MONTHLY_AI_SCHEMA,
      instructions,
      JSON.stringify(summaryInput),
    );
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
    return {
      report_frequency: reportFrequency,
      date_range: {
        start_date: startDateStr,
        end_date: endDateStr,
      },
      total_reviews_available: totalReviewsAvailable,
      kpis,
      ai_summary: aiSummary,
      reviews_analyzed: reviews.length,
    };
  }
}
