output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for listings"
  value       = aws_dynamodb_table.listings.name
}

output "config_parameter_name" {
  description = "SSM parameter name for configuration"
  value       = aws_ssm_parameter.config.name
}

output "secrets_manager_name" {
  description = "Secrets Manager secret name"
  value       = aws_secretsmanager_secret.secrets.name
}

output "scheduler_function_name" {
  description = "Name of the scheduler Lambda function"
  value       = aws_lambda_function.scheduler.function_name
}

output "scraper_function_name" {
  description = "Name of the scraper Lambda function"
  value       = aws_lambda_function.scraper.function_name
}

output "notifier_function_name" {
  description = "Name of the notifier Lambda function"
  value       = aws_lambda_function.notifier.function_name
}

output "eventbridge_rule_name" {
  description = "Name of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.scheduler.name
}
