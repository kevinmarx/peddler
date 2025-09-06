# Peddler Setup Guide

This guide will walk you through setting up Peddler from scratch.

## Prerequisites

1. **Node.js 18+**
   ```bash
   node --version  # Should be 18.x or higher
   ```

2. **AWS CLI configured**
   ```bash
   aws configure
   # Enter your AWS Access Key, Secret Key, Region, and output format
   ```

3. **Serverless Framework**
   ```bash
   npm install -g serverless
   ```

## Step-by-Step Setup

### 1. Clone and Install
```bash
git clone https://github.com/yourusername/peddler.git
cd peddler
npm install
```

### 2. Deploy the Infrastructure
```bash
# For development environment
npm run deploy:dev

# For production environment
npm run deploy:prod
```

### 3. Configure Your Scrapers

After deployment, you'll need to configure your scrapers in AWS SSM Parameter Store:

```bash
# Replace 'dev' with 'prod' if deploying to production
aws ssm put-parameter \
  --name "/peddler/dev/config" \
  --value file://examples/config.json \
  --type String \
  --overwrite
```

### 4. Add Your Secrets

Configure your notification service credentials in AWS Secrets Manager:

```bash
# Replace 'dev' with 'prod' if deploying to production
aws secretsmanager update-secret \
  --secret-id "peddler/dev/secrets" \
  --secret-string file://examples/secrets.json
```

### 5. Get Facebook Cookies (Required)

To scrape Facebook Marketplace, you need to provide valid cookies:

1. Open Facebook Marketplace in your browser
2. Open Developer Tools (F12)
3. Go to the Application/Storage tab
4. Copy the values for `c_user`, `xs`, and `fr` cookies
5. Format them as: `c_user=VALUE; xs=VALUE; fr=VALUE`
6. Update the `facebook-cookies` value in your secrets

### 6. Test Your Setup

```bash
# Test the scheduler function
serverless invoke -f scheduler --stage dev

# Check the logs
serverless logs -f scheduler --stage dev

# Test a specific scraper
serverless invoke -f scraper --stage dev --data '{"body": "{\"scraperId\": \"honda-civic-manual\"}"}'
```

## Configuration Details

### Scraper Configuration

Edit the SSM parameter to customize your scrapers:

```json
{
  "scrapers": [
    {
      "id": "unique-scraper-id",
      "name": "Human Readable Name",
      "enabled": true,
      "marketplace": "facebook",
      "query": "search keywords",
      "location": "City, State",
      "radius": 25,
      "priceMin": 1000,
      "priceMax": 5000,
      "includeKeywords": ["must", "have", "words"],
      "excludeKeywords": ["exclude", "these", "words"],
      "scrollDepth": 3,
      "priceDropThreshold": 0.1,
      "notifications": {
        "slack": {
          "enabled": true,
          "webhook": "slack-webhook-url-from-secrets"
        }
      }
    }
  ]
}
```

### Notification Setup

#### Slack
1. Create a Slack app at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Create a webhook for your desired channel
4. Add the webhook URL to your secrets

#### Telegram
1. Create a bot by messaging @BotFather on Telegram
2. Get your bot token
3. Get your chat ID by messaging your bot and visiting: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Add both values to your secrets

#### Pushover
1. Create an account at https://pushover.net
2. Create an application to get an app token
3. Get your user key from your account settings
4. Add both values to your secrets

## Monitoring and Maintenance

### View Logs
```bash
serverless logs -f scheduler --stage dev --startTime 1h
```

### Check DynamoDB
Your listings are stored in DynamoDB. You can view them in the AWS Console or via CLI:
```bash
aws dynamodb scan --table-name peddler-listings-dev --max-items 10
```

### Update Configuration
To update scraper configuration:
```bash
aws ssm put-parameter \
  --name "/peddler/dev/config" \
  --value file://examples/config.json \
  --type String \
  --overwrite
```

### Cleanup
To remove all AWS resources:
```bash
npm run remove
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors**
   - Run `npm install` to ensure all dependencies are installed

2. **AWS credentials issues**
   - Ensure AWS CLI is configured: `aws configure list`
   - Check IAM permissions for Lambda, DynamoDB, etc.

3. **No listings found**
   - Verify Facebook cookies are current and valid
   - Check your search parameters aren't too restrictive
   - Review CloudWatch logs for parsing errors

4. **Notifications not working**
   - Verify webhook URLs and tokens in Secrets Manager
   - Test notification services independently
   - Check CloudWatch logs for error details

### Getting Help

- Check CloudWatch logs for detailed error information
- Review the main README.md for architecture details
- Create an issue on GitHub if you encounter bugs

## Cost Estimates

For moderate usage (5-10 scrapers running every 10 minutes):
- Lambda: ~$0.50/month
- DynamoDB: ~$1-2/month
- Secrets Manager: ~$0.40/month
- Other services: <$0.10/month

Total estimated cost: **$2-3/month**
