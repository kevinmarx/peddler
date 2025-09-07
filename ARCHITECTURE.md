# Peddler - Architecture Overview

## System Architecture

Peddler is a cloud-based marketplace monitoring system built on AWS serverless architecture using Terraform for Infrastructure as Code.

### Core Components

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

### Technology Stack

#### Infrastructure
- **Terraform**: Infrastructure as Code for AWS resource management
- **AWS Lambda**: Serverless compute for all processing functions
- **DynamoDB**: NoSQL database for listing storage with TTL
- **EventBridge**: Scheduled triggering of scraping operations
- **CloudWatch**: Logging and monitoring
- **S3**: Terraform state storage (remote backend)

#### Application Layer
- **Node.js 18**: Runtime environment
- **TypeScript**: Type-safe application development
- **Playwright**: Headless browser automation for scraping
- **Jest**: Testing framework

#### Security & Configuration
- **AWS Secrets Manager**: Secure storage of API keys and credentials
- **SSM Parameter Store**: Configuration management
- **IAM**: Fine-grained access control
- **OIDC**: GitHub Actions authentication (no long-lived keys)

#### Deployment & CI/CD
- **GitHub Actions**: Automated testing and deployment
- **OIDC Authentication**: Secure AWS access from GitHub
- **Multi-environment**: Support for dev/staging/production

## Lambda Functions

### 1. Scheduler Function (`scheduler.ts`)
- **Trigger**: EventBridge cron rule (every 10 minutes)
- **Purpose**: Orchestrates scraping operations
- **Logic**:
  - Loads scraper configurations from SSM
  - Invokes individual scraper functions asynchronously
  - Handles scraper enable/disable logic
  - Error isolation between scrapers

### 2. Scraper Function (`scraper.ts`)
- **Trigger**: Async invocation from scheduler
- **Purpose**: Executes individual marketplace scraping
- **Logic**:
  - Initializes headless browser with Playwright
  - Authenticates with marketplace using stored cookies
  - Searches for listings based on configuration
  - Processes and filters results
  - Stores new/updated listings in DynamoDB
  - Triggers notifications for relevant changes

### 3. Notifier Function (`notifier.ts`)
- **Trigger**: Async invocation from scraper
- **Purpose**: Sends multi-channel notifications
- **Logic**:
  - Receives listing data and notification type
  - Formats messages for each notification channel
  - Sends notifications via configured services
  - Handles failures gracefully

## Data Storage

### DynamoDB Table: `peddler-{environment}-listings`
- **Partition Key**: `scraperId` (string)
- **Sort Key**: `listingId` (string)
- **TTL Field**: `expiresAt` (number, Unix timestamp)
- **Billing Mode**: On-demand (pay-per-request)

#### Indexes
- **GSI**: `listingId-index` for deduplication across scrapers
- **Purpose**: Enables efficient lookups by listing ID

#### Sample Record
```json
{
  "scraperId": "honda-civic-search",
  "listingId": "marketplace-123456",
  "title": "2018 Honda Civic Manual",
  "price": 15000,
  "location": "Seattle, WA",
  "url": "https://facebook.com/marketplace/item/123456",
  "imageUrl": "https://...",
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": 1706097000,
  "priceHistory": [
    {"price": 16000, "timestamp": "2024-01-14T08:00:00Z"},
    {"price": 15000, "timestamp": "2024-01-15T10:30:00Z"}
  ]
}
```

## Configuration Management

### SSM Parameter: `/peddler/{environment}/config`
Contains scraper configurations and global settings:

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
        "slack": {"enabled": true},
        "telegram": {"enabled": false}
      }
    }
  ],
  "global": {
    "maxConcurrentScrapers": 10,
    "retryAttempts": 3,
    "retryDelayMs": 5000
  }
}
```

### Secrets Manager: `peddler/{environment}/secrets`
Secure storage for API keys and credentials:

```json
{
  "facebook-cookies": "session_cookies_here",
  "slack-webhook-url": "https://hooks.slack.com/services/...",
  "telegram-bot-token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "telegram-chat-id": "-123456789",
  "pushover-user-key": "uQiRzpo4DXghDmr9QzzfQu27cmVRsG",
  "pushover-app-token": "azGDORePK8gMaC0QOYAMyEEuzJnyUi"
}
```

## Notification Channels

### Slack
- **Format**: Rich message blocks with images and buttons
- **Features**: Inline price history, direct marketplace links
- **Configuration**: Webhook URL in secrets

### Telegram
- **Format**: HTML-formatted messages
- **Features**: Inline images, clickable links
- **Configuration**: Bot token and chat ID in secrets

### Pushover
- **Format**: Mobile push notifications
- **Features**: Priority levels, custom sounds
- **Configuration**: User key and app token in secrets

## Security Architecture

### Secrets Management
- **No hard-coded credentials** in source code
- **Secrets Manager** for sensitive data (API keys, tokens)
- **SSM Parameter Store** for configuration data
- **IAM roles** with least-privilege policies

### Lambda Security
- **Execution role** with minimal required permissions:
  - DynamoDB: Read/Write to listings table
  - SSM: Read parameters
  - Secrets Manager: Read secrets
  - CloudWatch: Write logs
  - Lambda: Invoke other functions

### GitHub Actions Security
- **OIDC authentication** (no long-lived AWS keys)
- **Repository-specific** IAM role conditions
- **Short-lived tokens** (1-hour expiry)
- **Branch-based** deployment restrictions

## Deployment Architecture

### Terraform Infrastructure
- **Remote state** storage in S3 with versioning
- **State locking** via DynamoDB (optional)
- **Environment isolation** through variable files
- **Resource tagging** for cost tracking

### GitHub Actions Workflows

#### Deploy (`deploy.yml`)
```yaml
Trigger: Push to main branch
Steps:
  1. Checkout code
  2. Configure OIDC credentials
  3. Setup Node.js and dependencies
  4. Build TypeScript → JavaScript
  5. Package Lambda functions → ZIP files
  6. Initialize Terraform backend
  7. Plan infrastructure changes
  8. Apply changes to AWS
