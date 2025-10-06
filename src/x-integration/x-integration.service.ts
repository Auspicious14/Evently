import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { TwitterApi } from 'twitter-api-v2';
import { CreateEventDto } from '../events/dto/create-event.dto';

@Injectable()
export class XIntegrationService {
  private readonly logger = new Logger(XIntegrationService.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running X integration cron job...');
    try {
      const client = new TwitterApi(
        this.configService.get<string>('TWITTER_BEARER_TOKEN')!,
      );
      const tweets = await client.v2.search(
        'events OR meetup OR conference -is:retweet',
        {
          max_results: 10,
          'tweet.fields': ['created_at', 'text', 'entities'],
        },
      );

      for (const tweet of tweets) {
        // Simple parsing logic (enhance as needed)
        const eventData = this.parseTweetToEvent(tweet);
        if (eventData) {
          await this.eventsService.create(eventData);
          this.logger.log(`Created event from tweet: ${eventData.title}`);
        }
      }
    } catch (error) {
      if (error.rateLimitError) {
        this.logger.warn('Rate limit hit, retry later');
      } else {
        this.logger.error('Failed to fetch or process tweets', error);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async postApprovedEvents() {
    this.logger.log('Posting approved events to X...');
    try {
      const client = new TwitterApi({
        appKey: this.configService.get<string>('TWITTER_APP_KEY')!,
        appSecret: this.configService.get<string>('TWITTER_APP_SECRET')!,
        accessToken: this.configService.get<string>('TWITTER_ACCESS_TOKEN')!,
        accessSecret: this.configService.get<string>('TWITTER_ACCESS_SECRET')!,
      });

      const events: any = await this.eventsService.findAll({
        status: 'approved',
        postedToX: false,
      });
      for (const event of events) {
        const tweetText = `New Event: ${event.title} on ${event.date.toDateString()} at ${event.location}. ${event.description ? event.description.substring(0, 100) + '...' : ''} ${event.link ? event.link : ''}`;
        await client.v2.tweet(tweetText);
        await this.eventsService.markAsPostedToX(event._id);
        this.logger.log(`Posted event to X: ${event.title}`);
      }
    } catch (error) {
      if (error.rateLimitError) {
        this.logger.warn('Rate limit hit for posting, retry later');
      } else {
        this.logger.error('Failed to post events to X', error);
      }
    }
  }

  private parseTweetToEvent(tweet: any): CreateEventDto | null {
    // Implement parsing logic to extract title, description, date, location, category, link
    // Return null if not a valid event
    // Example stub:
    return {
      title: tweet.text.substring(0, 50),
      description: tweet.text,
      date: new Date(tweet.created_at).toDateString(),
      location: 'Unknown',
      category: 'AI', // Determine dynamically if possible
      link: tweet.entities?.urls?.[0]?.expanded_url,
      isFree: true,
    };
  }
}
