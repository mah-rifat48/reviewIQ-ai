import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

const PROMPT_VERSION = 'review_openai_v1';
const CRITERIA = ['Service', 'Quality', 'Atmosphere', 'Value', 'Cleanliness'];

const CRITERIA_KEYWORDS: Record<string, string[]> = {
  Service: ['service', 'staff', 'wait', 'slow', 'fast', 'rude', 'friendly'],
  Quality: ['quality', 'coffee', 'food', 'taste', 'fresh', 'excellent', 'good'],
  Atmosphere: ['atmosphere', 'ambiance', 'ambience', 'environment', 'decor', 'music'],
  Value: ['price', 'priced', 'overpriced', 'cheap', 'expensive', 'value'],
  Cleanliness: ['clean', 'dirty', 'hygiene', 'messy', 'neat'],
};

const REVIEW_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sentiment: {
      type: 'string',
      enum: ['Positive', 'Neutral', 'Negative'],
    },
    emotions: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'Satisfaction',
          'Happiness',
          'Frustration',
          'Disappointment',
          'Anger',
          'Neutral',
        ],
      },
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    issues: {
      type: 'array',
      items: { type: 'string' },
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['sentiment', 'emotions', 'strengths', 'issues', 'keywords'],
};

const REVIEW_ANALYSIS_INSTRUCTIONS = `
You are an expert customer-experience analyst for local businesses.
Analyze exactly one customer review using only the supplied review text.

Return compact data that matches the schema.
Rules:
- Use exact or near-exact phrases from the review for strengths, issues, and keywords.
- Keep every phrase under 12 words.
- Keywords must be meaningful short phrases, not single generic words.
- Choose sentiment as Positive, Neutral, or Negative.
- If sentiment is Positive, fill strengths and keep issues empty.
- If sentiment is Negative, fill issues and keep strengths empty.
- If sentiment is Neutral or mixed, you may fill both strengths and issues.
- Choose emotions only from the schema enum.
- Do not invent names, metrics, facts, or details not present in the review.
`;

@Injectable()
export class DashboardAnalysisService {
  constructor(private readonly openAiService: OpenAiService) {}

  extractCriteriaScores(sentiment: string, keywords: string[]): Record<string, number> {
    const sentimentScoreMap: Record<string, number> = {
      Positive: 5,
      Neutral: 3,
      Negative: 2,
    };

    const baseScore = sentimentScoreMap[sentiment] || 3;
    const keywordText = keywords.join(' ').toLowerCase();
    const criteriaScores: Record<string, number> = {};

    for (const [criteria, triggers] of Object.entries(CRITERIA_KEYWORDS)) {
      if (triggers.some((trigger) => keywordText.includes(trigger))) {
        criteriaScores[criteria] = baseScore;
      }
    }

    return criteriaScores;
  }

  async analyzeReview(reviewText: string): Promise<any> {
    if (!reviewText || !reviewText.trim()) {
      return {
        sentiment: 'Neutral',
        emotions: ['Neutral'],
        strengths: [],
        issues: [],
        keywords: [],
        criteria_scores: {},
      };
    }

    const data = await this.openAiService.generateJsonCached(
      'review_analysis',
      PROMPT_VERSION,
      { review_text: reviewText },
      'review_analysis',
      REVIEW_ANALYSIS_SCHEMA,
      REVIEW_ANALYSIS_INSTRUCTIONS,
      `Review text:\n"""${reviewText}"""`,
    );

    const sentiment =
      data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1).toLowerCase();
    const strengths = (data.strengths || []).map((s: string) => s.trim()).filter(Boolean);
    const issues = (data.issues || []).map((i: string) => i.trim()).filter(Boolean);
    const emotions = data.emotions || [];
    const keywords = data.keywords || [];

    const criteriaKeywords = [
      ...strengths.map((s: string) => s.toLowerCase()),
      ...issues.map((i: string) => i.toLowerCase()),
    ];
    const criteriaScores = this.extractCriteriaScores(sentiment, criteriaKeywords);

    return {
      sentiment,
      emotions,
      strengths,
      issues,
      keywords,
      criteria_scores: criteriaScores,
    };
  }

  async analyzeReviews(reviews: any[]): Promise<{ reviews_analysis: any[] }> {
    const results: any[] = [];
    for (const r of reviews) {
      const analysis = await this.analyzeReview(r.text || '');
      results.push({
        ...r,
        ...analysis,
      });
    }
    return { reviews_analysis: results };
  }
}
