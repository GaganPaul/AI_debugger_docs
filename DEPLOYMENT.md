# Smart Debugger Deployment Guide

This guide covers deploying the Smart Debugger AWS backend infrastructure and configuring the system for production use.

## Table of Contents

- [Prerequisites](#prerequisites)
- [AWS Infrastructure Setup](#aws-infrastructure-setup)
- [Deployment Methods](#deployment-methods)
- [Configuration](#configuration)
- [Post-Deployment](#post-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Scaling and Performance](#scaling-and-performance)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

1. **AWS CLI** (version 2.x or higher)
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Verify installation
   aws --version
   ```

2. **AWS SAM CLI** (recommended) or CloudFormation
   ```bash
   # Install SAM CLI
   pip install aws-sam-cli
   
   # Verify installation
   sam --version
   ```

3. **Python 3.12+** for Lambda function packaging
   ```bash
   python --version
   ```

4. **jq** for JSON processing (optional but helpful)
   ```bash
   # macOS
   brew install jq
   
   # Linux
   sudo apt-get install jq
   ```

### AWS Account Requirements

1. **AWS Account** with appropriate permissions
2. **IAM User** with the following permissions:
   - CloudFormation: Full access
   - Lambda: Full access
   - API Gateway: Full access
   - S3: Full access
   - DynamoDB: Full access
   - Bedrock: Full access
   - Secrets Manager: Full access
   - CloudWatch: Full access
   - IAM: Create/manage roles and policies

3. **AWS Credentials** configured
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region, Output format
   ```

4. **Bedrock Model Access**
   - Request access to Claude Sonnet 3.5 in AWS Bedrock console
   - Navigate to: Bedrock > Model access > Request model access
   - Select: Anthropic Claude Sonnet 3.5
   - Wait for approval (usually instant)

### Cost Considerations

Estimated monthly costs for moderate usage (1000 crashes/month):

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| API Gateway | 1000 requests | $3.50 |
| Lambda | 1000 invocations, 30s avg | $5.00 |
| S3 | 10GB storage, 1000 requests | $0.50 |
| DynamoDB | On-demand, 1000 writes | $2.00 |
| Bedrock | Claude Sonnet, 1000 analyses | $15.00 |
| CloudWatch | Logs + metrics | $1.00 |
| **Total** | | **~$27/month** |

For production with 10,000 crashes/month: ~$200/month

## AWS Infrastructure Setup

### Architecture Overview

The Smart Debugger backend consists of:

1. **API Gateway**: REST API endpoint for CLI communication
2. **Lambda Functions**:
   - `crash-ingestion`: Receives and validates traces
   - `sanitizer`: Applies 5-layer sanitization
   - `ai-analyzer`: AI-powered analysis with Bedrock
   - `project-memory`: Manages learned patterns
   - `failure-report`: Generates detailed reports
3. **S3 Bucket**: Encrypted trace storage
4. **DynamoDB Tables**:
   - `CrashHistoryTable`: Crash records with 30-day TTL
   - `ProjectMemoryTable`: Learned patterns and context
5. **Secrets Manager**: API key storage
6. **CloudWatch**: Logging, metrics, and alarms

### Infrastructure Diagram

```
┌─────────────┐
│   CLI       │
│   Client    │
└──────┬──────┘
       │ HTTPS (TLS 1.3)
       ▼
┌─────────────────────────────────────────┐
│         API Gateway                      │
│  - API Key Authentication                │
│  - Rate Limiting (100/hour)              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│    Crash Ingestion Lambda                │
│  - Validate API key                      │
│  - Store raw trace in S3                 │
│  - Trigger sanitizer                     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│    Sanitizer Lambda                      │
│  - 5-layer sanitization                  │
│  - Bedrock Guardrails (Layer 5)          │
│  - Store sanitized trace                 │
│  - Trigger AI analyzer                   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│    AI Analyzer Lambda                    │
│  - Load project memory                   │
│  - Analyze with Bedrock Claude           │
│  - Calculate confidence                  │
│  - Store results                         │
└─────────────────────────────────────────┘
```

## Deployment Methods

### Method 1: Automated Deployment Script (Recommended)

The `deploy.sh` script automates the entire deployment process.

```bash
# Navigate to infrastructure directory
cd ai_debugger/infrastructure

# Make script executable
chmod +x deploy.sh

# Deploy to development environment
./deploy.sh

# Or deploy to production
ENVIRONMENT=prod STACK_NAME=smart-debugger-prod ./deploy.sh
```

**What the script does:**
1. Checks prerequisites (AWS CLI, credentials)
2. Packages Lambda functions with dependencies
3. Deploys infrastructure using SAM or CloudFormation
4. Retrieves and displays API endpoint and key
5. Provides configuration commands for CLI

**Environment Variables:**
- `STACK_NAME`: CloudFormation stack name (default: `smart-debugger-dev`)
- `ENVIRONMENT`: Environment name (default: `dev`)
- `PROJECT_NAME`: Project name (default: `smart-debugger`)
- `AWS_REGION`: AWS region (default: `us-east-1`)

**Example:**
```bash
# Deploy to production in us-west-2
ENVIRONMENT=prod \
STACK_NAME=smart-debugger-prod \
AWS_REGION=us-west-2 \
./deploy.sh
```

### Method 2: AWS SAM Deployment

For more control over the deployment process:

```bash
cd ai_debugger/infrastructure

# Build the application
sam build --template-file template.yaml

# Deploy with guided prompts (first time)
sam deploy --guided

# Or deploy with parameters
sam deploy \
  --stack-name smart-debugger-dev \
  --parameter-overrides \
    Environment=dev \
    ProjectName=smart-debugger \
  --capabilities CAPABILITY_IAM \
  --region us-east-1 \
  --resolve-s3
```

**SAM Guided Deployment:**
```
Configuring SAM deploy
======================

Looking for config file [samconfig.toml] :  Not found

Setting default arguments for 'sam deploy'
=========================================
Stack Name [smart-debugger-dev]: 
AWS Region [us-east-1]: 
Parameter Environment [dev]: 
Parameter ProjectName [smart-debugger]: 
#Shows you resources changes to be deployed and require a 'Y' to initiate deploy
Confirm changes before deploy [y/N]: y
#SAM needs permission to be able to create roles to connect to the resources in your template
Allow SAM CLI IAM role creation [Y/n]: Y
Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: 
SAM configuration environment [default]: 

Deploying with following values
===============================
Stack name                   : smart-debugger-dev
Region                       : us-east-1
Confirm changeset            : True
Deployment s3 bucket         : aws-sam-cli-managed-default-samclisourcebucket-xxx
Capabilities                 : ["CAPABILITY_IAM"]
Parameter overrides          : {"Environment": "dev", "ProjectName": "smart-debugger"}
```

### Method 3: CloudFormation Direct Deployment

For environments without SAM CLI:

```bash
cd ai_debugger/infrastructure

# Create stack
aws cloudformation create-stack \
  --stack-name smart-debugger-dev \
  --template-body file://template.json \
  --parameters \
    ParameterKey=Environment,ParameterValue=dev \
    ParameterKey=ProjectName,ParameterValue=smart-debugger \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name smart-debugger-dev \
  --region us-east-1

# Update existing stack
aws cloudformation update-stack \
  --stack-name smart-debugger-dev \
  --template-body file://template.json \
  --parameters \
    ParameterKey=Environment,ParameterValue=dev \
    ParameterKey=ProjectName,ParameterValue=smart-debugger \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

## Configuration

### Lambda Function Configuration

Each Lambda function has specific configuration requirements:

#### Crash Ingestion Lambda
```yaml
Runtime: python3.12
Memory: 512 MB
Timeout: 30 seconds
Environment Variables:
  - TRACE_BUCKET: S3 bucket name
  - SANITIZER_FUNCTION_ARN: Sanitizer Lambda ARN
  - CRASH_HISTORY_TABLE: DynamoDB table name
```

#### Sanitizer Lambda
```yaml
Runtime: python3.12
Memory: 512 MB
Timeout: 60 seconds
Environment Variables:
  - TRACE_BUCKET: S3 bucket name
  - AI_ANALYZER_FUNCTION_ARN: AI Analyzer Lambda ARN
  - BEDROCK_GUARDRAIL_ID: Bedrock Guardrail ID
```

#### AI Analyzer Lambda
```yaml
Runtime: python3.12
Memory: 1024 MB
Timeout: 60 seconds
Environment Variables:
  - TRACE_BUCKET: S3 bucket name
  - CRASH_HISTORY_TABLE: DynamoDB table name
  - PROJECT_MEMORY_TABLE: DynamoDB table name
  - BEDROCK_MODEL_ID: claude-3-5-sonnet-20241022
  - BEDROCK_GUARDRAIL_ID: Bedrock Guardrail ID
```

### API Gateway Configuration

```yaml
API Name: smart-debugger-api-{environment}
Stage: {environment}
Authentication: API Key required
Rate Limiting: 100 requests per hour per key
CORS: Enabled for all origins
Endpoints:
  - POST /crashes: Upload crash trace
  - GET /analysis/{crash_id}: Get analysis result
  - POST /memory/{project_id}: Update project memory
  - GET /memory/{project_id}: Get project context
  - GET /report/{crash_id}: Get failure report
```

### DynamoDB Configuration

#### CrashHistoryTable
```yaml
Partition Key: crash_id (String)
Global Secondary Index:
  Name: project-timestamp-index
  Partition Key: project_id (String)
  Sort Key: timestamp (Number)
TTL Attribute: ttl (30 days)
Billing Mode: PAY_PER_REQUEST
Point-in-time Recovery: Enabled
```

#### ProjectMemoryTable
```yaml
Partition Key: project_id (String)
Sort Key: pattern_id (String)
Billing Mode: PAY_PER_REQUEST
Point-in-time Recovery: Enabled
```

### S3 Bucket Configuration

```yaml
Bucket Name: smart-debugger-traces-{environment}-{account-id}
Encryption: AES256 server-side encryption
Versioning: Enabled
Lifecycle Rules:
  - Delete objects older than 30 days
Public Access: Blocked (all settings)
```

### Bedrock Guardrails Configuration

Create a Bedrock Guardrail for Layer 5 sanitization:

```bash
# Create guardrail
aws bedrock create-guardrail \
  --name smart-debugger-guardrail \
  --description "Layer 5 sanitization for Smart Debugger" \
  --blocked-input-messaging "Sensitive content detected" \
  --blocked-outputs-messaging "Sensitive content in response" \
  --content-policy-config '{
    "filtersConfig": [
      {
        "type": "SEXUAL",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "VIOLENCE",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "HATE",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "INSULTS",
        "inputStrength": "MEDIUM",
        "outputStrength": "MEDIUM"
      },
      {
        "type": "MISCONDUCT",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "PROMPT_ATTACK",
        "inputStrength": "HIGH",
        "outputStrength": "NONE"
      }
    ]
  }' \
  --sensitive-information-policy-config '{
    "piiEntitiesConfig": [
      {"type": "EMAIL", "action": "BLOCK"},
      {"type": "PHONE", "action": "BLOCK"},
      {"type": "NAME", "action": "ANONYMIZE"},
      {"type": "ADDRESS", "action": "BLOCK"},
      {"type": "SSN", "action": "BLOCK"},
      {"type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK"},
      {"type": "IP_ADDRESS", "action": "ANONYMIZE"}
    ]
  }'

# Get guardrail ID
aws bedrock list-guardrails --query 'guardrails[?name==`smart-debugger-guardrail`].id' --output text
```

## Post-Deployment

### Retrieve Deployment Outputs

```bash
# Get API endpoint
aws cloudformation describe-stacks \
  --stack-name smart-debugger-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text

# Get API key ID
aws cloudformation describe-stacks \
  --stack-name smart-debugger-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text

# Get API key value
API_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name smart-debugger-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text)

aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text

# Get S3 bucket name
aws cloudformation describe-stacks \
  --stack-name smart-debugger-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`TraceBucketName`].OutputValue' \
  --output text
```

### Configure CLI Clients

Distribute configuration to users:

```bash
# Create client configuration
cat > ~/.smart-debug/config.json << EOF
{
  "api_key": "YOUR_API_KEY_HERE",
  "aws_endpoint": "YOUR_API_ENDPOINT_HERE",
  "project_id": "your-project-id",
  "offline_mode": false
}
EOF
```

### Test Deployment

```bash
# Test crash ingestion endpoint
curl -X POST https://YOUR_API_ENDPOINT/dev/crashes \
  -H "X-Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "trace_data": {
      "exception_info": {
        "exception_type": "ValueError",
        "message": "test error",
        "line_number": 10
      },
      "steps": []
    },
    "project_id": "test-project"
  }'

