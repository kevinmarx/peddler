# GitHub Actions Deployment Guide

This guide explains how to set up automated deployment of Peddler using GitHub Actions.

## Overview

The GitHub Actions workflows provide:
- **Automated deployment** to dev/prod environments
- **Pull request validation** with linting, testing, and security scans
- **Manual cleanup** of AWS resources
- **Slack notifications** for deployment status

## Workflow Files

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| Deploy | `deploy.yml` | Push to main/develop, manual | Deploy to AWS |
| PR Validation | `pr-validation.yml` | Pull requests | Code quality checks |
| Cleanup | `cleanup.yml` | Manual only | Remove AWS resources |

## Setup Instructions

### 1. Repository Secrets

Configure these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

#### Required for Development Deployment
```
AWS_ACCESS_KEY_ID          # AWS access key for dev environment
AWS_SECRET_ACCESS_KEY      # AWS secret key for dev environment
```

#### Required for Production Deployment
```
AWS_ACCESS_KEY_ID_PROD     # AWS access key for prod environment
AWS_SECRET_ACCESS_KEY_PROD # AWS secret key for prod environment
```

#### Optional Secrets
```
PEDDLER_SECRETS            # JSON string with dev notification credentials
PEDDLER_SECRETS_PROD       # JSON string with prod notification credentials
SLACK_WEBHOOK_URL          # For deployment notifications
CODECOV_TOKEN              # For code coverage reports
SNYK_TOKEN                 # For security vulnerability scanning
```

### 2. Repository Variables

Configure these variables for automatic configuration deployment:

#### Development Configuration
```
SCRAPERS_CONFIG            # JSON string with dev scraper configurations
```

#### Production Configuration
```
SCRAPERS_CONFIG_PROD       # JSON string with prod scraper configurations
```

### 3. Environment Protection Rules

Set up environment protection rules in `Settings > Environments`:

#### Development Environment
- No protection rules needed
- Deploys automatically on push to `develop` branch

#### Production Environment
- **Required reviewers**: Add team members who must approve prod deployments
- **Restrict branches**: Only allow `main` branch
- **Deployment protection rules**: Consider adding wait timers

## Secret Format Examples

### PEDDLER_SECRETS
```json
{
  "facebook-cookies": "c_user=123; xs=abc...; fr=xyz...",
  "slack-webhook-url": "https://hooks.slack.com/services/...",
  "telegram-bot-token": "123456789:ABC...",
  "telegram-chat-id": "-123456789",
  "pushover-user-key": "uQiRzpo4DXgh...",
  "pushover-app-token": "azGDORePK8gM..."
}
```

### SCRAPERS_CONFIG
```json
{
  "scrapers": [
    {
      "id": "honda-civic",
      "name": "Honda Civic Search",
      "enabled": true,
      "marketplace": "facebook",
      "query": "honda civic",
      "location": "Seattle, WA",
      "radius": 25,
      "priceMin": 5000,
      "priceMax": 15000,
      "includeKeywords": ["manual"],
      "excludeKeywords": ["accident"],
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

## Deployment Workflow

### Automatic Deployments

1. **Development**: Push to `develop` branch
   - Runs tests and linting
   - Deploys to `dev` stage
   - Updates configuration and secrets if provided

2. **Production**: Push to `main` branch
   - Runs tests and linting
   - Requires environment approval (if configured)
   - Deploys to `prod` stage
   - Creates deployment summary

### Manual Deployments

Use the "Deploy Peddler" workflow with custom inputs:
1. Go to `Actions` tab in GitHub
2. Select "Deploy Peddler" workflow
3. Click "Run workflow"
4. Choose stage and region
5. Click "Run workflow"

## Branch Strategy

Recommended Git flow:
```
feature/new-scraper → develop → main
                        ↓        ↓
                    Deploy Dev  Deploy Prod
```

- **Feature branches**: Create PRs to `develop`
- **Develop branch**: Auto-deploys to dev environment
- **Main branch**: Auto-deploys to production (with approval)

## Monitoring and Notifications

### Deployment Status
- Check the `Actions` tab for workflow runs
- Deployment summaries appear in workflow run details
- Failed deployments send notifications (if Slack webhook configured)

### AWS Resource Monitoring
- Lambda function logs in CloudWatch
- DynamoDB metrics in AWS Console
- Scheduler execution via EventBridge

## Troubleshooting

### Common Issues

#### "AWS credentials not found"
- Verify secrets are set in repository settings
- Check secret names match exactly (case-sensitive)
- Ensure IAM user has necessary permissions

#### "Serverless deployment failed"
- Check AWS service limits in target region
- Verify IAM permissions for Serverless operations
- Review CloudFormation events in AWS Console

#### "Configuration update failed"
- Validate JSON format in repository variables
- Check SSM parameter permissions
- Verify parameter name format

### Required IAM Permissions

The AWS credentials need these minimum permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "iam:*",
        "cloudformation:*",
        "dynamodb:*",
        "events:*",
        "logs:*",
        "ssm:*",
        "secretsmanager:*",
        "s3:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Security Best Practices

1. **Separate AWS accounts** for dev/prod environments
2. **Minimal IAM permissions** for deployment users
3. **Environment protection rules** for production
4. **Regular secret rotation** for long-lived credentials
5. **Audit logs** for all deployment activities

## Manual Cleanup

To remove all AWS resources:
1. Go to `Actions` tab
2. Select "Cleanup Resources" workflow
3. Click "Run workflow"
4. Select stage and region
5. Type "DELETE" in confirmation field
6. Click "Run workflow"

⚠️ **Warning**: This permanently deletes all Peddler resources in the specified stage.

## Support

- Check workflow run logs for detailed error messages
- Review AWS CloudFormation stack events
- Verify all secrets and variables are properly configured
- Test deployments in development environment first
