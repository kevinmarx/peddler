import { ScraperConfig, Listing, ScrapingResult, NotificationPayload } from '../types';
import { DatabaseService } from './database';
import { NotificationService } from './notification';
import { FacebookMarketplaceScraper } from './scrapers/facebook';
import { ConfigService } from './config';

export class ScraperService {
  private dbService: DatabaseService;
  private configService: ConfigService;

  constructor() {
    this.dbService = new DatabaseService();
    this.configService = new ConfigService();
  }

  async executeScraper(scraperId: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let scraper: FacebookMarketplaceScraper | null = null;

    try {
      // Get configuration
      const config = await this.configService.getConfig();
      const scraperConfig = config.scrapers.find(s => s.id === scraperId);

      if (!scraperConfig) {
        throw new Error(`Scraper configuration not found for ID: ${scraperId}`);
      }

      if (!scraperConfig.enabled) {
        console.log(`Scraper ${scraperId} is disabled, skipping`);
        return {
          scraperId,
          success: true,
          newListings: [],
          priceDrops: [],
          totalFound: 0,
          executionTime: Date.now() - startTime,
        };
      }

      console.log(`Starting scraper: ${scraperId} (${scraperConfig.name})`);

      // Initialize scraper based on marketplace type
      if (scraperConfig.marketplace === 'facebook') {
        scraper = new FacebookMarketplaceScraper();
        await scraper.initialize();
      } else {
        throw new Error(`Unsupported marketplace: ${scraperConfig.marketplace}`);
      }

      // Get secrets for authentication
      const secrets = await this.configService.getSecrets();
      const cookies = secrets['facebook-cookies'];

      // Scrape listings
      const scrapedListings = await scraper.scrape(scraperConfig, cookies);
      console.log(`Scraped ${scrapedListings.length} listings for ${scraperId}`);

      // Process listings
      const { newListings, priceDrops } = await this.processListings(scrapedListings, scraperConfig);

      // Send notifications
      if (newListings.length > 0 || priceDrops.length > 0) {
        const notificationService = new NotificationService(secrets);
        await this.sendNotifications(newListings, priceDrops, scraperConfig, notificationService);
      }

      console.log(`Scraper ${scraperId} completed: ${newListings.length} new, ${priceDrops.length} price drops`);

      return {
        scraperId,
        success: true,
        newListings,
        priceDrops,
        totalFound: scrapedListings.length,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error(`Scraper ${scraperId} failed:`, error);
      return {
        scraperId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        newListings: [],
        priceDrops: [],
        totalFound: 0,
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (scraper) {
        await scraper.cleanup();
      }
    }
  }

  private async processListings(
    scrapedListings: Listing[],
    config: ScraperConfig
  ): Promise<{ newListings: Listing[]; priceDrops: Listing[] }> {
    const newListings: Listing[] = [];
    const priceDrops: Listing[] = [];

    for (const listing of scrapedListings) {
      try {
        // Check if listing already exists
        const existingListing = await this.dbService.getListing(listing.scraperId, listing.listingId);

        if (!existingListing) {
          // New listing
          await this.dbService.saveListing(listing);
          newListings.push(listing);
          console.log(`New listing: ${listing.title} - $${listing.price}`);
        } else {
          // Existing listing - check for price changes
          if (listing.price !== existingListing.price) {
            const priceDropPercentage = (existingListing.price - listing.price) / existingListing.price;

            // Update the listing with new price
            const updatedListing = await this.dbService.updateListingPrice(
              listing.scraperId,
              listing.listingId,
              listing.price,
              listing.lastSeen
            );

            if (updatedListing && priceDropPercentage >= config.priceDropThreshold) {
              // Significant price drop
              priceDrops.push(updatedListing);
              console.log(`Price drop: ${listing.title} - $${existingListing.price} → $${listing.price} (${(priceDropPercentage * 100).toFixed(1)}%)`);
            }
          } else {
            // Same price, just update lastSeen
            await this.dbService.updateListingPrice(
              listing.scraperId,
              listing.listingId,
              listing.price,
              listing.lastSeen
            );
          }
        }
      } catch (error) {
        console.error(`Error processing listing ${listing.listingId}:`, error);
        // Continue processing other listings
      }
    }

    return { newListings, priceDrops };
  }

  private async sendNotifications(
    newListings: Listing[],
    priceDrops: Listing[],
    config: ScraperConfig,
    notificationService: NotificationService
  ): Promise<void> {
    const notifications: Promise<void>[] = [];

    // Send notifications for new listings
    for (const listing of newListings) {
      const payload: NotificationPayload = {
        type: 'new_listing',
        listing,
        scraper: config,
      };
      notifications.push(notificationService.sendNotifications(payload));
    }

    // Send notifications for price drops
    for (const listing of priceDrops) {
      const priceDropPercentage = listing.previousPrice
        ? (listing.previousPrice - listing.price) / listing.previousPrice * 100
        : 0;

      const payload: NotificationPayload = {
        type: 'price_drop',
        listing,
        scraper: config,
        priceDropPercentage,
      };
      notifications.push(notificationService.sendNotifications(payload));
    }

    // Send all notifications in parallel
    await Promise.allSettled(notifications);
  }

  async getScraperStats(scraperId: string): Promise<{ totalListings: number; recentListings: Listing[] }> {
    try {
      const listings = await this.dbService.getListingsByScraperId(scraperId, 10);
      const totalListings = listings.length; // This would need a count query in a real implementation

      return {
        totalListings,
        recentListings: listings.slice(0, 5),
      };
    } catch (error) {
      console.error(`Error getting stats for scraper ${scraperId}:`, error);
      return {
        totalListings: 0,
        recentListings: [],
      };
    }
  }
}
