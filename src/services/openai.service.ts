import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CacheService } from '../db/cache.service';

@Injectable()
export class OpenAiService {
  private client: OpenAI;
  private model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.client = new OpenAI({ apiKey });
  }

  getModel(): string {
    return this.model;
  }

  async generateStructuredJson<T = any>(
    schemaName: string,
    schema: Record<string, any>,
    instructions: string,
    inputText: string,
  ): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: instructions.trim() },
        { role: 'user', content: inputText.trim() },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          schema: schema,
          strict: true,
        },
      },
    });

    const rawText = (response.choices[0]?.message?.content || '').trim();
    if (!rawText) {
      throw new Error('OpenAI response did not include structured output.');
    }
    return JSON.parse(rawText);
  }

  async generateJsonCached<T = any>(
    kind: string,
    promptVersion: string,
    inputObj: Record<string, any>,
    schemaName: string,
    schema: Record<string, any>,
    instructions: string,
    inputText: string,
  ): Promise<T> {
    const cacheKey = this.cacheService.makeCacheKey(
      kind,
      this.model,
      promptVersion,
      inputObj,
    );

    const cached = await this.cacheService.getCachedResponse<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.generateStructuredJson<T>(
      schemaName,
      schema,
      instructions,
      inputText,
    );

    await this.cacheService.setCachedResponse(
      cacheKey,
      result,
      kind,
      this.model,
      promptVersion,
    );

    return result;
  }
}
