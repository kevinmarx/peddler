import { EventBridgeEvent, Context } from 'aws-lambda';
import { ConfigService } from '../services/config';
import { ScraperService } from '../services/scraper';
import { ScrapingResult } from '../types';

export interface SchedulerEvent {
  source: string;
  'detail-type': string;
}

export const handler = async (
  event: EventBridgeEvent<'Scheduled Event', SchedulerEvent>,
  context: Context
): Promise<void> => {
  console.log('Scheduler started:', JSON.stringify(event, null, 2));

  const configService = new ConfigService();
  const scraperService = new ScraperService();

  try {
    // Get enabled scrapers
    const enabledScrapers = await configService.getEnabledScrapers();
    console.log(`Found ${enabledScrapers.length} enabled scrapers`);

    if (enabledScrapers.length === 0) {
      console.log('No enabled scrapers found, exiting');
      return;
    }

    // Determine concurrency limit
    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SCRAPERS || '5', 10);
    console.log(`Running up to ${maxConcurrent} scrapers concurrently`);

    // Execute scrapers in batches
    const results: ScrapingResult[] = [];

    for (let i = 0; i < enabledScrapers.length; i += maxConcurrent) {
      const batch = enabledScrapers.slice(i, i + maxConcurrent);
      console.log(`Executing batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.map(s => s.id).join(', ')}`);

      const batchPromises = batch.map(scraper =>
        scraperService.executeScraper(scraper.id)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Scraper ${batch[index].id} failed:`, result.reason);
          results.push({
            scraperId: batch[index].id,
            success: false,
            error: result.reason?.message || 'Unknown error',
            newListings: [],
            priceDrops: [],
            totalFound: 0,
            executionTime: 0,
          });
        }
      });

      // Small delay between batches to be respectful to target sites
      if (i + maxConcurrent < enabledScrapers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Log summary
    const totalNew = results.reduce((sum, r) => sum + r.newListings.length, 0);
    const totalDrops = results.reduce((sum, r) => sum + r.priceDrops.length, 0);
    const totalFound = results.reduce((sum, r) => sum + r.totalFound, 0);
    const successCount = results.filter(r => r.success).length;
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

    console.log(`\n=== Scheduler Summary ===`);
    console.log(`Total scrapers: ${enabledScrapers.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${enabledScrapers.length - successCount}`);
    console.log(`Total listings found: ${totalFound}`);
    console.log(`New listings: ${totalNew}`);
    console.log(`Price drops: ${totalDrops}`);
    console.log(`Average execution time: ${avgExecutionTime.toFixed(0)}ms`);
    console.log(`========================\n`);

    // Log individual scraper results
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.scraperId}: ${result.newListings.length} new, ${result.priceDrops.length} drops (${result.executionTime}ms)`);
      } else {
        console.log(`❌ ${result.scraperId}: ${result.error} (${result.executionTime}ms)`);
      }
    });

  } catch (error) {
    console.error('Scheduler failed:', error);
    throw error;
  }
};
