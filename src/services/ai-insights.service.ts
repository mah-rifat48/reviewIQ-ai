import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

const INSIGHTS_PROMPT_VERSION = 'ai_insights_v1';
const RECOMMENDATIONS_PROMPT_VERSION = 'program_recommendations_v1';

const INSIGHTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    areas_for_improvement: {
      type: 'array',
      items: { type: 'string' },
    },
    actionable_insights: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'strengths', 'areas_for_improvement', 'actionable_insights'],
};

const RECOMMENDATIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    actionable_recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          impact: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          effort: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          timeframe: { type: 'string' },
          action_steps: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: [
          'title',
          'description',
          'category',
          'impact',
          'effort',
          'timeframe',
          'action_steps',
        ],
      },
    },
  },
  required: ['actionable_recommendations'],
};

@Injectable()
export class AiInsightsService {
  constructor(private readonly openAiService: OpenAiService) {}

  extractEmergingAndDeclining(reviews: any[], reviewsAnalysis: any[]): { emerging: string[]; declining: string[] } {
    const emerging: string[] = [];
    const declining: string[] = [];

    for (const r of reviewsAnalysis) {
      if (r.sentiment === 'Positive') {
        emerging.push(...(r.strengths || []));
      } else if (r.sentiment === 'Negative') {
        declining.push(...(r.issues || []));
      }
    }

    return {
      emerging: Array.from(new Set(emerging)).slice(0, 5),
      declining: Array.from(new Set(declining)).slice(0, 5),
    };
  }

  normalizeCriteriaScores(rawCriteria: Record<string, number>): Record<string, number> {
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawCriteria)) {
      normalized[k] = Math.round((v / 5) * 100);
    }
    return normalized;
  }

  async generateAiInsights(insightsInput: Record<string, any>): Promise<any> {
    const instructions = `
You are a senior business intelligence and customer experience strategist.
Based on the provided review metrics and category scores, generate strategic insights.
Format output adhering to the schema.
`;
    return this.openAiService.generateJsonCached(
      'ai_insights',
      INSIGHTS_PROMPT_VERSION,
      insightsInput,
      'ai_insights',
      INSIGHTS_SCHEMA,
      instructions,
      JSON.stringify(insightsInput),
    );
  }

  async generateProgramRecommendations(recommendationsInput: Record<string, any>): Promise<any> {
    const instructions = `
You are an expert operational consultant for business improvement.
Generate a structured list of actionable recommendations for the business based on the supplied context.
Format output strictly matching the JSON schema.
`;
    return this.openAiService.generateJsonCached(
      'program_recommendations',
      RECOMMENDATIONS_PROMPT_VERSION,
      recommendationsInput,
      'program_recommendations',
      RECOMMENDATIONS_SCHEMA,
      instructions,
      JSON.stringify(recommendationsInput),
    );
  }
}
