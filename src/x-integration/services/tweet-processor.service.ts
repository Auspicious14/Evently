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

  async parseTweetToEvent(tweet: any): Promise<CreateEventDto | null> {
    try {
      const text = tweet.text;
      const lowerText = text.toLowerCase();

      // Check if tweet is likely an event
      if (!isLikelyEvent(text)) {
        return null;
      }

      // Check if tweet is spam or inappropriate
      if (isSpamOrInappropriate(text)) {
        return null;
      }

      // Check if tweet is Nigeria-related
      if (!isNigeriaRelated(text)) {
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

      const category = await this.determineCategoryWithGemini(text);

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

      // Extract image URLs if available
      const imageUrls: string[] = [];
      if (tweet.attachments?.media_keys) {
        // If media keys are available, they would need to be resolved through Twitter API
        // For now, we'll extract image URLs from the tweet text itself
        const imageUrlMatches = text.match(
          /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif)/gi,
        );
        if (imageUrlMatches) {
          imageUrls.push(...imageUrlMatches);
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
    } catch (error) {
      this.logger.warn(`Failed to parse tweet ${tweet.id}:`, error);
      return null;
    }
  }

  formatEventForTweet(event: any): string {
    return formatEventTweet(event);
  }

  private async determineCategoryWithGemini(text: string): Promise<string> {
    if (!this.model) {
      return determineCategory(text);
    }

    try {
      const prompt = `
        Analyze the following tweet text and categorize it into one of these categories: 
        AI, Fintech, Startup, Coding, Hardware, Design, Marketing, Cybersecurity, Virtual, HealthTech, EdTech, AgriTech. 
        
        Return ONLY the category name. If it doesn't fit well into any specific category, return what you think it is.
        
        Tweet: "${text}"
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const category = response.text().trim();

      // Basic validation to ensure it returns a valid string
      const validCategories = [
        'AI',
        'Fintech',
        'Startup',
        'Coding',
        'Hardware',
        'Design',
        'Marketing',
        'Cybersecurity',
        'Virtual',
        'HealthTech',
        'EdTech',
        'AgriTech',
      ];

      // Remove any potential extra characters or whitespace
      const cleanedCategory = category.replace(/[^a-zA-Z]/g, '');

      if (
        validCategories.some(
          (c) => c.toLowerCase() === cleanedCategory.toLowerCase(),
        )
      ) {
        // Return the matching category with correct casing
        return (
          validCategories.find(
            (c) => c.toLowerCase() === cleanedCategory.toLowerCase(),
          ) || 'Startup'
        );
      }

      return 'Startup';
    } catch (error) {
      this.logger.error(
        'Gemini categorization failed, falling back to keyword matching',
        error,
      );
      return determineCategory(text);
    }
  }
}
