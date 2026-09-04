import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

const COMPETITOR_AI_PROMPT_VERSION = 'competitor_strategy_v1';

const COMPETITOR_AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    where_competitors_excel: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          action_items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'description', 'action_items'],
      },
    },
  },
  required: ['where_competitors_excel', 'recommendations'],
};

@Injectable()
export class CompetitorAnalysisService {
  constructor(private readonly openAiService: OpenAiService) {}

  estimateCriteriaScores(rating: number, priceLevel: number = 2): Record<string, number> {
    const base = rating || 3.5;
    return {
      Service: Number(Math.min(5, Math.max(1, base + (Math.random() * 0.4 - 0.2))).toFixed(1)),
      Quality: Number(Math.min(5, Math.max(1, base + (Math.random() * 0.4 - 0.2))).toFixed(1)),
      Atmosphere: Number(Math.min(5, Math.max(1, base + (Math.random() * 0.4 - 0.2))).toFixed(1)),
      Value: Number(Math.min(5, Math.max(1, base + (Math.random() * 0.4 - 0.2))).toFixed(1)),
      Cleanliness: Number(Math.min(5, Math.max(1, base + (Math.random() * 0.4 - 0.2))).toFixed(1)),
    };
  }

  buildPerformanceComparison(allBusinesses: any[]): any {
    return allBusinesses.map((b) => ({
      name: b.name,
      rating: b.rating,
      reviews: b.reviews,
      sentiment: b.sentiment,
      response_rate: b.response_rate,
    }));
  }

  buildCategoryRadar(allBusinesses: any[]): any {
    const categories = ['Service', 'Quality', 'Atmosphere', 'Value', 'Cleanliness'];
    return categories.map((cat) => {
      const row: Record<string, any> = { category: cat };
      for (const b of allBusinesses) {
        row[b.name] = Math.round(((b.criteria?.[cat] || 4.0) / 5) * 100);
      }
      return row;
    });
  }

  buildCriteriaComparison(allBusinesses: any[], myBusinessName: string): any[] {
    const categories = ['Service', 'Quality', 'Atmosphere', 'Value', 'Cleanliness'];
    return categories.map((cat) => {
      const myObj = allBusinesses.find((b) => b.name === myBusinessName);
      const myScore = myObj?.criteria?.[cat] || 4.0;

      const compScores = allBusinesses
        .filter((b) => b.name !== myBusinessName)
        .map((b) => b.criteria?.[cat] || 4.0);

      const avgCompScore = compScores.length
        ? Number((compScores.reduce((a, b) => a + b, 0) / compScores.length).toFixed(1))
        : 4.0;

      return {
        criteria: cat,
        my_score: myScore,
        competitor_avg: avgCompScore,
        difference: Number((myScore - avgCompScore).toFixed(1)),
      };
    });
  }

  extractAdvantages(criteriaComparison: any[], myBusinessName: string): { advantages: string[]; whereCompetitorsExcel: string[] } {
    const advantages: string[] = [];
    const excel: string[] = [];

    for (const c of criteriaComparison) {
      if (c.difference > 0) {
        advantages.push(`Higher ${c.criteria} rating (+${c.difference} pts)`);
      } else if (c.difference < 0) {
        excel.push(`Competitors lead in ${c.criteria} (${c.difference} pts lower)`);
      }
    }

    return { advantages, whereCompetitorsExcel: excel };
  }

  buildCompetitorExcelEvidence(myBusiness: any, competitorBusinesses: any[]): any[] {
    return competitorBusinesses.map((c) => ({
      competitor_name: c.name,
      rating_lead: Number((c.rating - myBusiness.rating).toFixed(1)),
      reviews_lead: c.reviews - myBusiness.reviews,
    }));
  }

  async generateCompetitiveStrategy(strategyInput: Record<string, any>): Promise<any> {
    const instructions = `
You are a top-tier competitive market intelligence analyst.
Analyze the business metrics relative to competitors and output strategic recommendations.
Match the JSON schema strictly.
`;
    return this.openAiService.generateJsonCached(
      'competitor_strategy',
      COMPETITOR_AI_PROMPT_VERSION,
      strategyInput,
      'competitor_strategy',
      COMPETITOR_AI_SCHEMA,
      instructions,
      JSON.stringify(strategyInput),
    );
  }
}
