import { Injectable, Logger } from '@nestjs/common';
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
      
      // Extract URLs from tweet
      const urls = tweet.entities?.urls || [];
      let actualEventLink: string | null = null;
      let twitterUrl: string = `https://x.com/${tweet.author_id || 'unknown'}/status/${tweet.id}`;
      
      // Find the first non-Twitter URL (actual event link)
      for (const url of urls) {
        if (!url.expanded_url.includes('twitter.com') && !url.expanded_url.includes('x.com')) {
          actualEventLink = url.expanded_url;
          break;
        }
      }
      
      // Extract image URLs if available
      const imageUrls: string[] = [];
      if (tweet.attachments?.media_keys) {
        // If media keys are available, they would need to be resolved through Twitter API
        // For now, we'll extract image URLs from the tweet text itself
        const imageUrlMatches = text.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif)/gi);
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
}
