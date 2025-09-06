import { ConfigService } from '../src/services/config';
import { DatabaseService } from '../src/services/database';
import { ScraperService } from '../src/services/scraper';
import { NotificationService } from '../src/services/notification';
import { Listing, ScraperConfig } from '../src/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm');
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Peddler Core Services', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.CONFIG_PARAMETER = '/test/config';
    process.env.SECRETS_NAME = 'test/secrets';
    process.env.LISTINGS_TABLE = 'test-listings';
    process.env.AWS_REGION = 'us-east-1';
  });

  describe('ConfigService', () => {
    it('should initialize without errors', () => {
      expect(() => new ConfigService()).not.toThrow();
    });
  });

  describe('DatabaseService', () => {
    it('should initialize without errors', () => {
      expect(() => new DatabaseService()).not.toThrow();
    });
  });

  describe('ScraperService', () => {
    it('should initialize without errors', () => {
      expect(() => new ScraperService()).not.toThrow();
    });
  });

  describe('NotificationService', () => {
    const mockSecrets = {
      'facebook-cookies': '',
      'slack-webhook-url': 'https://hooks.slack.com/test',
      'telegram-bot-token': 'test-token',
      'telegram-chat-id': 'test-chat',
      'pushover-user-key': 'test-key',
      'pushover-app-token': 'test-token',
    };

    it('should initialize without errors', () => {
      expect(() => new NotificationService(mockSecrets)).not.toThrow();
    });
  });

  describe('Type Definitions', () => {
    it('should have proper Listing interface structure', () => {
      const listing: Listing = {
        scraperId: 'test-scraper',
        listingId: 'test-listing',
        title: 'Test Item',
        price: 100,
        location: 'Test Location',
        url: 'https://example.com',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        expiresAt: 0,
      };

      expect(listing.scraperId).toBe('test-scraper');
      expect(listing.price).toBe(100);
      expect(typeof listing.firstSeen).toBe('string');
    });

    it('should have proper ScraperConfig interface structure', () => {
      const config: ScraperConfig = {
        id: 'test-scraper',
        name: 'Test Scraper',
        enabled: true,
        marketplace: 'facebook',
        query: 'test query',
        location: 'Test Location',
        radius: 25,
        scrollDepth: 3,
        priceDropThreshold: 0.1,
        notifications: {
          slack: {
            enabled: true,
            webhook: 'test-webhook',
          },
        },
      };

      expect(config.marketplace).toBe('facebook');
      expect(config.priceDropThreshold).toBe(0.1);
      expect(config.notifications.slack?.enabled).toBe(true);
    });
  });
});