```

#### PR Validation (`pr-validation.yml`)
```yaml
Trigger: Pull requests to main
Steps:
  1. ESLint code quality checks
  2. TypeScript compilation
  3. Jest unit tests
  4. Terraform validation
  5. Terraform plan (dry-run)
```

#### Cleanup (`cleanup.yml`)
```yaml
Trigger: Manual dispatch only
Steps:
  1. Manual approval gate
  2. Terraform destroy
  3. Confirmation of resource removal
```

## Monitoring & Observability

### CloudWatch Logs
- **Log Groups**: `/aws/lambda/peddler-{environment}-{function}`
- **Retention**: 14 days (configurable)
- **Structured logging** with correlation IDs

### Metrics & Alarms
- **Lambda metrics**: Duration, errors, invocations
- **DynamoDB metrics**: Read/write capacity, throttles
- **Custom metrics**: Scraper success rates, listing counts

### Error Handling
- **Function-level** try-catch blocks
- **Scraper isolation**: Individual failures don't affect others
- **Retry logic**: Exponential backoff for transient failures
- **Dead letter queues**: For persistent failures

## Cost Optimization

### Lambda
- **Memory allocation**: 1024MB (adjustable per function)
- **Timeout**: 15 minutes maximum
- **Cold start optimization**: Keep functions warm for frequent invocations

### DynamoDB
- **On-demand pricing**: Pay only for actual usage
- **TTL**: Automatic cleanup of old listings
- **Efficient queries**: Use partition key for optimal performance

### Storage
- **S3 lifecycle**: Transition old Terraform states to cheaper storage
- **CloudWatch logs**: Appropriate retention periods
- **Lambda packages**: Minimal dependencies

## Extensibility

### Adding New Marketplaces
1. Create new scraper service in `src/services/scrapers/`
2. Implement `MarketplaceScraper` interface
3. Update scraper configuration schema
4. Add marketplace-specific types
5. Test with new scraper configuration

### Adding Notification Channels
1. Create new notifier service in `src/services/notifiers/`
2. Implement `Notifier` interface
3. Add configuration options
4. Update secrets schema
5. Test notification delivery

### Environment Management
- **Variable files**: `terraform.tfvars` per environment
- **Workspace isolation**: Terraform workspaces for complete separation
- **Branch-based deployment**: Different branches → different environments

## Development Workflow

### Local Development
1. **Install dependencies**: `npm install`
2. **Build TypeScript**: `npm run build`
3. **Run tests**: `npm test`
4. **Local invocation**: Node.js directly or AWS SAM

### Testing Strategy
- **Unit tests**: Individual function logic
- **Integration tests**: AWS service interactions
- **End-to-end tests**: Full scraping workflow
- **Security tests**: Secrets handling, access controls

### Code Quality
- **ESLint**: Code style and quality enforcement
- **TypeScript**: Compile-time type checking
- **Prettier**: Code formatting consistency
- **Husky**: Pre-commit hooks for quality gates

## Migration Notes

### From Serverless Framework
This system was originally built with Serverless Framework and migrated to Terraform for:
- **Better state management**
- **Resource dependency handling**
- **Team collaboration features**
- **Multi-cloud extensibility**
- **More granular AWS resource control**

### Key Changes
- `serverless.yml` → `infrastructure/*.tf`
- `sls deploy` → `terraform apply`
- Environment variables → Terraform variables
- AWS provider managed by Terraform
- GitHub Actions updated for Terraform workflow

## Performance Characteristics

### Throughput
- **Concurrent scrapers**: Up to 10 (configurable)
- **Listings per scraper**: ~100-500 per run
- **Processing time**: 30-120 seconds per scraper
- **Total system throughput**: 1000+ listings per 10-minute cycle

### Latency
- **Cold start**: 2-5 seconds (Lambda initialization)
- **Warm execution**: 30-90 seconds (depending on scroll depth)
- **Notification delivery**: 1-3 seconds
- **Database operations**: <100ms per operation

### Scalability Limits
- **Lambda concurrency**: 1000 per region (AWS default)
- **DynamoDB**: Unlimited with on-demand billing
- **EventBridge**: 300 invocations per second per rule
- **Secrets Manager**: 5000 API calls per second per secret
