import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Listing } from '../types';

export class DatabaseService {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.LISTINGS_TABLE || '';
  }

  async getListing(scraperId: string, listingId: string): Promise<Listing | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          scraperId,
          listingId,
        },
      });

      const response = await this.docClient.send(command);
      return response.Item as Listing || null;
    } catch (error) {
      console.error(`Failed to get listing ${listingId} for scraper ${scraperId}:`, error);
      throw error;
    }
  }

  async saveListing(listing: Listing): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...listing,
          expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days TTL
        },
      });

      await this.docClient.send(command);
    } catch (error) {
      console.error(`Failed to save listing ${listing.listingId}:`, error);
      throw error;
    }
  }

  async updateListingPrice(
    scraperId: string,
    listingId: string,
    newPrice: number,
    lastSeen: string
  ): Promise<Listing | null> {
    try {
      // First get the current listing to preserve the previous price
      const currentListing = await this.getListing(scraperId, listingId);
      if (!currentListing) {
        return null;
      }

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          scraperId,
          listingId,
        },
        UpdateExpression: 'SET price = :newPrice, previousPrice = :prevPrice, lastSeen = :lastSeen, expiresAt = :expiresAt',
        ExpressionAttributeValues: {
          ':newPrice': newPrice,
          ':prevPrice': currentListing.price,
          ':lastSeen': lastSeen,
          ':expiresAt': Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // Reset TTL
        },
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.docClient.send(command);
      return response.Attributes as Listing;
    } catch (error) {
      console.error(`Failed to update listing price for ${listingId}:`, error);
      throw error;
    }
  }

  async getListingsByScraperId(scraperId: string, limit = 100): Promise<Listing[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'scraperId = :scraperId',
        ExpressionAttributeValues: {
          ':scraperId': scraperId,
        },
        Limit: limit,
      });

      const response = await this.docClient.send(command);
      return response.Items as Listing[] || [];
    } catch (error) {
      console.error(`Failed to get listings for scraper ${scraperId}:`, error);
      throw error;
    }
  }

  async cleanupOldListings(scraperId: string, daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      const cutoffIso = cutoffDate.toISOString();

      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'scraperId = :scraperId',
        FilterExpression: 'lastSeen < :cutoff',
        ExpressionAttributeValues: {
          ':scraperId': scraperId,
          ':cutoff': cutoffIso,
        },
      });

      const response = await this.docClient.send(command);
      const itemsToDelete = response.Items || [];

      // In a production environment, you might want to batch delete these items
      // For now, we'll just return the count
      return itemsToDelete.length;
    } catch (error) {
      console.error(`Failed to cleanup old listings for scraper ${scraperId}:`, error);
      throw error;
    }
  }
}