# Expected response: 200 OK with crash_id
```

### Verify Lambda Functions

```bash
# List Lambda functions
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `smart-debugger`)].FunctionName'

# Test crash ingestion Lambda
aws lambda invoke \
  --function-name smart-debugger-crash-ingestion-dev \
  --payload '{"body": "{\"trace_data\": {}, \"project_id\": \"test\"}"}' \
  response.json

cat response.json
```

### Check CloudWatch Logs

```bash
# Tail crash ingestion logs
aws logs tail /aws/lambda/smart-debugger-crash-ingestion-dev --follow

# Tail AI analyzer logs
aws logs tail /aws/lambda/smart-debugger-ai-analyzer-dev --follow

# Query recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/smart-debugger-crash-ingestion-dev \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

## Monitoring and Maintenance

### CloudWatch Dashboard

Access the monitoring dashboard:

```bash
# Get dashboard URL
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=smart-debugger-monitoring-dev"
```

Dashboard includes:
- Lambda function errors and error rates
- Analysis times and latency
- AI confidence scores
- Lambda invocations and concurrent executions
- Sanitization statistics
- API Gateway request metrics

### CloudWatch Alarms

Configured alarms:

1. **Error Rate Alarms** (Threshold: 5%)
   - Crash Ingestion errors
   - AI Analyzer errors
   - Sanitizer errors
   - Project Memory errors
   - Failure Report errors

