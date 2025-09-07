# Terraform Deployment Guide

This guide explains how to deploy Peddler using Terraform instead of the Serverless Framework.

## Why Terraform?

- **Infrastructure as Code**: Version control your entire AWS infrastructure
- **State Management**: Better handling of resource dependencies and state
- **Multi-Cloud Support**: Easily extend to other cloud providers
- **Team Collaboration**: Shared state and locking mechanisms
- **Better Resource Management**: More granular control over AWS resources

## Prerequisites

1. **Terraform >= 1.0** installed locally
2. **AWS CLI** configured with appropriate permissions
3. **S3 bucket** for Terraform state storage (recommended)
4. **Node.js 18+** for building Lambda functions

## Setup Instructions

### 1. Configure Terraform Backend

Copy the example backend configuration:
```bash
cp infrastructure/backend.tf.example infrastructure/backend.tf
```

Edit `infrastructure/backend.tf` with your S3 bucket details:
```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "peddler/terraform.tfstate"
    region = "us-east-1"
  }
}
```

### 2. Initialize Terraform

```bash
cd infrastructure
terraform init
```

### 3. Configure Variables

Create a `terraform.tfvars` file:
```hcl
environment = "production"
aws_region  = "us-east-1"
project_name = "peddler"

# Optional customizations
scheduler_rate = "rate(10 minutes)"
max_concurrent_scrapers = 10
lambda_timeout = 900
lambda_memory = 1024
```

### 4. Build and Package Lambda Functions

```bash
# From project root
npm run build
npm run package
```

This creates ZIP files in `dist/lambdas/`:
- `scheduler.zip`
- `scraper.zip`
- `notifier.zip`

### 5. Plan and Apply

```bash
cd infrastructure

# Review planned changes
terraform plan

# Apply changes
terraform apply
```

## GitHub Actions OIDC Setup

For secure GitHub Actions deployment without long-lived AWS credentials:

### 1. Create OIDC Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create IAM Role

Create a role that GitHub Actions can assume:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/peddler:*"
        }
      }
    }
  ]
}
```

### 3. Attach Permissions

The role needs these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "iam:*",
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

### 4. Configure Repository

Add the role ARN as a repository secret:
```
AWS_ROLE_ARN = arn:aws:iam::YOUR_ACCOUNT_ID:role/peddler-github-actions
```

## Resource Overview

Terraform creates these AWS resources:

### Lambda Functions
- **peddler-production-scheduler**: Main orchestrator
- **peddler-production-scraper**: Individual scraper execution
- **peddler-production-notifier**: Notification dispatch

### Data Storage
- **DynamoDB Table**: `peddler-production-listings`
- **SSM Parameter**: `/peddler/production/config`
- **Secrets Manager**: `peddler/production/secrets`

### Scheduling
- **EventBridge Rule**: Triggers scheduler every 10 minutes
- **CloudWatch Log Groups**: Function logs with 14-day retention

### IAM Resources
- **Lambda Execution Role**: With minimal required permissions
- **Policies**: DynamoDB, SSM, Secrets Manager access

## Configuration Management

### Scraper Configuration

Update via SSM Parameter Store:
```bash
aws ssm put-parameter \
  --name "/peddler/production/config" \
  --value file://examples/config.json \
  --type String \
  --overwrite
```

### Secrets Management

Update via Secrets Manager:
```bash
aws secretsmanager update-secret \
  --secret-id "peddler/production/secrets" \
  --secret-string file://examples/secrets.json
```

## Local Development

### Terraform Commands

```bash
# Format Terraform files
npm run tf:format

# Validate configuration
npm run tf:validate

# Plan changes
npm run tf:plan

# Apply changes
npm run tf:apply

# Destroy resources (CAREFUL!)
npm run tf:destroy
```

### Testing Functions

```bash
# Invoke scheduler function
aws lambda invoke \
  --function-name peddler-production-scheduler \
  --payload '{}' \
  response.json

# Check logs
aws logs tail /aws/lambda/peddler-production-scheduler --follow
```

## Environment Management

### Multiple Environments

Deploy different environments by changing the `environment` variable:

```bash
# Development
terraform apply -var="environment=development"

# Production
terraform apply -var="environment=production"
```

### Workspaces (Advanced)

Use Terraform workspaces for complete isolation:

```bash
# Create and switch to development workspace
terraform workspace new development
terraform workspace select development
terraform apply

# Switch to production workspace
terraform workspace new production
terraform workspace select production
terraform apply
```

## State Management

### Remote State Benefits
- **Team Collaboration**: Shared state across team members
- **State Locking**: Prevents concurrent modifications
- **Backup**: State stored securely in S3
- **Versioning**: S3 versioning for state history

### State Commands
```bash
# Show current state
terraform show

# List resources
terraform state list

# Import existing resources
terraform import aws_dynamodb_table.listings existing-table-name

# Move resources
terraform state mv aws_lambda_function.old aws_lambda_function.new
```

## Troubleshooting

### Common Issues

#### "Backend initialization required"
```bash
terraform init
```

#### "State lock acquisition failed"
```bash
terraform force-unlock LOCK_ID
```

#### "Resource already exists"
```bash
terraform import resource_type.resource_name existing_resource_id
```

#### Lambda deployment package too large
```bash
# Use S3 for large packages
resource "aws_s3_object" "lambda_zip" {
  bucket = "your-lambda-bucket"
  key    = "scheduler.zip"
  source = "../dist/lambdas/scheduler.zip"
}

resource "aws_lambda_function" "scheduler" {
  s3_bucket = aws_s3_object.lambda_zip.bucket
  s3_key    = aws_s3_object.lambda_zip.key
  # ... other configuration
}
```

### Best Practices

1. **Always run `terraform plan`** before `apply`
2. **Use variables** for environment-specific values
3. **Tag all resources** for cost tracking
4. **Enable S3 versioning** for state bucket
5. **Use state locking** with DynamoDB
6. **Review terraform destroy** output carefully

## Migration from Serverless

If migrating from Serverless Framework:

1. **Export existing resources** to Terraform
2. **Import state** for existing resources
3. **Test thoroughly** in development first
4. **Plan the migration** during maintenance windows
5. **Keep backups** of Serverless configurations

## Cost Optimization

- **Use on-demand pricing** for DynamoDB
- **Set appropriate log retention** periods
- **Monitor Lambda duration** and memory usage
- **Use lifecycle policies** for S3 state bucket
- **Tag resources** for cost allocation

## Security Considerations

- **Least privilege IAM** policies
- **Encrypt Terraform state** with S3 KMS
- **Use Secrets Manager** for sensitive data
- **Enable CloudTrail** for audit logging
- **Regular security reviews** of permissions
