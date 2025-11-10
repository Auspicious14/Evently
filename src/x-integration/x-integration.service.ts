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
    'abia',
    'adamawa',
    'akwa ibom',
    'anambra',
    'bauchi state',
    'bayelsa',
    'benue',
    'borno',
    'cross river',
    'delta',
    'ebonyi',
    'edo',
    'ekiti',
    'enugu state',
    'gombe',
    'imo',
    'jigawa',
    'kaduna state',
    'kano state',
    'katsina',
    'kebbi',
    'kogi',
    'kwara',
    'nasarawa',
    'niger',
    'ogun',
    'ondo',
    'osun',
    'oyo',
    'plateau',
    'sokoto state',
    'taraba',
    'yobe',
    'zamfara',
    'fct',
  ];

  private readonly spamKeywords = [
    'dm',
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
    'bet',
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
    'nft',
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
    'escorts',
    'call girl',
    'prostitute',
    'booty call',

    'loan',
    'quick loan',
    'bad credit',
    'no credit check',
    'guaranteed approval',
    'invest now',

    'buy followers',
    'increase likes',
    'viral',
    'hack account',
    'recover account',
    'password reset',
    'free trial',
    'subscription',
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
    /whatsapp\s*(\+?\d{1,3})?[\s-]*\d{3}[\s-]*\d{3}[\s-]*\d{4}/i, // Phone numbers
    /\$\$\$/,
    /💰💰💰/,
    /🔞/,
    /available\s+for\s+(facetime|meetup|hookups|calls|chats)/i,
    /join\s+my\s+(group|channel|telegram|whatsapp)/i,
    /click\s+here/i,
    /link\s+in\s+bio/i,
    /bio\s+link/i,
    /(earn|make|get|win)\s+\d{1,}[kK]?\s+(daily|weekly|monthly)/, // Earn X daily
    /free\s+(gift|sample|trial|access)/i,
    /call\s+now/i,
    /text\s+me/i,
    /urgent\s+response/i,
  ];

  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {
    this.twitterClient = new TwitterApi(
      this.configService.get<string>('TWITTER_BEARER_TOKEN') as string,
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
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    timeZone: 'Africa/Lagos',
  })
  async handleCron() {
    this.logger.log('Running X integration cron job for Nigerian events...');
    try {
      const cityGroups = [
        'Lagos OR Abuja OR "Port Harcourt"',
        'Kano OR Ibadan OR "Benin City"',
        'Kaduna OR Enugu OR Jos OR Ilorin',
        'Aba OR Onitsha OR Warri OR Calabar',
        'Abeokuta OR Akure OR Bauchi OR Maiduguri',
        'Zaria OR "Ile-Ife" OR Owerri OR Uyo',
        'Sokoto OR Ogbomosho OR Ikeja OR "Victoria Island"',
      ];

      const baseEventTerms =
        '(event OR conference OR workshop OR summit OR hackathon OR seminar OR webinar)';
      const baseFilters = '-is:retweet -is:reply lang:en';

      const searchQueries = cityGroups.map(
        (group) => `${baseEventTerms} (${group}) Nigeria`,
      );

      searchQueries.push(
        'Nigeria (tech event OR startup event OR developer meetup OR hackathon OR tech conference OR AI summit) ${baseFilters}',
        '(#LagosTech OR #AbujaTech OR #NaijaStartup OR #TechInNigeria OR #NigeriaStartup OR #NigerianTech OR #AfricaTech) (event OR conference OR meetup) ${baseFilters}',
        '(blockchain OR fintech OR AI OR machine learning OR cybersecurity) event Nigeria ${baseFilters}',
        'startup pitch OR investor meetup OR founder summit Nigeria ${baseFilters}',
        'Nigeria (networking event OR demo day OR pitch night OR tech webinar) ${baseFilters}',
        '(edtech OR healthtech OR agritech) event Nigeria ${baseFilters}',
      );

      let processedCount = 0;
      const maxResultsPerQuery = 100;
      const concurrentLimit = 3;

      const queryBatches = [];
      for (let i = 0; i < searchQueries.length; i += concurrentLimit) {
        queryBatches.push(searchQueries.slice(i, i + concurrentLimit));
      }

      for (const batch of queryBatches) {
        const batchPromises = batch.map((query) =>
          this.searchWithRetry(query, maxResultsPerQuery),
        );
        const results = await Promise.allSettled(batchPromises);

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            const tweets = result.value;
            for (const tweet of tweets) {
              try {
                if (this.isSpamOrInappropriate(tweet.text)) continue;
                if (!this.isNigeriaRelated(tweet.text)) continue;
                if (!this.isLikelyEvent(tweet.text)) continue;

                const eventData = this.parseTweetToEvent(tweet);
                if (eventData && this.isValidEventData(eventData)) {
                  await this.eventsService.create(eventData);
                  processedCount++;
                  this.logger.log(
                    `Created event from tweet: ${eventData.title} (ID: ${tweet.id})`,
                  );
                }
              } catch (error) {
                this.logger.warn(`Failed to process tweet ${tweet.id}:`, error);
              }
            }
          } else if (result.status === 'rejected') {
            this.logger.error(`Failed batch query:`, result.reason);
          }
        }

        await this.delay(3000);
      }

      this.logger.log(
        `Processed ${processedCount} Nigerian tweets into events`,
      );
    } catch (error: any) {
      this.logger.error('Failed to fetch or process tweets:', error.message);
    }
  }

  private async searchWithRetry(
    query: string,
    maxResults: number,
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
        // start_time: new Date(
        //   Date.now() - 7 * 24 * 60 * 60 * 1000,
        // ).toISOString(),
      });

      return response.data?.data || [];
    } catch (error: any) {
      if ((error.code === 429 || error.rateLimit) && retries > 0) {
        this.logger.warn(
          `Rate limit hit for query "${query}", retrying after 60s...`,
        );
        await this.delay(60000);
        return this.searchWithRetry(query, maxResults, retries - 1);
      }
      throw error;
    }
  }

  // @Cron(CronExpression.EVERY_HOUR)
  // async postApprovedEvents() {
  //   this.logger.log('Posting approved events to X...');
  //   try {
  //     const events: any = await this.eventsService.getEventsToPost();
  //     let postedCount = 0;

  //     const batchSize = 5;
  //     for (let i = 0; i < events.length; i += batchSize) {
  //       const batch = events.slice(i, i + batchSize);
  //       const batchPromises = batch.map((event) =>
  //         this.postEventWithRetry(event),
  //       );
  //       const results = await Promise.allSettled(batchPromises);

  //       for (const result of results) {
  //         if (result.status === 'fulfilled') {
  //           postedCount++;
  //         } else {
  //           this.logger.error(`Failed to post event:`, result.reason);
  //         }
  //       }

  //       await this.delay(5000);
  //     }

  //     this.logger.log(`Posted ${postedCount} events to X`);
  //   } catch (error: any) {
  //     this.logger.error('Failed to post events to X:', error.message);
  //   }
  // }

  private async postEventWithRetry(event: any, retries = 1): Promise<void> {
    try {
      const tweetText = this.formatEventTweet(event);
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
        await this.delay(60000);
        return this.postEventWithRetry(event, retries - 1);
      }
      throw error;
    }
  }

  private isSpamOrInappropriate(text: string): boolean {
    const lowerText = text.toLowerCase();

    if (this.spamKeywords.some((keyword) => lowerText.includes(keyword))) {
      return true;
    }

    if (this.suspiciousPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    const linkCount = (text.match(/https?:\/\/\S+/g) || []).length;
    if (
      linkCount > 2 ||
      text === text.toUpperCase() ||
      (text.match(/[!?.]{3,}/g) || []).length > 2
    ) {
      return true;
    }

    return false;
  }

  private isNigeriaRelated(text: string): boolean {
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('nigeria') ||
      lowerText.includes('nigerian') ||
      lowerText.includes('naija')
    ) {
      return true;
    }
    return this.nigeriaLocations.some((location) =>
      lowerText.includes(location),
    );
  }

  private formatEventTweet(event: any): string {
    const maxLength = 280;
    const eventUrl = event.link ? `\n🔗 ${event.link}` : '';
    const hashtags = '#NigeriaEvents #TechNigeria';

    let tweet = `🎉 Upcoming: ${event.title}\n`;
    tweet += `📅 ${this.formatDate(event.date)}\n`;
    tweet += `📍 ${event.location}\n`;

    if (event.isFree) {
      tweet += `💰 FREE!\n`;
    } else {
      tweet += `💰 Ticketed\n`;
    }

    const remainingSpace =
      maxLength - tweet.length - eventUrl.length - hashtags.length - 10;
    if (event.description && remainingSpace > 50) {
      let truncatedDesc = event.description.substring(0, remainingSpace);
      truncatedDesc =
        truncatedDesc.substring(0, truncatedDesc.lastIndexOf(' ')) + '...';
      tweet += `\n${truncatedDesc}\n`;
    }

    tweet += eventUrl + `\n${hashtags}`;

    return tweet.substring(0, maxLength);
  }

  private parseTweetToEvent(tweet: any): CreateEventDto | null {
    try {
      const text = tweet.text;
      const lowerText = text.toLowerCase();

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

  private isLikelyEvent(text: string): boolean {
    const lowerText = text.toLowerCase();

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
      'google',
    ];

    const hasStrongKeyword = strongKeywords.some((keyword) =>
      lowerText.includes(keyword),
    );

    const hasDateIndicator =
      /\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
        text,
      ) ||
      /\b(next|this|upcoming)\s+(week|month|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b/i.test(
        lowerText,
      );

    const hasTimeIndicator = /\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/i.test(text);

    return hasStrongKeyword && hasDateIndicator;
  }

  private isBadTitle(title: string): boolean {
    const badPatterns = [
      /^(dm|call|text|whatsapp|join|click|link)/i,
      /available for/i,
      /^@\w+/,
      /^\d+$/,
      /^(rt|retweet|repost)/i,
      /^http/,
      /emoji\s*only/i,
    ];

    const emojiCount = (title.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 2) return true;

    return badPatterns.some((pattern) => pattern.test(title));
  }

  private extractTitle(text: string): string {
    // Improved: remove URLs, mentions, hashtags, emojis
    const emojiRegex = /[\u{1F000}-\u{1FFFF}]/gu;
    let cleanText = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .replace(/#\w+/g, '')
      .replace(emojiRegex, '')
      .trim();

    const lines = cleanText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Prioritize lines with event keywords and proper capitalization
    const eventKeywords = [
      'event',
      'meetup',
      'conference',
      'workshop',
      'summit',
      'hackathon',
    ];
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

    for (const line of lines) {
      if (line.length > 15 && !this.isBadTitle(line)) {
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
    const emojiRegex = /[\u{1F000}-\u{1FFFF}]/gu;
    let cleaned = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .replace(emojiRegex, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  }

  private extractDate(text: string, fallbackDate: string): Date | null {
    const patterns = [
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
      /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
      /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    ];

    const monthMap: { [key: string]: number } = {
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

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let parsedDate: Date;
        const currentYear = new Date().getFullYear();

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
          if (match[3] && match[3].length === 2) {
            year = parseInt('20' + match[3], 10);
          } else {
            year = parseInt(match[3] || currentYear.toString(), 10);
          }

          if (pattern.source.includes('jan|feb')) {
            if (isNaN(parseInt(match[1]))) {
              month = monthMap[match[1].toLowerCase().slice(0, 3)];
              day = parseInt(match[2], 10);
            } else {
              day = parseInt(match[1], 10);
              month = monthMap[match[2].toLowerCase().slice(0, 3)];
            }
          } else {
            if (parseInt(match[1], 10) > 12) {
              day = parseInt(match[1], 10);
              month = parseInt(match[2], 10) - 1;
              year = parseInt(match[3] || currentYear.toString(), 10);
            } else {
              if (match[1].length === 4) {
                year = parseInt(match[1], 10);
                month = parseInt(match[2], 10) - 1;
                day = parseInt(match[3], 10);
              } else {
                month = parseInt(match[1], 10) - 1;
                day = parseInt(match[2], 10);
                year = parseInt(match[3] || currentYear.toString(), 10);
              }
            }
          }

          parsedDate = new Date(year, month, day);
        }

        if (
          !isNaN(parsedDate.getTime()) &&
          parsedDate > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ) {
          // Allow recent but focus on future
          return parsedDate;
        }
      }
    }

    const fallback = new Date(
      new Date(fallbackDate).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    return fallback;
  }

  private extractTime(text: string): string | null {
    const timePatterns = [
      /\b(\d{1,2}):(\d{2})\s?(am|pm|a\.m\.|p\.m\.)/i,
      /\b(\d{1,2})\s?(am|pm|a\.m\.|p\.m\.)/i,
      /\b(\d{1,2}):(\d{2})\b/,
    ];

    for (const pattern of timePatterns) {
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

    const locationPatterns = [
      /(?:at|in|venue:|location:|held at|join us at)\s+([A-Z][a-zA-Z\s,]+(?:Nigeria)?)/i,
      /📍\s*([A-Z][a-zA-Z\s,]+(?:Nigeria)?)/,
      /\b(in|at)\s+([A-Z][a-zA-Z\s,]+)\b/i,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim().replace(/,$/, '');
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
    ];
    const lowerText = text.toLowerCase();

    if (paidKeywords.some((keyword) => lowerText.includes(keyword)))
      return false;
    return freeKeywords.some((keyword) => lowerText.includes(keyword));
  }

  private isValidEventData(eventData: CreateEventDto): boolean {
    if (!eventData.title || eventData.title.length < 15) return false;
    if (!eventData.description || eventData.description.length < 50)
      return false;
    if (!eventData.location) return false;
    if (new Date(eventData.date) < new Date(Date.now() - 24 * 60 * 60 * 1000))
      return false;
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