2. **Latency Alarms**
   - AI Analyzer latency >30s
   - Sanitizer latency >60s
   - High analysis time >25s

3. **Quality Alarms**
   - Low confidence scores <60%

### SNS Notifications

Set up SNS topic for alarm notifications:

```bash
# Create SNS topic
aws sns create-topic --name smart-debugger-alarms

# Subscribe email to topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:smart-debugger-alarms \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email
```

### Regular Maintenance Tasks

#### Weekly
- Review CloudWatch alarms
- Check error rates in logs
- Monitor confidence score trends
- Review API usage patterns

#### Monthly
- Analyze cost trends
- Review and optimize Lambda memory/timeout
- Clean up old CloudWatch log groups
- Update Lambda function code if needed
- Review and rotate API keys

#### Quarterly
- Review and update Bedrock Guardrails
- Audit IAM roles and permissions
- Review DynamoDB capacity and costs
- Update Lambda runtime versions
- Security audit

### Backup and Disaster Recovery

#### DynamoDB Backups

```bash
# Enable point-in-time recovery (already enabled in template)
aws dynamodb update-continuous-backups \
  --table-name smart-debugger-crash-history-dev \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Create on-demand backup
aws dynamodb create-backup \
  --table-name smart-debugger-crash-history-dev \
  --backup-name crash-history-backup-$(date +%Y%m%d)

# List backups
aws dynamodb list-backups \
  --table-name smart-debugger-crash-history-dev
```

