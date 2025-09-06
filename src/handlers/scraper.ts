import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ScraperService } from '../services/scraper';

export interface ScraperRequest {
  scraperId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Scraper handler invoked:', JSON.stringify(event, null, 2));

  const scraperService = new ScraperService();

  try {
    // Parse request
    let scraperId: string;

    if (event.body) {
      // Called via API Gateway
      const body: ScraperRequest = JSON.parse(event.body);
      scraperId = body.scraperId;
    } else if (event.pathParameters?.scraperId) {
      // Called via path parameter
      scraperId = event.pathParameters.scraperId;
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing scraperId parameter' }),
      };
    }

    console.log(`Executing scraper: ${scraperId}`);

    // Execute scraper
    const result = await scraperService.executeScraper(scraperId);

    // Return result
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Scraper handler error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
