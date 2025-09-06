export interface ScraperConfig {
  id: string;
  name: string;
  enabled: boolean;
  marketplace: 'facebook' | 'craigslist' | 'ebay';
  query: string;
  location: string;
  radius: number;
  priceMin?: number;
  priceMax?: number;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  scrollDepth: number;
  priceDropThreshold: number; // Percentage (0.1 = 10%)
  notifications: NotificationConfig;
}

export interface NotificationConfig {
  slack?: {
    enabled: boolean;
    webhook: string;
  };
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  pushover?: {
    enabled: boolean;
    userKey: string;
    appToken: string;
  };
}

export interface Listing {
  scraperId: string;
  listingId: string;
  title: string;
  price: number;
  previousPrice?: number;
  location: string;
  url: string;
  imageUrl?: string;
  firstSeen: string; // ISO string
  lastSeen: string; // ISO string
  expiresAt: number; // Unix timestamp for TTL
}

export interface ScrapingResult {
  scraperId: string;
  success: boolean;
  error?: string;
  newListings: Listing[];
  priceDrops: Listing[];
  totalFound: number;
  executionTime: number;
}

export interface NotificationPayload {
  type: 'new_listing' | 'price_drop';
  listing: Listing;
  scraper: ScraperConfig;
  priceDropPercentage?: number;
}

export interface SecretsConfig {
  'facebook-cookies': string;
  'slack-webhook-url': string;
  'telegram-bot-token': string;
  'telegram-chat-id': string;
  'pushover-user-key': string;
  'pushover-app-token': string;
}

export interface AppConfig {
  scrapers: ScraperConfig[];
}
