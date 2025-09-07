locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# IAM Role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM Policy for Lambda functions
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.listings.arn,
          "${aws_dynamodb_table.listings.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:PutParameter"
        ]
        Resource = aws_ssm_parameter.config.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.secrets.arn
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach basic execution role
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB Table for listings
resource "aws_dynamodb_table" "listings" {
  name           = "${local.name_prefix}-listings"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "scraperId"
  range_key      = "listingId"

  attribute {
    name = "scraperId"
    type = "S"
  }

  attribute {
    name = "listingId"
    type = "S"
  }

  attribute {
    name = "firstSeen"
    type = "S"
  }

  global_secondary_index {
    name     = "FirstSeenIndex"
    hash_key = "scraperId"
    range_key = "firstSeen"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.common_tags
}

# SSM Parameter for configuration
resource "aws_ssm_parameter" "config" {
  name  = "/${var.project_name}/${var.environment}/config"
  type  = "String"
  value = jsonencode({
    scrapers = [
      {
        id                  = "example-scraper"
        name                = "Example Facebook Marketplace Search"
        enabled             = false
        marketplace         = "facebook"
        query               = "honda civic"
        location            = "Seattle, WA"
        radius              = 25
        priceMin            = 5000
        priceMax            = 15000
        includeKeywords     = ["manual", "stick"]
        excludeKeywords     = ["accident", "salvage", "flood"]
        scrollDepth         = 3
        priceDropThreshold  = 0.1
        notifications = {
          slack = {
            enabled = true
            webhook = "slack-webhook-url-from-secrets"
          }
          telegram = {
            enabled = false
            botToken = "telegram-bot-token-from-secrets"
            chatId = "telegram-chat-id-from-secrets"
          }
          pushover = {
            enabled = false
            userKey = "pushover-user-key-from-secrets"
            appToken = "pushover-app-token-from-secrets"
          }
        }
      }
    ]
  })

  description = "Peddler scraper configuration"
  tags        = local.common_tags
}

# Secrets Manager secret for sensitive data
resource "aws_secretsmanager_secret" "secrets" {
  name                    = "${var.project_name}/${var.environment}/secrets"
  description             = "Peddler secrets for authentication and notifications"
  recovery_window_in_days = 7

  tags = local.common_tags
}

# Initial secrets value
resource "aws_secretsmanager_secret_version" "secrets" {
  secret_id = aws_secretsmanager_secret.secrets.id
  secret_string = jsonencode({
    "facebook-cookies"    = ""
    "slack-webhook-url"   = ""
    "telegram-bot-token"  = ""
    "telegram-chat-id"    = ""
    "pushover-user-key"   = ""
    "pushover-app-token"  = ""
  })
}

# Lambda function: Scheduler
resource "aws_lambda_function" "scheduler" {
  filename         = "../dist/lambdas/scheduler.zip"
  function_name    = "${local.name_prefix}-scheduler"
  role            = aws_iam_role.lambda_role.arn
  handler         = "handlers/scheduler.handler"
  runtime         = "nodejs18.x"
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory

  source_code_hash = filebase64sha256("../dist/lambdas/scheduler.zip")

  environment {
    variables = {
      STAGE                     = var.environment
      LISTINGS_TABLE           = aws_dynamodb_table.listings.name
      CONFIG_PARAMETER         = aws_ssm_parameter.config.name
      SECRETS_NAME             = aws_secretsmanager_secret.secrets.name
      MAX_CONCURRENT_SCRAPERS  = var.max_concurrent_scrapers
    }
  }

  tags = local.common_tags
}

# Lambda function: Scraper
resource "aws_lambda_function" "scraper" {
  filename         = "../dist/lambdas/scraper.zip"
  function_name    = "${local.name_prefix}-scraper"
  role            = aws_iam_role.lambda_role.arn
  handler         = "handlers/scraper.handler"
  runtime         = "nodejs18.x"
  timeout         = 300
  memory_size     = 512

  source_code_hash = filebase64sha256("../dist/lambdas/scraper.zip")

  environment {
    variables = {
      STAGE            = var.environment
      LISTINGS_TABLE   = aws_dynamodb_table.listings.name
      CONFIG_PARAMETER = aws_ssm_parameter.config.name
      SECRETS_NAME     = aws_secretsmanager_secret.secrets.name
    }
  }

  tags = local.common_tags
}

# Lambda function: Notifier
resource "aws_lambda_function" "notifier" {
  filename         = "../dist/lambdas/notifier.zip"
  function_name    = "${local.name_prefix}-notifier"
  role            = aws_iam_role.lambda_role.arn
  handler         = "handlers/notifier.handler"
  runtime         = "nodejs18.x"
  timeout         = 60
  memory_size     = 256

  source_code_hash = filebase64sha256("../dist/lambdas/notifier.zip")

  environment {
    variables = {
      STAGE            = var.environment
      LISTINGS_TABLE   = aws_dynamodb_table.listings.name
      CONFIG_PARAMETER = aws_ssm_parameter.config.name
      SECRETS_NAME     = aws_secretsmanager_secret.secrets.name
    }
  }

  tags = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "scheduler" {
  name              = "/aws/lambda/${aws_lambda_function.scheduler.function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "scraper" {
  name              = "/aws/lambda/${aws_lambda_function.scraper.function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "notifier" {
  name              = "/aws/lambda/${aws_lambda_function.notifier.function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

# EventBridge rule for scheduling
resource "aws_cloudwatch_event_rule" "scheduler" {
  name                = "${local.name_prefix}-scheduler"
  description         = "Trigger Peddler scheduler function"
  schedule_expression = var.scheduler_rate
  tags                = local.common_tags
}

# EventBridge target
resource "aws_cloudwatch_event_target" "scheduler" {
  rule      = aws_cloudwatch_event_rule.scheduler.name
  target_id = "PeddlerSchedulerTarget"
  arn       = aws_lambda_function.scheduler.arn
}

# Lambda permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduler.arn
}
