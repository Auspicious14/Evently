import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { CreateEventDto } from '../events/dto/create-event.dto';
import { TweetProcessorService } from './services/tweet-processor.service';
import { TwitterSearchService } from './services/twitter-search.service';
import { TwitterPostingService } from './services/twitter-posting.service';
import { delay } from './x-integration.utils';

@Injectable()
export class XIntegrationService {
  private readonly logger = new Logger(XIntegrationService.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly tweetProcessor: TweetProcessorService,
    private readonly twitterSearch: TwitterSearchService,
    private readonly twitterPosting: TwitterPostingService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'Africa/Lagos',
  })
  async handleCron() {
    this.logger.log('Running X integration cron job for Nigerian events...');
    try {
      const searchQueries = this.twitterSearch.getSearchQueries();
      let processedCount = 0;
      const maxResultsPerQuery = 100;

      for (const query of searchQueries) {
        try {
          const sinceId = this.twitterSearch.getSinceId(query);
          const { tweets, includes } = await this.twitterSearch.searchWithRetry(
            query,
            maxResultsPerQuery,
            sinceId,
          );

          const eventsToCreate: CreateEventDto[] = [];

          for (const tweet of tweets) {
            try {
              const eventData = await this.tweetProcessor.parseTweetToEvent(
                tweet,
                includes,
              );
              if (eventData) {
                eventsToCreate.push(eventData);
                this.logger.log(
                  `Queued event from tweet: ${eventData.title} (ID: ${tweet.id})`,
                );
              }
            } catch (error) {
              this.logger.warn(`Failed to process tweet ${tweet.id}:`, error);
            }
          }

          if (eventsToCreate.length > 0) {
            const result = await this.eventsService.createBulk(eventsToCreate);
            processedCount += result.data.length;
          }

          // Update sinceId for next search
          if (tweets.length > 0) {
            this.twitterSearch.setSinceId(query, tweets[0].id);
          }
        } catch (error) {
          this.logger.error(`Failed query: ${query}`, error);
        }

        await delay(3000);
      }

      this.logger.log(
        `Processed ${processedCount} Nigerian tweets into events`,
      );
    } catch (error: any) {
      this.logger.error('Failed to fetch or process tweets:', error.message);
    }
  }

  // @Cron(CronExpression.EVERY_HOUR)
  // async postApprovedEvents() {
  //   this.logger.log('Posting approved events to X...');
  //   try {
  //     await this.twitterPosting.postApprovedEvents();
  //   } catch (error: any) {
  //     this.logger.error('Failed to post events to X:', error.message);
  //   }
  // }
}
