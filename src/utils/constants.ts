export const SUPPORTED_MARKETPLACES = ['facebook', 'craigslist', 'ebay'] as const;

export const DEFAULT_SCROLL_DEPTH = 3;
export const DEFAULT_PRICE_DROP_THRESHOLD = 0.1; // 10%
export const DEFAULT_MAX_CONCURRENT_SCRAPERS = 5;

export const CACHE_TTL_SECONDS = 300; // 5 minutes
export const LISTING_TTL_DAYS = 30;

export const NOTIFICATION_TIMEOUTS = {
  slack: 10000,
  telegram: 10000,
  pushover: 10000,
};

export const SCRAPER_TIMEOUTS = {
  facebook: 60000, // 1 minute per scraper
  craigslist: 45000,
  ebay: 45000,
};

export const RATE_LIMITS = {
  facebook: 2000, // 2 seconds between requests
  craigslist: 1000,
  ebay: 1000,
};

export const ERROR_MESSAGES = {
  SCRAPER_NOT_FOUND: 'Scraper configuration not found',
  SCRAPER_DISABLED: 'Scraper is disabled',
  INVALID_MARKETPLACE: 'Unsupported marketplace type',
  MISSING_SECRETS: 'Required secrets not configured',
  NETWORK_ERROR: 'Network request failed',
  PARSE_ERROR: 'Failed to parse listing data',
  NOTIFICATION_FAILED: 'Failed to send notification',
  DATABASE_ERROR: 'Database operation failed',
} as const;
