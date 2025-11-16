import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { TwitterApi } from 'twitter-api-v2';
import { CreateEventDto } from '../events/dto/create-event.dto';
import RateLimitPlugin from '@twitter-api-v2/plugin-rate-limit';

@Injectable()
export class XIntegrationService {
  private readonly logger = new Logger(XIntegrationService.name);
  private twitterClient: TwitterApi;
  private readWriteClient: TwitterApi;
  private rateLimitPlugin: RateLimitPlugin;
  private spamRegex: RegExp;
  private nigeriaLocationRegex: RegExp;
  private strongKeywordRegex: RegExp;
  private dateIndicatorRegex: RegExp;
  private nextDayRegex: RegExp;
  private timeIndicatorRegex: RegExp;
  private emojiRegex: RegExp;
  private badTitlePatterns: RegExp[];
  private datePatterns: RegExp[];
  private timePatterns: RegExp[];

  private sinceIds = new Map<string, string>();

  private readonly nigeriaLocations = [
    'lagos',
    'abuja',
    'port harcourt',
    'kano',
    'ibadan',
    'benin city',
    'kaduna',
    'enugu',
    'jos',
    'ilorin',
    'aba',
    'onitsha',
    'warri',
    'calabar',
    'abeokuta',
    'akure',
    'bauchi',
    'maiduguri',
    'zaria',
    'ile-ife',
    'owerri',
    'uyo',
    'sokoto',
    'ogbomosho',
    'ife',
    'ikeja',
    'victoria island',
    'lekki',
    'yaba',
    'surulere',
    'ikoyi',
    'ajah',
    'ogudu',
    'maryland',
    'garki',
    'wuse',
    'maitama',
    'asokoro',
    'trans amadi',
    'gra',
    'rivers state',
    'lagos state',
    'fct',
  ];

  private readonly spamKeywords = [
    'dm me',
    'direct message',
    'pm me',
    'message me',
    'facetime',
    'meetup dm',
    'available for',
    'escort',
    'adult',
    'hookup',
    'dating',
    'onlyfans',
    'sugar daddy',
    'sugar mummy',
    'sugar baby',
    'forex',
    'bitcoin profit',
    'crypto scam',
    'get rich',
    'make money fast',
    'investment opportunity',
    'double your money',
    'casino',
    'trading signal',
    'send money',
    'wire transfer',
    'paypal',
    'cashapp',
    'venmo',
    'zelle',
    'bank transfer',
    'earn from home',
    'passive income',
    'mlm',
    'pyramid scheme',
    'airdrop',
    'free crypto',
    'pump and dump',
    'binary options',
    'quick cash',
    'side hustle',
    'nude',
    'porn',
    'sex',
    'xxx',
    '18+',
    'nsfw',
    'hook up',
    'one night stand',
    'casual encounter',
    'massage service',
    'body rub',
    'erotic',
    'sensual',
    'call girl',
    'prostitute',
    'booty call',
    'quick loan',
    'bad credit',
    'no credit check',
    'guaranteed approval',
    'buy followers',
    'increase likes',
    'hack account',
    'recover account',
    'password reset',
    'cancel anytime',
    'limited time offer',
    'act now',
    'urgent',
    'exclusive deal',
    'giveaway scam',
    'fake news',
    'clickbait',
  ];

  private readonly suspiciousPatterns = [
    /dm\s+(me|for|to|now|pls|please|quick|fast)/i,
    /whatsapp\s*(\+?\d{1,3})?[\s-]*\d{3}[\s-]*\d{3}[\s-]*\d{4}/i,
    /\$\$\$/,
    /💰💰💰/,
    /🔞/,
    /available\s+for\s+(facetime|meetup|hookups|calls|chats)/i,
    /join\s+my\s+(group|channel|telegram|whatsapp)/i,
    /click\s+here/i,
    /link\s+in\s+bio/i,
    /bio\s+link/i,
    /(earn|make|get|win)\s+\d{1,}[kK]?\s+(daily|weekly|monthly)/,
    /free\s+(gift|sample|trial|access)/i,
    /call\s+now/i,
    /text\s+me/i,
    /urgent\s+response/i,
  ];

