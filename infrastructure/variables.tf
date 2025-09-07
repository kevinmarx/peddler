variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "production"], var.environment)
    error_message = "Environment must be either 'development' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "peddler"
}

variable "scheduler_rate" {
  description = "EventBridge schedule rate for scraper execution"
  type        = string
  default     = "rate(10 minutes)"
}

variable "max_concurrent_scrapers" {
  description = "Maximum number of scrapers to run concurrently"
  type        = number
  default     = 10
}

variable "listing_ttl_days" {
  description = "Number of days to keep listings in DynamoDB"
  type        = number
  default     = 30
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 900
}

variable "lambda_memory" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 1024
}
