# Peddler 🏪

A cloud-based alerting system that monitors Facebook Marketplace (and potentially other marketplaces) for new listings and price drops. Built on AWS serverless architecture for scalability and cost-effectiveness.

## Overview

Peddler automatically runs on a schedule to monitor multiple marketplace searches simultaneously. Each scraper can have its own search criteria, filters, and notification preferences. The system detects new listings, tracks price changes, and sends alerts through various channels including Slack, Telegram, and Pushover.

## Features

### 🔍 Multi-Scraper Management
- Configure multiple scrapers with unique search criteria
- Support for different marketplaces (initially Facebook Marketplace)
- Individual notification preferences per scraper
- Easy enable/disable functionality

### 📊 Smart Listing Processing
- Automatic deduplication of listings
- Price drop detection with configurable thresholds
- Historical price tracking
- Location-based filtering

### 🔔 Flexible Notifications
- **Slack**: Rich message formatting with images and links
- **Telegram**: HTML-formatted messages with inline links
- **Pushover**: Mobile push notifications
- Configurable per scraper and notification type

### ☁️ Serverless Architecture
- AWS Lambda functions for processing
- DynamoDB for data storage
- EventBridge for scheduling
- Secrets Manager for secure credential storage
- SSM Parameter Store for configuration management

### 🛡️ Security & Reliability
- No hard-coded secrets
- Secure credential management
- Individual scraper failure isolation
- Comprehensive error handling and logging

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   EventBridge   │───▶│   Scheduler      │───▶│   Scrapers      │
│   (Cron Rule)   │    │   Lambda         │    │   (Facebook)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Notifications │◀───│    DynamoDB      │◀───│   Database      │
│   (Multi-channel)│    │   (Listings)     │    │   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌──────────────────┐
│  Secrets Manager │    │  SSM Parameters  │
│  (API Keys)      │    │  (Configuration) │
└─────────────────┘    └──────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Serverless Framework

### Installation

1. **Clone and setup:**
   ```bash
   git clone https://github.com/kevinmarx/peddler.git
   cd peddler
   npm install
   ```

2. **Deploy to AWS:**
   ```bash
   npm run deploy:dev
   ```

3. **Configure your first scraper:**
   - Go to AWS SSM Parameter Store
   - Find the parameter: `/peddler/dev/config`
   - Edit the JSON to add your search criteria

4. **Add notification secrets:**
   - Go to AWS Secrets Manager
   - Find the secret: `peddler/dev/secrets`
   - Add your notification service API keys

### Configuration

#### Scraper Configuration (SSM Parameter)
```json
{
  "scrapers": [
    {
      "id": "honda-civic-search",
      "name": "Honda Civic Manual Transmission",
      "enabled": true,
      "marketplace": "facebook",
      "query": "honda civic",
      "location": "Seattle, WA",
      "radius": 25,
      "priceMin": 5000,
      "priceMax": 15000,
      "includeKeywords": ["manual", "stick", "mt"],
      "excludeKeywords": ["accident", "salvage", "flood"],
      "scrollDepth": 3,
      "priceDropThreshold": 0.1,
      "notifications": {
        "slack": {
          "enabled": true,
          "webhook": "slack-webhook-url-from-secrets"
        },
        "telegram": {
          "enabled": false,
          "botToken": "telegram-bot-token-from-secrets",
          "chatId": "telegram-chat-id-from-secrets"
        }
      }
    }
  ]
}
```

#### Secrets Configuration (Secrets Manager)
```json
{
  "facebook-cookies": "your-facebook-cookies-here",
  "slack-webhook-url": "https://hooks.slack.com/services/...",
  "telegram-bot-token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "telegram-chat-id": "-123456789",
  "pushover-user-key": "uQiRzpo4DXghDmr9QzzfQu27cmVRsG",
  "pushover-app-token": "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
}
```

## Configuration Options

### Scraper Settings

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the scraper |
| `name` | string | Human-readable name |
| `enabled` | boolean | Whether scraper is active |
| `marketplace` | string | Target marketplace ("facebook") |
| `query` | string | Search keywords |
| `location` | string | Search location |
| `radius` | number | Search radius in miles |
| `priceMin` | number | Minimum price filter |
| `priceMax` | number | Maximum price filter |
| `includeKeywords` | string[] | Must contain these words |
| `excludeKeywords` | string[] | Must not contain these words |
| `scrollDepth` | number | Pages to scroll (1-5 recommended) |
| `priceDropThreshold` | number | Minimum price drop % to alert (0.1 = 10%) |

