import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CreateEventDto } from '../../events/dto/create-event.dto';
import {
  isSpamOrInappropriate,
  isNigeriaRelated,
  isLikelyEvent,
  extractTitle,
  cleanDescription,
  extractDate,
  extractTime,
  extractLocation,
  determineCategory,
  checkIfFree,
  formatDate,
  formatEventTweet,
  isValidEventData,
} from '../x-integration.utils';

@Injectable()
export class TweetProcessorService {
  private readonly logger = new Logger(TweetProcessorService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
      });
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not found in environment variables. AI categorization will be disabled.',
      );
    }
  }

  async parseTweetToEvent(
    tweet: any,
    includes?: any,
  ): Promise<CreateEventDto | null> {
    try {
      const text = tweet.text;

      // Check if tweet is spam or inappropriate (fast check before AI)
      if (isSpamOrInappropriate(text)) {
        return null;
      }

      // Check if tweet is Nigeria-related (fast check before AI)
      if (!isNigeriaRelated(text)) {
        return null;
      }

      // Extract images
      const imageUrls: string[] = [];

      // 1. Try extracting from includes (Twitter API v2 expansions)
      if (tweet.attachments?.media_keys && includes?.media) {
        const mediaKeys = tweet.attachments.media_keys;
        for (const key of mediaKeys) {
          const media = includes.media.find((m: any) => m.media_key === key);
          if (media && (media.type === 'photo' || media.preview_image_url)) {
            imageUrls.push(media.url || media.preview_image_url);
          }
        }
      }

      // 2. Fallback to extracting from text if no API media found
      if (imageUrls.length === 0) {
        const imageUrlMatches = text.match(
          /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif)/gi,
        );
        if (imageUrlMatches) {
          imageUrls.push(...imageUrlMatches);
        }
      }

      // Use AI for parsing if available
      if (this.model) {
        return this.parseWithGemini(tweet, imageUrls);
      }

      // Fallback to regex-based parsing
      return this.parseWithRegex(tweet, imageUrls);
    } catch (error) {
      this.logger.warn(`Failed to parse tweet ${tweet.id}:`, error);
      return null;
    }
  }

  private async parseWithGemini(
    tweet: any,
    imageUrls: string[],
  ): Promise<CreateEventDto | null> {
    try {
      const prompt = `
        Analyze this tweet to determine if it is a PUBLIC event in Nigeria that people can attend.
        
        Tweet Text: "${tweet.text}"
        Tweet Posted At: "${tweet.created_at}"
        
        Rules:
        1. Ignore personal life updates, weddings, birthdays, or private parties unless they are clearly public ticketed events.
        2. Ignore news reports about past events.
        3. The event MUST be in Nigeria.
        4. Calculate the absolute date based on "Tweet Posted At". If it says "tomorrow", add 1 day. If "next week", add 7 days.
        5. Return NULL if it is not a valid public upcoming/ongoing event.

        Return a JSON object with this structure (no markdown formatting):
        {
          "isEvent": boolean,
          "title": string (clear, short title),
          "description": string (cleaned description),
          "date": string (ISO 8601 format),
          "location": string (City, State),
          "category": string (One of: AI, Fintech, Startup, Coding, Hardware, Design, Marketing, Cybersecurity, Virtual, HealthTech, EdTech, AgriTech),
          "isFree": boolean,
          "link": string (external link if found, else null)
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response
        .text()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(text);

      if (!parsed.isEvent) {
        return null;
      }

      // Extract URLs from tweet entities for fallback link
      const urls = tweet.entities?.urls || [];
      let actualEventLink = parsed.link;

      if (!actualEventLink) {
        for (const url of urls) {
          if (
            !url.expanded_url.includes('twitter.com') &&
            !url.expanded_url.includes('x.com')
          ) {
            actualEventLink = url.expanded_url;
            break;
          }
        }
      }

      const twitterUrl = `https://x.com/${
        tweet.author_id || 'unknown'
      }/status/${tweet.id}`;

      const eventData: CreateEventDto = {
        title: parsed.title,
        description: parsed.description,
        date: parsed.date,
        location: parsed.location,
        category: parsed.category,
        link: actualEventLink,
        isFree: parsed.isFree,
        sourceType: 'x',
        sourceTweetId: tweet.id,
        twitterUrl: twitterUrl,
        status: 'pending',
        postedToX: false,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      if (!isValidEventData(eventData)) {
        return null;
      }

      return eventData;
    } catch (error) {
      this.logger.error('Gemini parsing failed, falling back to regex', error);
      return this.parseWithRegex(tweet, imageUrls);
    }
  }

  private parseWithRegex(
    tweet: any,
    imageUrls: string[],
  ): CreateEventDto | null {
    const text = tweet.text;

    // Check if tweet is likely an event
    if (!isLikelyEvent(text)) {
      return null;
    }

    const date = extractDate(text, tweet.created_at);
    if (!date) return null;

    const time = extractTime(text);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      date.setHours(hours, minutes);
    }

    const location = extractLocation(text);
    if (!location || !isNigeriaRelated(location)) return null;

    const title = extractTitle(text);
    if (!title || title.length < 15) return null;

    const category = determineCategory(text);

    // Extract URLs from tweet
    const urls = tweet.entities?.urls || [];
    let actualEventLink: string | null = null;
    let twitterUrl: string = `https://x.com/${
      tweet.author_id || 'unknown'
    }/status/${tweet.id}`;

    // Find the first non-Twitter URL (actual event link)
    for (const url of urls) {
      if (
        !url.expanded_url.includes('twitter.com') &&
        !url.expanded_url.includes('x.com')
      ) {
        actualEventLink = url.expanded_url;
        break;
      }
    }

    const isFree = checkIfFree(text);

    const eventData: CreateEventDto = {
      title,
      description: cleanDescription(text),
      date: date.toISOString(),
      location,
      category: category || 'Startup',
      link: actualEventLink,
      isFree,
      sourceType: 'x',
      sourceTweetId: tweet.id,
      twitterUrl: twitterUrl,
      status: 'pending',
      postedToX: false,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };

    this.logger.log(
      `Parsed tweet ${tweet.id}: title="${title}", link="${actualEventLink}", twitterUrl="${twitterUrl}", imageUrls=${imageUrls.length}`,
    );

    // Validate the event data
    if (!isValidEventData(eventData)) {
      return null;
    }

    return eventData;
  }

  formatEventForTweet(event: any): string {
    return formatEventTweet(event);
  }

  // Helper method kept for backward compatibility if needed, but logic moved to parseWithGemini
  private async determineCategoryWithGemini(text: string): Promise<string> {
    // ... (implementation not needed as it's integrated into parseWithGemini)
    return 'Startup';
  }
}
