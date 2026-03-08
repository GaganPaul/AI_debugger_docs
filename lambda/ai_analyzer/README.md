# AI Analyzer Lambda Function

## Overview

The AI Analyzer Lambda function is the core intelligence component of the Smart Debugger system. It performs AI-powered crash analysis using Amazon Bedrock Claude Sonnet, calculates confidence scores, and implements decision logic to determine whether to auto-fix, ask questions, or generate a failure report.

## Functionality

### Main Responsibilities

1. **Load Project Memory Context**: Retrieves relevant patterns and historical data from DynamoDB
2. **AI Analysis**: Calls Amazon Bedrock Claude Sonnet with full context
3. **Confidence Scoring**: Calculates confidence score (0-100%) based on analysis quality
4. **Decision Logic**: Determines action based on confidence:
   - ≥80%: Auto-fix with specific code changes
   - 60-79%: Ask targeted clarifying questions
   - <60%: Generate failure report
5. **Result Storage**: Stores analysis results in DynamoDB
6. **Metrics Logging**: Logs operations to CloudWatch

### Iterative Refinement Support

The function supports iterative refinement through the `user_answers` and `iteration_count` parameters:
- Accepts user answers to previous questions
- Re-analyzes with enhanced context
- Tracks iteration count (max 3 iterations)
- Triggers failure report after 3 iterations if confidence still low

## Input Event Format

```json
{
  "crash_id": "crash_20240220_142200_abc123",
  "s3_key": "sanitized/project-id/crash_20240220_142200_abc123.json",
  "project_id": "my-web-app",
  "sanitization_stats": {
    "layer_1": 2,
    "layer_2": 1,
    "layer_3": 0,
    "layer_4": 3,
    "layer_5": 0
  },
  "user_answers": {
    "What is the expected format of variable X?": "It should be a dictionary with 'user' key"
  },
  "iteration_count": 1
}
```

## Output Response Format

### Auto-Fix Response (Confidence ≥80%)

```json
{
  "statusCode": 200,
  "body": {
    "crash_id": "crash_20240220_142200_abc123",
    "action": "auto_fix",
    "confidence": 87.5,
    "root_cause": "Variable 'user_data' is None because API response format changed",
    "explanation": "The API now returns user data under response['data']['user'] instead of response['user']...",
    "fix_suggestions": [
      "Change line 42 to: user_data = response['data']['user']",
      "Add validation: if 'data' in response and 'user' in response['data']:"
    ],
    "specific_line": 42,
    "specific_variable": "user_data",
    "iteration_count": 0,
    "elapsed_time": 12.3
  }
}
```

### Ask Questions Response (Confidence 60-79%)

```json
{
  "statusCode": 200,
  "body": {
    "crash_id": "crash_20240220_142200_abc123",
    "action": "ask_questions",
    "confidence": 65.0,
    "root_cause": "Possible null reference in user_data",
    "explanation": "The variable user_data appears to be None, but more context is needed...",
    "questions": [
      "What is the expected format of the API response?",
      "Has the API endpoint changed recently?",
      "Are you using a local or remote API?"
    ],
    "partial_analysis": {
      "fix_suggestions": [],
      "specific_line": 42,
      "specific_variable": "user_data"
    },
    "iteration_count": 0,
    "elapsed_time": 11.8
  }
}
```

### Failure Report Response (Confidence <60%)

```json
{
  "statusCode": 200,
  "body": {
    "crash_id": "crash_20240220_142200_abc123",
    "action": "generate_report",
    "confidence": 45.0,
    "reason": "Confidence score 45.0% below threshold",
    "partial_analysis": {
      "root_cause": "Unable to determine exact cause",
      "explanation": "The crash appears related to data access but context is insufficient...",
      "fix_suggestions": [],
      "specific_line": null,
      "specific_variable": null
    },
    "iteration_count": 3,
    "elapsed_time": 28.5
  }
}
```

### Timeout Response

```json
{
  "statusCode": 504,
  "body": {
    "crash_id": "crash_20240220_142200_abc123",
    "error": "timeout",
    "message": "Analysis exceeded 30-second timeout",
    "action": "generate_report",
    "reason": "Analysis exceeded timeout limit"
  }
}
```

## Environment Variables

- `TRACE_BUCKET`: S3 bucket name for trace storage
- `CRASH_HISTORY_TABLE`: DynamoDB table for crash history
- `PROJECTS_TABLE`: DynamoDB table for project metadata
- `PATTERNS_TABLE`: DynamoDB table for learned patterns
- `AWS_REGION`: AWS region (default: us-east-1)
- `TIMEOUT_SECONDS`: Analysis timeout in seconds (default: 30)

## Dependencies

- boto3: AWS SDK for Python
- botocore: Low-level AWS SDK
- bedrock_analyzer.py: Bedrock Claude integration
- confidence_calculator.py: Confidence scoring logic
- decision_logic.py: Decision engine

## CloudWatch Metrics

The function logs the following metrics to CloudWatch:

- `AnalysisTime`: Time taken for analysis (seconds)
- `ConfidenceScore`: Confidence score (0-100%)
- `AnalysisCount`: Number of analyses by decision type

All metrics are tagged with:
- `ProjectId`: Project identifier
- `DecisionType`: auto_fix, ask_questions, or generate_report

## Error Handling

The function implements comprehensive error handling:

1. **Timeout Handling**: Returns 504 response if analysis exceeds 30 seconds
2. **S3 Failures**: Returns 500 error if trace cannot be loaded
3. **Bedrock Failures**: Returns analysis error with details
4. **DynamoDB Failures**: Continues without project memory context
5. **Metrics Failures**: Logs warning but doesn't fail request

## Performance

- **Target**: Return results within 30 seconds
- **Typical**: 10-15 seconds for analysis
- **Timeout**: Hard limit at 30 seconds

## Deployment

The function should be deployed with:
- Memory: 512 MB minimum
- Timeout: 35 seconds (5 seconds buffer)
- Runtime: Python 3.12
- IAM Role with permissions for:
  - S3 read access (TRACE_BUCKET)
  - DynamoDB read/write (CRASH_HISTORY_TABLE, PATTERNS_TABLE, PROJECTS_TABLE)
  - Bedrock invoke model
  - CloudWatch put metrics and logs

## Testing

See `test_lambdas.py` in the parent directory for unit tests.

## Integration

This function is triggered by the Sanitizer Lambda after sanitization is complete. It can also be invoked directly for iterative refinement with user answers.
