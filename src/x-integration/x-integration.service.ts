import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { TwitterApi } from 'twitter-api-v2';
import { CreateEventDto } from '../events/dto/create-event.dto';

@Injectable()
export class XIntegrationService {
  private readonly logger = new Logger(XIntegrationService.name);
  private twitterClient: TwitterApi;
  private readWriteClient: TwitterApi;

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {
    // Initialize read-only client (for searching tweets)
    this.twitterClient = new TwitterApi(
      this.configService.get<string>('TWITTER_BEARER_TOKEN'),
    );

    // Initialize read-write client (for posting tweets)
    this.readWriteClient = new TwitterApi({
      appKey: this.configService.get<string>('TWITTER_API_KEY'),
      appSecret: this.configService.get<string>('TWITTER_API_SECRET'),
      accessToken: this.configService.get<string>('TWITTER_ACCESS_TOKEN'),
      accessSecret: this.configService.get<string>('TWITTER_ACCESS_SECRET'),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running X integration cron job...');
    try {
      // Search for event-related tweets
      const tweets = await this.twitterClient.v2.search(
        'events OR meetup OR conference -is:retweet lang:en',
        {
          max_results: 10,
          'tweet.fields': ['created_at', 'text', 'entities', 'author_id'],
          expansions: ['author_id'],
        },
      );

      let processedCount = 0;

      // Check if tweets.data exists and is iterable
      if (tweets.data && tweets.data.data) {
        for (const tweet of tweets.data.data) {
          try {
            const eventData = this.parseTweetToEvent(tweet);
            if (eventData) {
              await this.eventsService.create(eventData);
              processedCount++;
              this.logger.log(`Created event from tweet: ${eventData.title}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to process tweet ${tweet.id}:`, error);
          }
        }
      }

      this.logger.log(`Processed ${processedCount} tweets into events`);
    } catch (error: any) {
      if (error.code === 429 || error.rateLimit) {
        this.logger.warn('Rate limit hit, will retry on next scheduled run');
      } else {
        this.logger.error('Failed to fetch or process tweets:', error.message);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async postApprovedEvents() {
    this.logger.log('Posting approved events to X...');
    try {
      const events: any = await this.eventsService.findAll({
        status: 'approved',
        postedToX: false,
      });

      let postedCount = 0;

      for (const event of events) {
        try {
          const tweetText = this.formatEventTweet(event);
          
          // Post tweet
          const tweet = await this.readWriteClient.v2.tweet(tweetText);
          
          // Mark as posted
          await this.eventsService.markAsPostedToX(event._id);
          
          postedCount++;
          this.logger.log(`Posted event to X: ${event.title} (Tweet ID: ${tweet.data.id})`);
          
          // Add delay to avoid rate limits (3 seconds between tweets)
          await this.delay(3000);
        } catch (error: any) {
          this.logger.error(`Failed to post event ${event._id}:`, error.message);
        }
      }

      this.logger.log(`Posted ${postedCount} events to X`);
    } catch (error: any) {
      if (error.code === 429 || error.rateLimit) {
        this.logger.warn('Rate limit hit for posting, will retry next hour');
      } else {
        this.logger.error('Failed to post events to X:', error.message);
      }
    }
  }

  private formatEventTweet(event: any): string {
    const maxLength = 280;
    const eventUrl = event.link ? `\n🔗 ${event.link}` : '';
    
    let tweet = `🎉 ${event.title}\n`;
    tweet += `📅 ${this.formatDate(event.date)}\n`;
    tweet += `📍 ${event.location}\n`;
    
    if (event.isFree) {
      tweet += `💰 FREE EVENT\n`;
    }
    
    // Add description if space allows
    const remainingSpace = maxLength - tweet.length - eventUrl.length - 10;
    if (event.description && remainingSpace > 50) {
      const truncatedDesc = event.description.substring(0, remainingSpace) + '...';
      tweet += `\n${truncatedDesc}`;
    }
    
    tweet += eventUrl;
    
    return tweet.substring(0, maxLength);
  }

  private parseTweetToEvent(tweet: any): CreateEventDto | null {
    try {
      const text = tweet.text.toLowerCase();
      
      // Skip if doesn't contain event keywords
      if (!this.containsEventKeywords(text)) {
        return null;
      }

      // Extract date (simple regex patterns)
      const date = this.extractDate(tweet.text, tweet.created_at);
      
      // Extract location
      const location = this.extractLocation(tweet.text);
      
      // Determine category
      const category = this.determineCategory(tweet.text);
      
      // Extract URL
      const link = tweet.entities?.urls?.[0]?.expanded_url || null;
      
      // Extract title (first line or first 50 chars)
      const title = this.extractTitle(tweet.text);
      
      // Check if free
      const isFree = this.checkIfFree(tweet.text);

      // Only create event if we have minimum required info
      if (!title || !date) {
        return null;
      }

      return {
        title,
        description: tweet.text,
        date: date.toISOString(),
        location: location || 'Online',
        category: category || 'General',
        link,
        isFree,
        sourceType: 'twitter',
        sourceTweetId: tweet.id,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse tweet:`, error);
      return null;
    }
  }

  private containsEventKeywords(text: string): boolean {
    const keywords = [
      'event', 'meetup', 'conference', 'workshop', 'webinar',
      'summit', 'hackathon', 'seminar', 'gathering', 'session'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractTitle(text: string): string {
    // Get first line or first 50 characters
    const firstLine = text.split('\n')[0];
    return firstLine.length > 50 
      ? firstLine.substring(0, 50).trim() 
      : firstLine.trim();
  }

  private extractDate(text: string, fallbackDate: string): Date | null {
    // Common date patterns
    const patterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,    // YYYY-MM-DD
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          return new Date(match[0]);
        } catch (error) {
          // Continue to next pattern
        }
      }
    }

    // Fallback to tweet creation date + 7 days (assume future event)
    return new Date(new Date(fallbackDate).getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  private extractLocation(text: string): string | null {
    // Look for common location patterns
    const locationMatch = text.match(/(?:at|in|@)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/);
    return locationMatch ? locationMatch[1].trim() : null;
  }

  private determineCategory(text: string): string {
    const categoryKeywords = {
      'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning'],
      'Web3': ['web3', 'blockchain', 'crypto', 'nft', 'defi'],
      'Tech': ['tech', 'software', 'developer', 'coding', 'programming'],
      'Business': ['business', 'startup', 'entrepreneur', 'networking'],
      'Design': ['design', 'ui', 'ux', 'creative'],
    };

    const lowerText = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category;
      }
    }

    return 'General';
  }

  private checkIfFree(text: string): boolean {
    const freeKeywords = ['free', 'no cost', 'complimentary', 'free admission', 'free entry'];
    const lowerText = text.toLowerCase();
    return freeKeywords.some(keyword => lowerText.includes(keyword));
  }

  private formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
        }
