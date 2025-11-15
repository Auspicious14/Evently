import { CreateEventDto } from '../events/dto/create-event.dto';
import * as fs from 'fs';
import * as path from 'path';

// Load data files
const nigeriaLocations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/nigeria-locations.json'), 'utf8')
);
const spamKeywords = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/spam-keywords.json'), 'utf8')
);
const suspiciousPatterns = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/suspicious-patterns.json'), 'utf8')
);

// Pre-compiled regex patterns
export const regexPatterns = {
  spamRegex: new RegExp(
    [
      ...spamKeywords.map((kw: string) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      ...suspiciousPatterns.map((p: string) => p)
    ].join('|'),
    'i'
  ),
  datePatterns: [
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
    /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  ],
  timePatterns: [
    /\b(\d{1,2}):(\d{2})\s?(am|pm|a\.m\.|p\.m\.)/i,
    /\b(\d{1,2})\s?(am|pm|a\.m\.|p\.m\.)/i,
    /\b(\d{1,2}):(\d{2})\b/,
  ],
  badTitlePatterns: [
    /^(dm|call|text|whatsapp|join|click|link)/i,
    /available for/i,
    /^@\w+/,
    /^\d+$/,
    /^(rt|retweet|repost)/i,
    /^http/,
    /emoji\s*only/i,
  ],
  emojiRegex: /[\u{1F000}-\u{1FFFF}]/gu,
  nigeriaLocationRegex: new RegExp(nigeriaLocations.join('|'), 'i'),
  strongKeywordRegex: /\b(event|conference|meetup|workshop|summit|hackathon|seminar|expo|festival|show|gathering|networking|panel|keynote|speaker|venue|location|date|time|registration|tickets?|free|paid|cost)\b/i,
  dateIndicatorRegex: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  nextDayRegex: /\b(tomorrow|today|next\s+(week|month|year))\b/i,
  timeIndicatorRegex: /\b(\d{1,2}:\d{2}\s?(am|pm|a\.m\.|p\.m\.)|\d{1,2}\s?(am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2})\b/i,
};

// Spam detection utilities
export function isSpamOrInappropriate(text: string): boolean {
  const lowerText = text.toLowerCase();
  return regexPatterns.spamRegex.test(lowerText);
}

// Location utilities
export function isNigeriaRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('nigeria') || lowerText.includes('nigerian') || lowerText.includes('naija')) {
    return true;
  }
  return regexPatterns.nigeriaLocationRegex.test(lowerText);
}

export function extractLocation(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const location of nigeriaLocations.sort(
    (a: string, b: string) => b.length - a.length
  )) {
    if (lowerText.includes(location)) {
      return location
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
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
      if (isNigeriaRelated(location)) {
        return location;
      }
    }
  }

  return null;
}

// Date and time utilities
export function extractDate(text: string, fallbackDate: string): Date | null {
  for (const pattern of regexPatterns.datePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Handle different date formats
      try {
        let date: Date;
        if (match[1] && match[2] && match[3]) {
          // MM/DD/YYYY or DD/MM/YYYY format
          const month = parseInt(match[1], 10);
          const day = parseInt(match[2], 10);
          let year = parseInt(match[3], 10);
          if (year < 100) year += 2000;
          date = new Date(year, month - 1, day);
        } else if (match[4] && match[5]) {
          // Month name format
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthIndex = monthNames.indexOf(match[4].toLowerCase().substring(0, 3));
          if (monthIndex !== -1) {
            const day = parseInt(match[5], 10);
            const year = match[6] ? parseInt(match[6], 10) : new Date().getFullYear();
            date = new Date(year, monthIndex, day);
          } else {
            continue;
          }
        } else if (match[7] && match[8]) {
          // Next/this weekday format
          const today = new Date();
          const targetDay = match[8].toLowerCase();
          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDayIndex = daysOfWeek.indexOf(targetDay);
          const currentDayIndex = today.getDay();
          let daysUntilTarget = targetDayIndex - currentDayIndex;
          if (daysUntilTarget <= 0) daysUntilTarget += 7;
          if (match[7].toLowerCase() === 'next') daysUntilTarget += 7;
          date = new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
        } else {
          continue;
        }
        
        if (date && date > new Date()) {
          return date;
        }
      } catch (error) {
        continue;
      }
    }
  }

  // Fallback to 7 days from now
  const fallback = new Date(
    new Date(fallbackDate).getTime() + 7 * 24 * 60 * 60 * 1000
  );
  return fallback;
}

export function extractTime(text: string): string | null {
  for (const pattern of regexPatterns.timePatterns) {
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

// Event detection utilities
export function isLikelyEvent(text: string): boolean {
  const lowerText = text.toLowerCase();

  const hasStrongKeyword = regexPatterns.strongKeywordRegex.test(lowerText);
  const hasDateIndicator = regexPatterns.dateIndicatorRegex.test(text) || regexPatterns.nextDayRegex.test(lowerText);
  const hasTimeIndicator = regexPatterns.timeIndicatorRegex.test(text);

  return hasStrongKeyword && hasDateIndicator;
}

// Title utilities
export function isBadTitle(title: string): boolean {
  const emojiCount = (title.match(regexPatterns.emojiRegex) || []).length;
  if (emojiCount > 2) return true;

  return regexPatterns.badTitlePatterns.some((pattern) => pattern.test(title));
}

export function extractTitle(text: string): string {
  let cleanText = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .replace(regexPatterns.emojiRegex, '')
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
      !isBadTitle(line) &&
      eventKeywords.some((kw) => line.toLowerCase().includes(kw))
    ) {
      return capitalizeTitle(line);
    }
  }

  for (const line of lines) {
    if (line.length > 15 && !isBadTitle(line)) {
      return capitalizeTitle(line);
    }
  }

  return '';
}

export function capitalizeTitle(title: string): string {
  return title
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Category utilities
export function determineCategory(text: string): string {
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

// Price utilities
export function checkIfFree(text: string): boolean {
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

// Text cleaning utilities
export function cleanDescription(text: string): string {
  let cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(regexPatterns.emojiRegex, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// Validation utilities
export function isValidEventData(eventData: CreateEventDto): boolean {
  if (!eventData.title || eventData.title.length < 15) return false;
  if (!eventData.description || eventData.description.length < 50)
    return false;
  if (!eventData.location) return false;
  if (new Date(eventData.date) < new Date(Date.now() - 24 * 60 * 60 * 1000))
    return false;
  return true;
}

// Date formatting utilities
export function formatDate(date: string | Date): string {
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

// Tweet formatting utilities
export function formatEventTweet(event: any): string {
  const maxLength = 280;
  const eventUrl = event.link ? `\n🔗 ${event.link}` : '';
  const hashtags = '#NigeriaEvents #TechNigeria';

  let tweet = `🎉 Upcoming: ${event.title}\n`;
  tweet += `📅 ${formatDate(event.date)}\n`;
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

// Async utilities
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}