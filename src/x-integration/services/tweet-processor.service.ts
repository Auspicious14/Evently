import { Injectable, Logger } from '@nestjs/common';
import { CreateEventDto } from '../../events/dto/create-event.dto';
import {
  isSpamOrInappropriate,
  isNigeriaRelated,
  isLikelyEvent,
  extractDate,
  extractTime,
  extractLocation,
  extractTitle,
  determineCategory,
  checkIfFree,
  cleanDescription,
  isValidEventData,
  formatDate,
  formatEventTweet
} from '../x-integration.utils';

@Injectable()
export class TweetProcessorService {
  private readonly logger = new Logger(TweetProcessorService.name);

  parseTweetToEvent(tweet: any): CreateEventDto | null {
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

      const category = determineCategory(text);
      const link = tweet.entities?.urls?.[0]?.expanded_url || null;
      const isFree = checkIfFree(text);

      const eventData: CreateEventDto = {
        title,
        description: cleanDescription(text),
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
}