import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';
import { EventsService } from '../../events/events.service';
import { delay, formatEventTweet } from '../x-integration.utils';

@Injectable()
export class TwitterPostingService {
  private readonly logger = new Logger(TwitterPostingService.name);
  private readWriteClient: TwitterApi;

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {
    this.readWriteClient = new TwitterApi({
      appKey: this.configService.get<string>('TWITTER_APP_KEY') as string,
      appSecret: this.configService.get<string>('TWITTER_APP_SECRET') as string,
      accessToken: this.configService.get<string>(
        'TWITTER_ACCESS_TOKEN',
      ) as string,
      accessSecret: this.configService.get<string>(
        'TWITTER_ACCESS_SECRET',
      ) as string,
    });
  }

  async postEventWithRetry(event: any, retries = 1): Promise<void> {
    try {
      const tweetText = formatEventTweet(event);
      const tweet = await this.readWriteClient.v2.tweet(tweetText);
      await this.eventsService.markAsPostedToX(event._id as string);
      this.logger.log(
        `Posted event to X: ${event.title} (Tweet ID: ${tweet.data.id})`,
      );
    } catch (error: any) {
      if ((error.code === 429 || error.rateLimit) && retries > 0) {
        this.logger.warn(
          `Rate limit hit for posting event ${event._id}, retrying after 60s...`,
        );
        await delay(60000);
        return this.postEventWithRetry(event, retries - 1);
      }
      throw error;
    }
  }

  async postApprovedEvents(): Promise<number> {
    this.logger.log('Posting approved events to X...');
    try {
      const events: any = await this.eventsService.getEventsToPost();
      let postedCount = 0;

      const batchSize = 5;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        const batchPromises = batch.map((event) =>
          this.postEventWithRetry(event),
        );
        const results = await Promise.allSettled(batchPromises);

        for (const result of results) {
          if (result.status === 'fulfilled') {
            postedCount++;
          } else {
            this.logger.error(`Failed to post event:`, result.reason);
          }
        }

        await delay(5000);
      }

      this.logger.log(`Posted ${postedCount} events to X`);
      return postedCount;
    } catch (error: any) {
      this.logger.error('Failed to post events to X:', error.message);
      throw error;
    }
  }
}