#### S3 Versioning

S3 versioning is enabled by default. To restore a deleted object:

```bash
# List object versions
aws s3api list-object-versions \
  --bucket smart-debugger-traces-dev-ACCOUNT_ID \
  --prefix traces/

# Restore specific version
aws s3api copy-object \
  --bucket smart-debugger-traces-dev-ACCOUNT_ID \
  --copy-source smart-debugger-traces-dev-ACCOUNT_ID/traces/file.json?versionId=VERSION_ID \
  --key traces/file.json
```

## Scaling and Performance

### Lambda Concurrency

Configure reserved concurrency for production:

```bash
# Set reserved concurrency for AI Analyzer
aws lambda put-function-concurrency \
  --function-name smart-debugger-ai-analyzer-prod \
  --reserved-concurrent-executions 100

# Set provisioned concurrency for consistent performance
aws lambda put-provisioned-concurrency-config \
  --function-name smart-debugger-ai-analyzer-prod \
  --provisioned-concurrent-executions 10 \
  --qualifier ALIAS_OR_VERSION
```

### DynamoDB Auto Scaling

For high-traffic production, consider provisioned capacity with auto-scaling:

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/smart-debugger-crash-history-prod \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id table/smart-debugger-crash-history-prod \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --policy-name crash-history-read-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBReadCapacityUtilization"
    }
  }'
