import { SQSEvent, Context } from 'aws-lambda';
import { NotificationService } from '../services/notification';
import { ConfigService } from '../services/config';
import { NotificationPayload } from '../types';

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  console.log('Notifier handler invoked:', JSON.stringify(event, null, 2));

  const configService = new ConfigService();

  try {
    // Get secrets for notification services
    const secrets = await configService.getSecrets();
    const notificationService = new NotificationService(secrets);

    // Process each message
    const promises = event.Records.map(async (record) => {
      try {
        const payload: NotificationPayload = JSON.parse(record.body);
        console.log(`Processing notification for listing ${payload.listing.listingId}`);

        await notificationService.sendNotifications(payload);

        console.log(`Notification sent successfully for listing ${payload.listing.listingId}`);
      } catch (error) {
        console.error(`Failed to process notification:`, error);
        console.error(`Record body:`, record.body);
        // Don't throw - we want to continue processing other messages
      }
    });

    await Promise.allSettled(promises);
    console.log(`Processed ${event.Records.length} notification messages`);

  } catch (error) {
    console.error('Notifier handler error:', error);
    throw error;
  }
};
