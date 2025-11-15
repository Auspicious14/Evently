import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';
import RateLimitPlugin from '@twitter-api-v2/plugin-rate-limit';
import { delay } from '../x-integration.utils';

@Injectable()
export class TwitterSearchService {
  private readonly logger = new Logger(TwitterSearchService.name);
  private twitterClient: TwitterApi;
  private rateLimitPlugin: RateLimitPlugin;
  private sinceIds = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    this.twitterClient = new TwitterApi(
      this.configService.get<string>('TWITTER_BEARER_TOKEN') as string,
    );

    this.rateLimitPlugin = new RateLimitPlugin();
    this.twitterClient.plugins = [this.rateLimitPlugin];
  }

  async searchWithRetry(
    query: string,
    maxResults: number,
    sinceId?: string,
    retries = 1,
  ): Promise<any[]> {
    try {
      const response = await this.twitterClient.v2.search(query, {
        max_results: maxResults,
        'tweet.fields': [
          'created_at',
          'text',
          'entities',
          'author_id',
          'public_metrics',
        ],
        expansions: ['author_id'],
      });

      // Check rate limit before search
      const rateLimit = await this.rateLimitPlugin.v2.getRateLimit(
        'tweets/search/recent',
      );
      if (rateLimit && rateLimit.remaining === 0) {
        const waitTime = rateLimit.reset * 1000 - Date.now() + 1000; // Add buffer
        if (waitTime > 0) {
          this.logger.log(
            `Rate limit exhausted, waiting ${waitTime / 1000} seconds...`,
          );
          await delay(waitTime);
        }
      }

      return response.data?.data || [];
    } catch (error: any) {
      if ((error.code === 429 || error.rateLimit) && retries > 0) {
        // Use plugin to get accurate wait time
        const rateLimit = await this.rateLimitPlugin.v2.getRateLimit(
          'tweets/search/recent',
        );
        const waitTime = rateLimit
          ? rateLimit.reset * 1000 - Date.now() + 1000
          : 60000;
        this.logger.warn(
          `Rate limit hit for query "${query}", retrying after ${
            waitTime / 1000
          }s...`,
        );
        await delay(waitTime);
        return this.searchWithRetry(query, maxResults, sinceId, retries - 1);
      }
      throw error;
    }
  }

  getSinceId(query: string): string | undefined {
    return this.sinceIds.get(query);
  }

  setSinceId(query: string, sinceId: string): void {
    this.sinceIds.set(query, sinceId);
  }

  getSearchQueries(): string[] {
    const cityGroups = [
      'Lagos OR Abuja OR "Port Harcourt"',
      'Kano OR Ibadan OR "Ilorin"',
    ];

    const baseEventTerms =
      '(event OR conference OR workshop OR summit OR hackathon)';
    const baseFilters = '-is:retweet -is:reply lang:en';

    const searchQueries = cityGroups.map(
      (group) => `${baseEventTerms} (${group}) ${baseFilters}`,
    );

    searchQueries.push(
      'Nigeria (blockchain OR fintech OR AI OR machine learning OR cybersecurity) event Nigeria ${baseFilters}',
    );

    return searchQueries;
  }
}