```

### API Gateway Throttling

Adjust rate limits for production:

```bash
# Update usage plan
aws apigateway update-usage-plan \
  --usage-plan-id USAGE_PLAN_ID \
  --patch-operations \
    op=replace,path=/throttle/rateLimit,value=1000 \
    op=replace,path=/throttle/burstLimit,value=2000
```

## Security

### API Key Rotation

Rotate API keys regularly:

```bash
# Create new API key
NEW_KEY_ID=$(aws apigateway create-api-key \
  --name smart-debugger-key-$(date +%Y%m%d) \
  --enabled \
  --query 'id' \
  --output text)

# Associate with usage plan
aws apigateway create-usage-plan-key \
  --usage-plan-id USAGE_PLAN_ID \
  --key-id $NEW_KEY_ID \
  --key-type API_KEY

# Get new key value
aws apigateway get-api-key \
  --api-key $NEW_KEY_ID \
  --include-value \
  --query 'value' \
  --output text

# Distribute new key to users
# After transition period, delete old key
aws apigateway delete-api-key --api-key OLD_KEY_ID
```

### IAM Role Auditing

Review Lambda execution roles:

```bash
# List roles
aws iam list-roles \
  --query 'Roles[?starts_with(RoleName, `smart-debugger`)].RoleName'

# Get role policy
aws iam get-role-policy \
  --role-name smart-debugger-CrashIngestionRole-XXX \
  --policy-name CrashIngestionPolicy
```

### Security Best Practices

1. **Least Privilege**: Lambda roles have minimum required permissions
2. **Encryption**: All data encrypted at rest and in transit
3. **API Keys**: Rotate every 90 days
4. **Secrets Manager**: Store sensitive configuration
5. **VPC**: Consider VPC deployment for additional isolation
6. **WAF**: Add AWS WAF for API Gateway protection
7. **Audit Logs**: Enable CloudTrail for API calls

## Troubleshooting

### Deployment Failures

**Stack creation failed:**
```bash
# Get failure reason
aws cloudformation describe-stack-events \
  --stack-name smart-debugger-dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'

# Common issues:
# - Insufficient IAM permissions
# - Resource limits exceeded
# - Invalid parameter values
```

**Lambda deployment failed:**
```bash
# Check Lambda function errors
aws lambda get-function \
  --function-name smart-debugger-crash-ingestion-dev

# Update function code manually
cd lambda/crash_ingestion
zip -r function.zip .
aws lambda update-function-code \
  --function-name smart-debugger-crash-ingestion-dev \
  --zip-file fileb://function.zip
```

### Runtime Issues

**Lambda timeout:**
```bash
# Increase timeout
aws lambda update-function-configuration \
  --function-name smart-debugger-ai-analyzer-dev \
  --timeout 90

# Increase memory (also increases CPU)
aws lambda update-function-configuration \
  --function-name smart-debugger-ai-analyzer-dev \
  --memory-size 2048
```

**DynamoDB throttling:**
```bash
# Check throttled requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=smart-debugger-crash-history-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Switch to provisioned capacity or increase on-demand limits
```

### Cleanup

To remove all resources:

```bash
# Delete stack
aws cloudformation delete-stack --stack-name smart-debugger-dev

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name smart-debugger-dev

# Manually delete S3 bucket (if not empty)
aws s3 rm s3://smart-debugger-traces-dev-ACCOUNT_ID --recursive
aws s3 rb s3://smart-debugger-traces-dev-ACCOUNT_ID

# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name /aws/lambda/smart-debugger-crash-ingestion-dev
aws logs delete-log-group --log-group-name /aws/lambda/smart-debugger-sanitizer-dev
aws logs delete-log-group --log-group-name /aws/lambda/smart-debugger-ai-analyzer-dev
```

## Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [API Gateway Security](https://docs.aws.amazon.com/apigateway/latest/developerguide/security.html)
