#!/bin/bash

# Peddler Deployment Script
# This script helps deploy and configure the Peddler application

set -e

STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo "🚀 Deploying Peddler to $STAGE stage in $REGION region"

# Check if serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "❌ Serverless Framework not found. Installing..."
    npm install -g serverless
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Lint and build
echo "🔍 Running linter..."
npm run lint

echo "🏗️  Building TypeScript..."
npm run build

# Deploy to AWS
echo "☁️  Deploying to AWS..."
serverless deploy --stage $STAGE --region $REGION

# Get the parameter and secret ARNs
CONFIG_PARAM="/peddler/$STAGE/config"
SECRET_NAME="peddler/$STAGE/secrets"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your scrapers in SSM Parameter Store:"
echo "   aws ssm put-parameter --name '$CONFIG_PARAM' --value file://examples/config.json --type String --overwrite"
echo ""
echo "2. Add your secrets to Secrets Manager:"
echo "   aws secretsmanager update-secret --secret-id '$SECRET_NAME' --secret-string file://examples/secrets.json"
echo ""
echo "3. Test your deployment:"
echo "   serverless invoke -f scheduler --stage $STAGE"
echo ""
echo "4. Check logs:"
echo "   serverless logs -f scheduler --stage $STAGE"
echo ""
echo "🔗 Useful AWS Console Links:"
echo "   SSM Parameter: https://$REGION.console.aws.amazon.com/systems-manager/parameters$CONFIG_PARAM/description"
echo "   Secrets Manager: https://$REGION.console.aws.amazon.com/secretsmanager/secret?name=$SECRET_NAME"
echo "   DynamoDB Table: https://$REGION.console.aws.amazon.com/dynamodb/home?region=$REGION#tables:"
echo "   CloudWatch Logs: https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups"
echo ""

if [ "$STAGE" = "prod" ]; then
    echo "⚠️  Production deployment completed. Monitor carefully!"
else
    echo "🧪 Development deployment completed. Happy testing!"
fi
