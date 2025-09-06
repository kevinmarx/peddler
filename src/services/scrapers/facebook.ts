import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { ScraperConfig, Listing } from '../types';

export class FacebookMarketplaceScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrape(config: ScraperConfig, cookies?: string): Promise<Listing[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    const listings: Listing[] = [];

    try {
      // Set cookies if provided
      if (cookies) {
        const cookieObjects = this.parseCookieString(cookies);
        await page.context().addCookies(cookieObjects);
      }

      // Build Facebook Marketplace URL
      const searchUrl = this.buildSearchUrl(config);
      console.log(`Scraping: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      // Wait for listings to load
      await page.waitForSelector('[data-testid="marketplace-feed"]', { timeout: 10000 });

      // Scroll to load more listings based on scrollDepth
      for (let i = 0; i < config.scrollDepth; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(2000); // Wait for content to load
      }

      // Extract listings
      const content = await page.content();
      const $ = cheerio.load(content);

      // Facebook Marketplace listing selectors (these may need updates as FB changes their DOM)
      const listingElements = $('[data-testid="marketplace-feed"] > div > div').toArray();

      for (const element of listingElements) {
        try {
          const $element = $(element);

          // Extract listing data
          const titleElement = $element.find('span[dir="auto"]').first();
          const priceElement = $element.find('span').filter((_, el) => {
            const text = $(el).text().trim();
            return text.match(/^\$[\d,]+$/) !== null;
          }).first();

          const linkElement = $element.find('a[href*="/marketplace/item/"]').first();
          const imageElement = $element.find('img').first();

          if (!titleElement.length || !priceElement.length || !linkElement.length) {
            continue;
          }

          const title = titleElement.text().trim();
          const priceText = priceElement.text().replace(/[$,]/g, '');
          const price = parseInt(priceText, 10);
          const href = linkElement.attr('href');
          const imageUrl = imageElement.attr('src');

          if (!href || isNaN(price)) {
            continue;
          }

          // Extract listing ID from URL
          const listingIdMatch = href.match(/\/marketplace\/item\/(\d+)/);
          if (!listingIdMatch) {
            continue;
          }

          const listingId = listingIdMatch[1];
          const url = href.startsWith('http') ? href : `https://www.facebook.com${href}`;

          // Apply filters
          if (!this.passesFilters(title, price, config)) {
            continue;
          }

          const listing: Listing = {
            scraperId: config.id,
            listingId,
            title,
            price,
            location: config.location, // FB doesn't easily expose individual listing locations
            url,
            imageUrl,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            expiresAt: 0, // Will be set by database service
          };

          listings.push(listing);
        } catch (error) {
          console.warn('Error parsing listing element:', error);
          continue;
        }
      }

      console.log(`Found ${listings.length} listings for scraper ${config.id}`);
      return listings;

    } catch (error) {
      console.error(`Error scraping Facebook Marketplace for ${config.id}:`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  private buildSearchUrl(config: ScraperConfig): string {
    const baseUrl = 'https://www.facebook.com/marketplace';
    const params = new URLSearchParams();

    // Add search query
    if (config.query) {
      params.append('query', config.query);
    }

    // Add price range
    if (config.priceMin !== undefined) {
      params.append('minPrice', config.priceMin.toString());
    }
    if (config.priceMax !== undefined) {
      params.append('maxPrice', config.priceMax.toString());
    }

    // Add radius (in miles for Facebook)
    if (config.radius) {
      params.append('radius', config.radius.toString());
    }

    // Add location (this might need adjustment based on FB's API)
    if (config.location) {
      params.append('location', config.location);
    }

    const queryString = params.toString();
    return queryString ? `${baseUrl}/search?${queryString}` : baseUrl;
  }

  private passesFilters(title: string, price: number, config: ScraperConfig): boolean {
    const titleLower = title.toLowerCase();

    // Check price bounds
    if (config.priceMin !== undefined && price < config.priceMin) {
      return false;
    }
    if (config.priceMax !== undefined && price > config.priceMax) {
      return false;
    }

    // Check inclusion keywords
    if (config.includeKeywords && config.includeKeywords.length > 0) {
      const hasIncludeKeyword = config.includeKeywords.some(keyword =>
        titleLower.includes(keyword.toLowerCase())
      );
      if (!hasIncludeKeyword) {
        return false;
      }
    }

    // Check exclusion keywords
    if (config.excludeKeywords && config.excludeKeywords.length > 0) {
      const hasExcludeKeyword = config.excludeKeywords.some(keyword =>
        titleLower.includes(keyword.toLowerCase())
      );
      if (hasExcludeKeyword) {
        return false;
      }
    }

    return true;
  }

  private parseCookieString(cookieString: string): Array<{ name: string; value: string; domain: string; path: string }> {
    return cookieString.split(';').map(cookie => {
      const [nameValue, ...rest] = cookie.trim().split('=');
      const [name, value] = nameValue.split('=');

      return {
        name: name.trim(),
        value: value ? value.trim() : '',
        domain: '.facebook.com',
        path: '/',
      };
    }).filter(cookie => cookie.name && cookie.value);
  }
}
