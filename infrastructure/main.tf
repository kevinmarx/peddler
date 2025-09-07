terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure this with your actual S3 bucket and region
    # bucket = "your-terraform-state-bucket"
    # key    = "peddler/terraform.tfstate"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "peddler"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
