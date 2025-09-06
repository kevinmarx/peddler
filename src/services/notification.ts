import axios from 'axios';
import { NotificationPayload, SecretsConfig } from '../types';

export class NotificationService {
  private secrets: SecretsConfig;

  constructor(secrets: SecretsConfig) {
    this.secrets = secrets;
  }

  async sendNotifications(payload: NotificationPayload): Promise<void> {
    const { scraper } = payload;
    const promises: Promise<void>[] = [];

    if (scraper.notifications.slack?.enabled) {
      promises.push(this.sendSlackNotification(payload));
    }

    if (scraper.notifications.telegram?.enabled) {
      promises.push(this.sendTelegramNotification(payload));
    }

    if (scraper.notifications.pushover?.enabled) {
      promises.push(this.sendPushoverNotification(payload));
    }

    // Send all notifications in parallel, but don't let one failure stop others
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Notification ${index} failed:`, result.reason);
      }
    });
  }

  private async sendSlackNotification(payload: NotificationPayload): Promise<void> {
    try {
      const webhookUrl = this.getSecretValue(payload.scraper.notifications.slack!.webhook);

      const message = this.formatSlackMessage(payload);

      await axios.post(webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      console.log(`Slack notification sent for listing ${payload.listing.listingId}`);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  private async sendTelegramNotification(payload: NotificationPayload): Promise<void> {
    try {
      const botToken = this.getSecretValue(payload.scraper.notifications.telegram!.botToken);
      const chatId = this.getSecretValue(payload.scraper.notifications.telegram!.chatId);

      const message = this.formatTelegramMessage(payload);
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

      await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }, {
        timeout: 10000,
      });

      console.log(`Telegram notification sent for listing ${payload.listing.listingId}`);
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
      throw error;
    }
  }

  private async sendPushoverNotification(payload: NotificationPayload): Promise<void> {
    try {
      const userKey = this.getSecretValue(payload.scraper.notifications.pushover!.userKey);
      const appToken = this.getSecretValue(payload.scraper.notifications.pushover!.appToken);

      const message = this.formatPushoverMessage(payload);

      await axios.post('https://api.pushover.net/1/messages.json', {
        token: appToken,
        user: userKey,
        title: message.title,
        message: message.message,
        url: payload.listing.url,
        url_title: 'View Listing',
      }, {
        timeout: 10000,
      });

      console.log(`Pushover notification sent for listing ${payload.listing.listingId}`);
    } catch (error) {
      console.error('Failed to send Pushover notification:', error);
      throw error;
    }
  }

  private formatSlackMessage(payload: NotificationPayload): any {
    const { type, listing, scraper, priceDropPercentage } = payload;

    let color = '#36a64f'; // Green for new listings
    let title = '🆕 New Listing Found';
    let description = `Found a new listing matching your search criteria for "${scraper.name}".`;

    if (type === 'price_drop') {
      color = '#ff6b6b'; // Red for price drops
      title = '📉 Price Drop Alert';
      description = `Price dropped by ${priceDropPercentage?.toFixed(1)}% for a tracked listing.`;
    }

    return {
      attachments: [
        {
          color,
          title,
          title_link: listing.url,
          text: description,
          fields: [
            {
              title: 'Title',
              value: listing.title,
              short: false,
            },
            {
              title: 'Price',
              value: `$${listing.price.toLocaleString()}`,
              short: true,
            },
            {
              title: 'Location',
              value: listing.location,
              short: true,
            },
            ...(listing.previousPrice ? [{
              title: 'Previous Price',
              value: `$${listing.previousPrice.toLocaleString()}`,
              short: true,
            }] : []),
          ],
          image_url: listing.imageUrl,
          footer: `Peddler • ${scraper.name}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
  }

  private formatTelegramMessage(payload: NotificationPayload): string {
    const { type, listing, scraper, priceDropPercentage } = payload;

    let emoji = '🆕';
    let header = 'New Listing Found';

    if (type === 'price_drop') {
      emoji = '📉';
      header = `Price Drop Alert (-${priceDropPercentage?.toFixed(1)}%)`;
    }

    let message = `${emoji} <b>${header}</b>\n\n`;
    message += `<b>Title:</b> ${this.escapeHtml(listing.title)}\n`;
    message += `<b>Price:</b> $${listing.price.toLocaleString()}\n`;

    if (listing.previousPrice) {
      message += `<b>Previous Price:</b> $${listing.previousPrice.toLocaleString()}\n`;
    }

    message += `<b>Location:</b> ${listing.location}\n`;
    message += `<b>Scraper:</b> ${scraper.name}\n\n`;
    message += `<a href="${listing.url}">View Listing</a>`;

    return message;
  }

  private formatPushoverMessage(payload: NotificationPayload): { title: string; message: string } {
    const { type, listing, scraper, priceDropPercentage } = payload;

    let title = `New: ${listing.title}`;

    if (type === 'price_drop') {
      title = `Price Drop: ${listing.title}`;
    }

    let message = `$${listing.price.toLocaleString()}`;

    if (listing.previousPrice) {
      message += ` (was $${listing.previousPrice.toLocaleString()})`;
      if (priceDropPercentage) {
        message += ` - ${priceDropPercentage.toFixed(1)}% drop`;
      }
    }

    message += `\n📍 ${listing.location}`;
    message += `\n🔍 ${scraper.name}`;

    return { title, message };
  }

  private getSecretValue(key: string): string {
    // If the key contains '-from-secrets', look it up in secrets
    if (key.includes('-from-secrets')) {
      const secretKey = key.replace('-from-secrets', '') as keyof SecretsConfig;
      return this.secrets[secretKey] || '';
    }
    return key;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