  private readonly monthMap: { [key: string]: number } = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {
    // Initialize rate limit plugin
    this.rateLimitPlugin = new RateLimitPlugin();

    // Initialize Twitter clients
    this.twitterClient = new TwitterApi(
      this.configService.get<string>('TWITTER_BEARER_TOKEN') as string,
      { plugins: [this.rateLimitPlugin] },
    );

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

    // Pre-compile all regex patterns for performance
    this.initializeRegexPatterns();
  }

  private initializeRegexPatterns(): void {
    // Spam detection regex
    const keywordPatterns = this.spamKeywords.map((kw) =>
      kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const allPatterns = [
      ...keywordPatterns,
      ...this.suspiciousPatterns.map((p) => p.source),
    ];
    this.spamRegex = new RegExp(allPatterns.join('|'), 'i');

    // Nigeria location regex
    const locationPattern = this.nigeriaLocations
      .sort((a, b) => b.length - a.length)
      .map((loc) => loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    this.nigeriaLocationRegex = new RegExp(`\\b(${locationPattern})\\b`, 'i');

    // Strong event keywords regex
    const strongKeywords = [
      'conference',
      'summit',
      'workshop',
      'seminar',
      'hackathon',
      'meetup',
      'tech event',
      'startup event',
      'developer conference',
      'join us',
      'register now',
      'save the date',
      'rsvp',
      'tickets available',
      'upcoming event',
      'webinar',
      'panel discussion',
      'networking event',
      'launch event',
      'demo day',
      'pitch night',
    ];
    this.strongKeywordRegex = new RegExp(
      `\\b(${strongKeywords.join('|')})\\b`,
      'i',
    );

    // Date and time indicators
    this.dateIndicatorRegex =
      /\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;
    this.nextDayRegex =
      /\b(next|this|upcoming)\s+(week|month|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b/i;
    this.timeIndicatorRegex = /\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/i;

    // Emoji regex
    this.emojiRegex = /[\u{1F000}-\u{1FFFF}]/gu;

    // Bad title patterns
    this.badTitlePatterns = [
      /^(dm|call|text|whatsapp|join|click|link)/i,
      /available for/i,
      /^@\w+/,
      /^\d+$/,
      /^(rt|retweet|repost)/i,
      /^http/,
      /emoji\s*only/i,
    ];

    // Date patterns
    this.datePatterns = [
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
      /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
      /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    ];

    // Time patterns
    this.timePatterns = [
      /\b(\d{1,2}):(\d{2})\s?(am|pm|a\.m\.|p\.m\.)/i,
      /\b(\d{1,2})\s?(am|pm|a\.m\.|p\.m\.)/i,
      /\b(\d{1,2}):(\d{2})\b/,
    ];
  }

  // Run every 30 minutes - good balance for Free/Basic tier
  @Cron(CronExpression.EVERY_HOUR, {
    timeZone: 'Africa/Lagos',
  })
  async handleCron() {
    this.logger.log('Running X integration cron job for Nigerian events...');

    const startTime = Date.now();

    try {
      // Optimized queries - only 3 strategic queries
      const baseFilters = '-is:retweet -is:reply lang:en';
      const searchQueries = [
        // Major cities + events
        `(event OR conference OR workshop OR summit OR hackathon) (Lagos OR Abuja OR "Port Harcourt" OR Kano OR Ibadan) ${baseFilters}`,

        // Tech-specific with hashtags
        `(#LagosTech OR #NaijaTech OR #NigerianTech OR #TechInNigeria) (conference OR meetup OR hackathon OR event) ${baseFilters}`,

        // Tech domains
        `Nigeria (blockchain OR fintech OR AI OR "machine learning" OR cybersecurity OR startup) (summit OR conference OR event OR meetup) ${baseFilters}`,
      ];

      let processedCount = 0;
      const maxResultsPerQuery = 100;
      const eventsToCreate: CreateEventDto[] = [];
      const seenTweetIds = new Set<string>();

      // Process queries sequentially to respect rate limits
      for (const query of searchQueries) {
        try {
          const sinceId = this.sinceIds.get(query);
          const tweets = await this.searchWithRetry(
            query,
            maxResultsPerQuery,
            sinceId,
          );

          if (tweets.length > 0) {
            // Update sinceId to avoid duplicates in next run
            this.sinceIds.set(query, tweets[0].id);

            for (const tweet of tweets) {
              // Skip if already seen this tweet
              if (seenTweetIds.has(tweet.id)) continue;
              seenTweetIds.add(tweet.id);

              try {
                // Quick filters first (fast failures)
                if (this.isSpamOrInappropriate(tweet.text)) continue;
                if (!this.isNigeriaRelated(tweet.text)) continue;
                if (!this.isLikelyEvent(tweet.text)) continue;

                const eventData = this.parseTweetToEvent(tweet);
                if (eventData && this.isValidEventData(eventData)) {
                  eventsToCreate.push(eventData);
                  this.logger.log(
                    `Queued event: ${eventData.title} (ID: ${tweet.id})`,
                  );
                }
              } catch (error) {
                this.logger.warn(
                  `Failed to process tweet ${tweet.id}:`,
                  error instanceof Error ? error.message : error,
                );
              }
            }
          }

          // Add delay between queries to respect rate limits
          await this.delay(5000); // 5 seconds between queries
        } catch (error) {
          this.logger.error(
            `Failed query: ${query}`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      // Bulk create events for performance
      if (eventsToCreate.length > 0) {
        try {
          await this.eventsService.createBulk(eventsToCreate);
          processedCount = eventsToCreate.length;
        } catch (error) {
          this.logger.error(
            'Failed to bulk create events:',
            error instanceof Error ? error.message : error,
          );
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✅ Processed ${processedCount} events in ${duration}s`);
    } catch (error: any) {
      this.logger.error('Cron job failed:', error.message);
    }
  }

  private async searchWithRetry(
    query: string,
    maxResults: number,
    sinceId?: string,
    retries = 3,
  ): Promise<any[]> {
    try {
      // Check rate limit BEFORE making request
      const rateLimit = await this.rateLimitPlugin.v2.getRateLimit(
        'tweets/search/recent',
      );

      if (rateLimit && rateLimit.remaining === 0) {
        const waitTime = rateLimit.reset * 1000 - Date.now() + 2000; // Add 2s buffer
        if (waitTime > 0) {
          this.logger.warn(
            `⏳ Rate limit exhausted. Waiting ${Math.round(
              waitTime / 1000,
            )}s...`,
          );
          await this.delay(waitTime);
        }
      }

      // Make the search request
      const searchParams: any = {
        max_results: maxResults,
        'tweet.fields': [
          'created_at',
          'text',
          'entities',
          'author_id',
          'public_metrics',
        ],
        expansions: ['author_id'],
      };

      // Add since_id to avoid duplicates
      if (sinceId) {
        searchParams.since_id = sinceId;
      }

      const response = await this.twitterClient.v2.search(query, searchParams);

      // Log rate limit status
      if (response.rateLimit) {
        this.logger.log(
          `Rate limit: ${response.rateLimit.remaining}/${response.rateLimit.limit} remaining`,
        );
      }

      return response.data?.data || [];
    } catch (error: any) {
      if (
        (error.code === 429 || error.rateLimit?.remaining === 0) &&
        retries > 0
      ) {
        // Calculate accurate wait time
        let waitTime = 60000; // Default 60s

        try {
          const rateLimit = await this.rateLimitPlugin.v2.getRateLimit(
            'tweets/search/recent',
          );
          if (rateLimit) {
            waitTime = Math.max(
              rateLimit.reset * 1000 - Date.now() + 2000,
              60000,
            );
          }
        } catch {
          // Use default wait time if we can't get rate limit info
        }

        this.logger.warn(
          `⚠️ Rate limit hit. Retrying after ${Math.round(
            waitTime / 1000,
          )}s... (${retries} retries left)`,
        );

        await this.delay(waitTime);
        return this.searchWithRetry(query, maxResults, sinceId, retries - 1);
      }

      // Log error but don't throw - return empty array to continue
      this.logger.error(`Search failed: ${error.message || error}`);
      return [];
    }
  }

  private isSpamOrInappropriate(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Single regex test for performance
    if (this.spamRegex.test(lowerText)) return true;

    // Additional checks
    const linkCount = (text.match(/https?:\/\/\S+/g) || []).length;
    if (linkCount > 2) return true;

    if (text === text.toUpperCase() && text.length > 20) return true;

    const excessivePunctuation = (text.match(/[!?.]{3,}/g) || []).length;
    if (excessivePunctuation > 2) return true;

    return false;
  }

  private isNigeriaRelated(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Quick check for common keywords
    if (
      lowerText.includes('nigeria') ||
      lowerText.includes('nigerian') ||
      lowerText.includes('naija')
    ) {
      return true;
    }

    // Use pre-compiled regex for location check
    return this.nigeriaLocationRegex.test(lowerText);
  }

  private isLikelyEvent(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Must have strong event keyword
    if (!this.strongKeywordRegex.test(lowerText)) return false;

    // Must have date indicator
    return (
      this.dateIndicatorRegex.test(text) || this.nextDayRegex.test(lowerText)
    );
  }

  private isBadTitle(title: string): boolean {
    const emojiCount = (title.match(this.emojiRegex) || []).length;
    if (emojiCount > 2) return true;

    return this.badTitlePatterns.some((pattern) => pattern.test(title));
  }

  private parseTweetToEvent(tweet: any): CreateEventDto | null {
    try {
      const text = tweet.text;

      const date = this.extractDate(text, tweet.created_at);
      if (!date) return null;

      const time = this.extractTime(text);
      if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        date.setHours(hours, minutes);
      }

      const location = this.extractLocation(text);
      if (!location || !this.isNigeriaRelated(location)) return null;

      const title = this.extractTitle(text);
      if (!title || title.length < 15 || this.isBadTitle(title)) return null;

      const category = this.determineCategory(text);
      const link = tweet.entities?.urls?.[0]?.expanded_url || null;
      const isFree = this.checkIfFree(text);

      return {
        title,
        description: this.cleanDescription(text),
        date: date.toISOString(),
        location,
        category: category || 'Startup',
        link,
        isFree,
        sourceType: 'x',
        sourceTweetId: tweet.id,
        status: 'pending',
        postedToX: false,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse tweet ${tweet.id}:`, error);
      return null;
    }
  }

  private extractTitle(text: string): string {
    let cleanText = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .replace(/#\w+/g, '')
      .replace(this.emojiRegex, '')
      .trim();

    const lines = cleanText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const eventKeywords = [
      'event',
      'meetup',
      'conference',
      'workshop',
      'summit',
      'hackathon',
    ];

    // Prioritize lines with event keywords
    for (const line of lines) {
      if (
        line.length > 15 &&
        line.length < 120 &&
        /^[A-Z]/.test(line) &&
        !this.isBadTitle(line) &&
        eventKeywords.some((kw) => line.toLowerCase().includes(kw))
      ) {
        return this.capitalizeTitle(line);
      }
    }

    // Fallback to first valid line
    for (const line of lines) {
      if (line.length > 15 && line.length < 120 && !this.isBadTitle(line)) {
        return this.capitalizeTitle(line);
      }
    }

    return '';
  }

  private capitalizeTitle(title: string): string {
    return title
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private cleanDescription(text: string): string {
    let cleaned = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .replace(this.emojiRegex, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  }

  private extractDate(text: string, fallbackDate: string): Date | null {
    const currentYear = new Date().getFullYear();

    for (const pattern of this.datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let parsedDate: Date;

        // Handle "next/this Monday" pattern
        if (pattern.source.includes('next|this')) {
          const offset = match[1].toLowerCase() === 'next' ? 7 : 0;
          const dayName = match[2].toLowerCase();
          const days = [
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
          ];
          const targetDay = days.indexOf(dayName);
          parsedDate = new Date();
          const currentDay = parsedDate.getDay();
          let daysToAdd = (targetDay - currentDay + 7) % 7;
          if (daysToAdd === 0) daysToAdd = 7;
          daysToAdd += offset;
          parsedDate.setDate(parsedDate.getDate() + daysToAdd);
          parsedDate.setHours(0, 0, 0, 0);
        } else {
          let day, month, year;

          // Handle different date formats
          if (isNaN(parseInt(match[1]))) {
            // Month name first
            month = this.monthMap[match[1].toLowerCase().slice(0, 3)];
            day = parseInt(match[2], 10);
            year = match[3] ? parseInt(match[3], 10) : currentYear;
          } else if (match[1].length === 4) {
            // Year first (ISO format)
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            day = parseInt(match[3], 10);
          } else {
            // Day/month format
            if (parseInt(match[1], 10) > 12) {
              day = parseInt(match[1], 10);
              month = parseInt(match[2], 10) - 1;
            } else {
              month = parseInt(match[1], 10) - 1;
              day = parseInt(match[2], 10);
            }
            year = match[3] ? parseInt(match[3], 10) : currentYear;

            // Handle 2-digit years
            if (year < 100) {
              year += 2000;
            }
          }

          parsedDate = new Date(year, month, day);
        }

        // Validate parsed date is in the future (or recent past for fallback)
        if (
          !isNaN(parsedDate.getTime()) &&
          parsedDate > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ) {
          return parsedDate;
        }
      }
    }

    // Fallback: assume event is 7 days from tweet creation
    const fallback = new Date(
      new Date(fallbackDate).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    return fallback;
  }

  private extractTime(text: string): string | null {
    for (const pattern of this.timePatterns) {
      const match = text.match(pattern);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3] ? match[3].toLowerCase() : null;

        if (period && period.includes('p') && hours < 12) {
          hours += 12;
        } else if (period && period.includes('a') && hours === 12) {
          hours = 0;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}`;
      }
    }

    return null;
  }

  private extractLocation(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Check against known Nigeria locations (sorted by length for accurate matching)
    for (const location of this.nigeriaLocations.sort(
      (a, b) => b.length - a.length,
    )) {
      if (lowerText.includes(location)) {
        return location
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    // Try to extract location from patterns
    const locationPatterns = [
      /(?:at|in|venue:|location:|held at|join us at)\s+([A-Z][a-zA-Z\s,]+(?:Nigeria)?)/i,
      /📍\s*([A-Z][a-zA-Z\s,]+(?:Nigeria)?)/,
      /\b(in|at)\s+([A-Z][a-zA-Z\s,]+)\b/i,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const location = (match[2] || match[1]).trim().replace(/,$/, '');
        if (this.isNigeriaRelated(location)) {
          return location;
        }
      }
    }

    return null;
  }

  private determineCategory(text: string): string {
    const categoryKeywords = {
      AI: [
        'ai',
        'artificial intelligence',
        'machine learning',
        'ml',
        'deep learning',
        'chatgpt',
        'llm',
        'neural network',
      ],
      Fintech: [
        'fintech',
        'financial',
        'banking',
        'payment',
        'blockchain',
        'crypto',
        'defi',
        'web3',
      ],
      Startup: [
        'startup',
        'entrepreneur',
        'founder',
        'business',
        'pitch',
        'vc',
        'funding',
        'accelerator',
        'incubator',
      ],
      Coding: [
        'coding',
        'programming',
        'developer',
        'software',
        'hackathon',
        'dev',
        'engineer',
        'code',
        'api',
      ],
      Hardware: [
        'hardware',
        'iot',
        'robotics',
        'electronics',
        'embedded',
        'arduino',
        'raspberry pi',
      ],
      Design: [
        'design',
        'ui',
        'ux',
        'creative',
        'figma',
        'product design',
        'graphic design',
      ],
      Marketing: [
        'marketing',
        'growth',
        'sales',
        'branding',
        'seo',
        'content',
        'digital marketing',
        'social media',
      ],
      Cybersecurity: [
        'cybersecurity',
        'security',
        'infosec',
        'hacking',
        'privacy',
        'pen test',
        'ethical hacking',
      ],
      Virtual: [
        'virtual',
        'online',
        'remote',
        'webinar',
        'zoom',
        'virtual event',
        'live stream',
      ],
      HealthTech: [
        'healthtech',
        'medtech',
        'healthcare',
        'telemedicine',
        'ehealth',
      ],
      EdTech: ['edtech', 'education', 'learning', 'elearning', 'online course'],
      AgriTech: ['agritech', 'agriculture', 'farming', 'agribusiness'],
    };

    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => lowerText.includes(keyword))) {
        return category;
      }
    }

    return 'Startup';
  }

  private checkIfFree(text: string): boolean {
    const freeKeywords = [
      'free',
      'no cost',
      'complimentary',
      'free admission',
      'free entry',
      'free event',
      'free registration',
      'zero cost',
      'open to all',
      'no ticket required',
      'gratis',
    ];
    const paidKeywords = [
      'ticket',
      'buy',
      'purchase',
      'fee',
      'paid',
      'register and pay',
      'entrance fee',
      'cost',
      'price',
    ];
    const lowerText = text.toLowerCase();

    // If explicitly paid, return false
    if (paidKeywords.some((keyword) => lowerText.includes(keyword))) {
      return false;
    }

    // If explicitly free, return true
    return freeKeywords.some((keyword) => lowerText.includes(keyword));
  }

  private isValidEventData(eventData: CreateEventDto): boolean {
    if (!eventData.title || eventData.title.length < 15) {
      this.logger.debug('Invalid: title too short');
      return false;
    }

    if (!eventData.description || eventData.description.length < 50) {
      this.logger.debug('Invalid: description too short');
      return false;
    }

    if (!eventData.location) {
      this.logger.debug('Invalid: no location');
      return false;
    }

    const eventDate = new Date(eventData.date);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (eventDate < dayAgo) {
      this.logger.debug('Invalid: date in past');
      return false;
    }

    return true;
  }

  private formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  }

  private formatEventTweet(event: any): string {
    const maxLength = 280;
    const eventUrl = event.link ? `\n🔗 ${event.link}` : '';
    const hashtags = '\n#NigeriaEvents #TechNigeria';

    let tweet = `🎉 Upcoming: ${event.title}\n`;
    tweet += `📅 ${this.formatDate(event.date)}\n`;
    tweet += `📍 ${event.location}\n`;

    if (event.isFree) {
      tweet += `💰 FREE!\n`;
    } else {
      tweet += `💰 Ticketed\n`;
    }

    const remainingSpace =
      maxLength - tweet.length - eventUrl.length - hashtags.length - 5;

    if (event.description && remainingSpace > 50) {
      let truncatedDesc = event.description.substring(0, remainingSpace);
      const lastSpace = truncatedDesc.lastIndexOf(' ');
      if (lastSpace > 0) {
        truncatedDesc = truncatedDesc.substring(0, lastSpace) + '...';
      }
      tweet += `\n${truncatedDesc}`;
    }

    tweet += eventUrl + hashtags;

    return tweet.substring(0, maxLength);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Optional: Post approved events to X (uncomment if needed)
  // @Cron('0 */3 * * *', { // Every 3 hours
  //   timeZone: 'Africa/Lagos',
  // })
  // async postApprovedEvents() {
  //   this.logger.log('Posting approved events to X...');
  //   try {
  //     const events: any = await this.eventsService.getEventsToPost();
  //
  //     if (events.length === 0) {
  //       this.logger.log('No events to post');
  //       return;
  //     }
  //
  //     let postedCount = 0;
  //     const batchSize = 3; // Smaller batches to avoid rate limits
  //
  //     for (let i = 0; i < events.length; i += batchSize) {
  //       const batch = events.slice(i, i + batchSize);
  //
  //       for (const event of batch) {
  //         try {
  //           await this.postEventWithRetry(event);
  //           postedCount++;
  //
  //           // Add delay between posts
  //           await this.delay(10000); // 10 seconds between posts
  //         } catch (error) {
  //           this.logger.error(
  //             `Failed to post event ${event._id}:`,
  //             error instanceof Error ? error.message : error,
  //           );
  //         }
  //       }
  //
  //       // Delay between batches
  //       if (i + batchSize < events.length) {
  //         await this.delay(30000); // 30 seconds between batches
  //       }
  //     }
  //
  //     this.logger.log(`✅ Posted ${postedCount}/${events.length} events to X`);
  //   } catch (error: any) {
  //     this.logger.error('Failed to post events to X:', error.message);
  //   }
  // }

  private async postEventWithRetry(event: any, retries = 3): Promise<void> {
    try {
      const tweetText = this.formatEventTweet(event);
      const tweet = await this.readWriteClient.v2.tweet(tweetText);

      await this.eventsService.markAsPostedToX(event._id as string);

      this.logger.log(
        `✅ Posted event: ${event.title} (Tweet ID: ${tweet.data.id})`,
      );
    } catch (error: any) {
      if (
        (error.code === 429 || error.rateLimit?.remaining === 0) &&
        retries > 0
      ) {
        const waitTime = error.rateLimit?.reset
          ? error.rateLimit.reset * 1000 - Date.now() + 2000
          : 60000;

        this.logger.warn(
          `⚠️ Rate limit hit. Retrying after ${Math.round(
            waitTime / 1000,
          )}s... (${retries} retries left)`,
        );

        await this.delay(waitTime);
        return this.postEventWithRetry(event, retries - 1);
      }

      throw error;
    }
  }
}
