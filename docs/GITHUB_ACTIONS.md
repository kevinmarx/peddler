# GitHub Actions Deployment

This guide explains how to set up automated deployment of Peddler using GitHub Actions with Terraform and OIDC authentication.

## Overview

The deployment uses:
- **Terraform** for Infrastructure as Code
- **OIDC** for secure AWS authentication (no long-lived keys)
- **GitHub Actions** for CI/CD automation
- **S3** for Terraform state storage

## Prerequisites

1. **AWS Account** with administrator access
2. **S3 bucket** for Terraform state storage
3. **GitHub repository** with Peddler code

## Setup Instructions

### 1. Create S3 State Bucket

```bash
aws s3 mb s3://your-terraform-state-bucket
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled
```

### 2. Set Up OIDC Provider

Create the OIDC identity provider:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 3. Create IAM Role

Create `github-actions-role-trust-policy.json`:

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

Create the role:

```bash
aws iam create-role \
  --role-name peddler-github-actions \
  --assume-role-policy-document file://github-actions-role-trust-policy.json
```

### 4. Attach Permissions

Create and attach a policy for Terraform operations:

```bash
# Create policy for Terraform permissions
aws iam attach-role-policy \
  --role-name peddler-github-actions \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Alternative: Create custom policy with minimal permissions
cat << EOF > terraform-permissions.json
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
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name TerraformPeddlerPolicy \
  --policy-document file://terraform-permissions.json

aws iam attach-role-policy \
  --role-name peddler-github-actions \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/TerraformPeddlerPolicy
```

### 5. Configure Repository Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `AWS_ROLE_ARN`: `arn:aws:iam::YOUR_ACCOUNT_ID:role/peddler-github-actions`
- `AWS_REGION`: `us-east-1` (or your preferred region)
- `TF_STATE_BUCKET`: `your-terraform-state-bucket`

### 6. Configure Terraform Backend

Create `infrastructure/backend.tf`:

```hcl
terraform {
  backend "s3" {
    # These values are set by GitHub Actions
    # bucket = "set-by-github-actions"
    # key    = "peddler/terraform.tfstate"
    # region = "set-by-github-actions"
  }
}
```

## Workflow Details

### Deploy Workflow (`.github/workflows/deploy.yml`)

Triggers on:
- Push to `main` branch
- Manual dispatch

Steps:
1. **Checkout code**
2. **Configure AWS credentials** via OIDC
3. **Setup Node.js** and install dependencies
4. **Build and package** Lambda functions
5. **Initialize Terraform** with S3 backend
6. **Plan and apply** Terraform changes

### PR Validation Workflow (`.github/workflows/pr-validation.yml`)

Triggers on:
- Pull requests to `main`

Steps:
1. **Lint and type check** TypeScript code
2. **Run tests**
3. **Validate Terraform** configuration
4. **Plan Terraform** changes (dry-run)

### Cleanup Workflow (`.github/workflows/cleanup.yml`)

Manual workflow for destroying resources:
1. **Manual approval** required
2. **Terraform destroy** with confirmation

## Environment Configuration

### Multiple Environments

Use different AWS accounts or modify the Terraform workspace:

```yaml
# In deploy.yml
- name: Configure Environment
  run: |
    if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
      echo "ENVIRONMENT=production" >> $GITHUB_ENV
    else
      echo "ENVIRONMENT=staging" >> $GITHUB_ENV
    fi

- name: Terraform Apply
  run: |
    terraform apply -auto-approve \
      -var="environment=${{ env.ENVIRONMENT }}"
```

### Branch-based Deployments

Deploy different branches to different environments:

```yaml
strategy:
  matrix:
    include:
      - branch: main
        environment: production
        aws_region: us-east-1
      - branch: develop
        environment: staging
        aws_region: us-west-2
```

## Security Best Practices

### OIDC Benefits
- **No long-lived credentials** stored in GitHub
- **Short-lived tokens** (1 hour expiry)
- **Repository-specific access** via conditions
- **Automatic rotation** with each job

### Additional Security
1. **Least privilege** IAM policies
2. **Branch protection** rules
3. **Required reviews** for production deployments
4. **Environment secrets** for sensitive values
5. **Audit logging** with CloudTrail

## Monitoring and Troubleshooting

### GitHub Actions Logs

View deployment status:
- Go to repository → Actions tab
- Click on workflow run
- Review step-by-step logs

### Common Issues

#### "Could not assume role"
- Verify OIDC provider exists
- Check role trust policy conditions
- Ensure repository name matches exactly

#### "Access denied" during Terraform
- Review IAM policy permissions
- Check resource naming conflicts
- Verify AWS region settings

#### "State lock timeout"
- Another deployment may be running
- Force unlock if needed: `terraform force-unlock LOCK_ID`

#### Lambda package too large
- Optimize dependencies
- Use S3 for deployment packages
- Enable function-level packaging

### Debugging Commands

```bash
# Check OIDC provider
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com

# Verify role
aws iam get-role --role-name peddler-github-actions

# List attached policies
aws iam list-attached-role-policies --role-name peddler-github-actions

# Check Terraform state
aws s3 ls s3://your-terraform-state-bucket/peddler/
```

## Advanced Configuration

### Matrix Builds

Deploy to multiple regions:

```yaml
strategy:
  matrix:
    region: [us-east-1, us-west-2, eu-west-1]
steps:
  - name: Deploy to ${{ matrix.region }}
    run: terraform apply -var="aws_region=${{ matrix.region }}"
```

### Conditional Deployments

Skip deployment for documentation changes:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

### Slack Notifications

Add deployment notifications:

```yaml
- name: Notify Deployment
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Cost Optimization

### Efficient Workflows
- Use `actions/cache` for dependencies
- Skip unchanged infrastructure
- Parallel jobs where possible
- Cleanup temporary resources

### Resource Management
- Set appropriate timeouts
- Use conditional resource creation
- Monitor AWS costs regularly
- Clean up failed deployments

## Migration from Serverless

If migrating from Serverless Framework:

1. **Keep existing workflows** initially
2. **Create parallel Terraform deployment**
3. **Test thoroughly** in staging
4. **Import existing resources** to Terraform state
5. **Switch over** during maintenance window
6. **Remove Serverless** configurations

## Best Practices

1. **Always test** in non-production first
2. **Use pull requests** for infrastructure changes
3. **Review Terraform plans** before applying
4. **Tag all resources** for cost tracking
5. **Monitor deployment metrics**
6. **Keep sensitive data** in repository secrets
7. **Document environment-specific** configurations
8. **Regular security reviews** of permissions