### Notification Channels

#### Slack
- Rich formatted messages with listing images
- Direct links to marketplace listings
- Color-coded alerts (green for new, red for price drops)

#### Telegram
- HTML formatted messages
- Inline listing previews
- Bot-based delivery

#### Pushover
- Mobile push notifications
- Customizable priority levels
- Direct listing links

## Usage

### Automated Execution
The system runs automatically every 10 minutes (configurable in `serverless.yml`). All enabled scrapers execute in parallel with configurable concurrency limits.

### Manual Execution
```bash
# Invoke scheduler manually
npm run invoke

# Test specific scraper
serverless invoke -f scraper -d '{"body": "{\"scraperId\": \"your-scraper-id\"}"}'

# View logs
npm run logs
```

### Monitoring
- Check CloudWatch logs for execution details
- Monitor DynamoDB for listing data
- Review notification delivery in respective channels

## Development

### Project Structure
```
src/
├── handlers/           # Lambda function handlers
│   ├── scheduler.ts    # Main scheduling logic
│   ├── scraper.ts      # Individual scraper execution
│   └── notifier.ts     # Notification dispatch
├── services/           # Business logic services
│   ├── config.ts       # Configuration management
│   ├── database.ts     # DynamoDB operations
│   ├── notification.ts # Multi-channel notifications
│   ├── scraper.ts      # Core scraping orchestration
│   └── scrapers/       # Marketplace-specific scrapers
│       └── facebook.ts # Facebook Marketplace scraper
├── types/              # TypeScript definitions
│   └── index.ts        # Shared types and interfaces
└── utils/              # Utility functions
    ├── constants.ts    # Application constants
    └── helpers.ts      # Helper functions
```

### Local Development
```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Run tests
npm test

# Build TypeScript
npm run build
```

### Adding New Marketplaces
1. Create new scraper in `src/services/scrapers/`
2. Implement the marketplace-specific logic
3. Add to supported marketplaces in constants
4. Update configuration schema

### Testing
```bash
# Run all tests
npm test

# Test with coverage
npm run test:coverage

# Test specific file
npm test -- --testNamePattern="ScraperService"
```

## Deployment

### Stages
- **dev**: Development environment
- **prod**: Production environment

### Deploy Commands
```bash
# Deploy to dev
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# Remove deployment
npm run remove
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `STAGE` | Deployment stage | `dev` |
| `LISTINGS_TABLE` | DynamoDB table name | Auto-generated |
| `CONFIG_PARAMETER` | SSM parameter path | Auto-generated |
| `SECRETS_NAME` | Secrets Manager secret name | Auto-generated |
| `MAX_CONCURRENT_SCRAPERS` | Parallel execution limit | `10` |

## Cost Optimization

### AWS Resource Usage
- **Lambda**: Pay per execution (typically <$1/month for moderate usage)
- **DynamoDB**: Pay per request (on-demand pricing)
- **EventBridge**: Minimal cost for scheduled events
- **Secrets Manager**: ~$0.40/month per secret
- **CloudWatch Logs**: Minimal for standard logging

### Optimization Tips
1. Adjust scraper frequency based on needs
2. Use appropriate `scrollDepth` values
3. Enable only necessary scrapers
4. Set reasonable TTL on DynamoDB items

## Troubleshooting

### Common Issues

#### Scraper Not Finding Listings
- Verify Facebook cookies are current
- Check search parameters (location, keywords)
- Review CloudWatch logs for parsing errors

#### Notifications Not Sending
- Verify webhook URLs and tokens in Secrets Manager
- Check notification service status
- Review error logs in CloudWatch

#### High Costs
- Reduce scraper frequency
- Lower `scrollDepth` values
- Disable unused scrapers

### Debugging
```bash
# View recent logs
serverless logs -f scheduler --startTime 5m

# Check specific scraper logs
serverless logs -f scraper --startTime 1h

# Monitor DynamoDB usage
aws dynamodb describe-table --table-name peddler-listings-dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Create an issue for bugs or feature requests
- Check [Wiki](wiki) for additional documentation
- Review logs in AWS CloudWatch for troubleshooting

---

**Note**: This system is for personal use. Be respectful of marketplace terms of service and implement appropriate rate limiting.
