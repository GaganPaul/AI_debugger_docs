# Smart Debugger Architecture

This document provides a comprehensive overview of the Smart Debugger architecture, component interactions, and design decisions.

## Table of Contents

- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Key Design Decisions](#key-design-decisions)
- [Component Details](#component-details)
- [Integration Points](#integration-points)
- [Security Architecture](#security-architecture)
- [Performance Considerations](#performance-considerations)

## System Overview

Smart Debugger is an AI-powered debugging assistant that transforms debugging from a manual, time-consuming process into an automated, educational workflow. The system consists of a local Python CLI agent and an AWS serverless backend.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Machine                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Smart Debug CLI (Local Agent)              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │  Tracer  │  │ Storage  │  │  Config  │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │TimeTravel│  │Formatter │  │ Uploader │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           │ HTTPS (TLS 1.3)                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   API Gateway                           │ │
│  │  - API Key Authentication                               │ │
│  │  - Rate Limiting (100/hour)                             │ │
│  │  - Request Validation                                   │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│         ┌───────────────┼───────────────┐                   │
│         ▼               ▼               ▼                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  Crash   │    │Sanitizer │    │    AI    │             │
│  │Ingestion │───▶│  Lambda  │───▶│ Analyzer │             │
│  │  Lambda  │    │          │    │  Lambda  │             │
│  └──────────┘    └──────────┘    └────┬─────┘             │
│       │               │                │                    │
│       ▼               ▼                ▼                    │
│  ┌──────────────────────────────────────────┐              │
│  │              S3 Bucket                    │              │
│  │  - Raw Traces                             │              │
│  │  - Sanitized Traces                       │              │
│  │  - Failure Reports                        │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   DynamoDB   │    │   Bedrock    │    │  CloudWatch  │ │
│  │   Tables     │    │   Claude     │    │   Logs       │ │
│  │  - Crashes   │    │   Sonnet     │    │  - Metrics   │ │
│  │  - Patterns  │    │              │    │  - Alarms    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Privacy-First**: Multi-layer sanitization before any LLM processing
2. **Graceful Degradation**: Offline mode when cloud unavailable
3. **Educational**: Teach debugging methodology, not just provide fixes
4. **Incremental Learning**: Project memory improves over time
5. **Beginner-Friendly**: Simple CLI, no jargon in output
6. **Fail-Safe**: Never crash user's program due to debugger errors

## Component Architecture

### Local Agent Components

#### 1. CLI Interface (`cli.py`)
**Responsibility**: User interaction and command orchestration

**Key Functions**:
- `run`: Execute Python scripts with tracing
- `history`: View crash history
- `replay`: Re-analyze previous crashes
- `navigate`: Time-travel debugging
- `sync`: Sync offline analyses to cloud
- `setup-offline`: Configure offline mode

**Dependencies**:
- Click framework for CLI
- All other local components

#### 2. Execution Tracer (`tracer.py`)
**Responsibility**: Capture execution traces using sys.monitoring API

**Key Classes**:
- `ExecutionTracer`: Main tracing engine
- `ExecutionTrace`: Trace data structure
- `ExecutionStep`: Individual execution step

**Features**:
- Line-level execution tracking
- Variable state capture
- Exception detection
- Memory management (500MB limit)
- Error resilience (never crashes user program)

**Implementation**:
```python
class ExecutionTracer:
    def start_tracing(self) -> None:
        """Start monitoring execution using sys.monitoring."""
        sys.monitoring.use_tool_id(self.TOOL_ID, "smart_debugger")
        sys.monitoring.register_callback(
            self.TOOL_ID,
            sys.monitoring.events.PY_START,
            self._on_line_event
        )
        sys.monitoring.register_callback(
            self.TOOL_ID,
            sys.monitoring.events.PY_THROW,
            self._on_exception_event
        )
```

#### 3. Differential Recorder (`differential_recorder.py`)
**Responsibility**: Efficient trace storage by recording only changes

**Key Features**:
- Records only variable changes, not full snapshots
- 80% storage reduction vs. full snapshots
- Trace size management (100MB limit, 10,000 steps)
- Efficient serialization of Python objects

**Algorithm**:
```python
def record_change(var_name, old_value, new_value, line):
    if old_value != new_value:
        # Only record if value changed
        changes.append({
            'var': var_name,
            'value': new_value,
            'line': line,
            'timestamp': time.time()
        })
```

#### 4. Crash Detector (`crash_detector.py`)
**Responsibility**: Detect crashes and trigger trace save

**Key Features**:
- Unhandled exception detection
- Immediate trace persistence
- Crash metadata extraction
- Error context capture

#### 5. Local Storage (`storage.py`)
**Responsibility**: SQLite database management

**Schema**:
```sql
CREATE TABLE traces (
    id TEXT PRIMARY KEY,
    script_path TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    crash_line INTEGER,
    exception_type TEXT,
    trace_data BLOB,
    uploaded BOOLEAN DEFAULT FALSE
);

CREATE TABLE crashes (
    id TEXT PRIMARY KEY,
    trace_id TEXT REFERENCES traces(id),
    analysis_result TEXT,
    confidence_score REAL,
    fixed BOOLEAN DEFAULT FALSE,
    created_at INTEGER NOT NULL,
    offline_analysis BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE
);
```

#### 6. Sanitizer (`sanitizer.py`)
**Responsibility**: 5-layer sanitization pipeline

**Layers**:
1. **API Key Detection**: Regex patterns for common API key formats
2. **Password Detection**: Credential and password patterns
3. **PII Detection**: Emails, phone numbers, addresses
4. **Context-Aware**: Variable names, file paths, comments
5. **Bedrock Guardrails**: AWS Bedrock final validation (cloud only)

**Implementation**:
```python
class Sanitizer:
    def sanitize(self, trace_data: Dict) -> Dict:
        # Layer 1: API keys
        trace_data = self._sanitize_api_keys(trace_data)
        # Layer 2: Passwords
        trace_data = self._sanitize_passwords(trace_data)
        # Layer 3: PII
        trace_data = self._sanitize_pii(trace_data)
        # Layer 4: Context-aware
        trace_data = self._sanitize_context(trace_data)
        # Layer 5: Bedrock Guardrails (if cloud mode)
        if not offline:
            trace_data = self._bedrock_guardrails(trace_data)
        return trace_data
```

#### 7. Time-Travel Navigator (`time_travel.py`)
**Responsibility**: Interactive execution history navigation

**Key Features**:
- Backward/forward navigation
- Jump to specific lines or steps
- Variable history tracking
- Function/variable filtering
- Crash point identification

#### 8. Trace Uploader (`trace_uploader.py`)
**Responsibility**: Compress and upload traces to AWS

**Key Features**:
- Compression before upload (gzip)
- Streaming uploads for large traces (>10MB)
- Retry logic with exponential backoff
- Progress tracking
- Authentication with API keys

### AWS Backend Components

#### 1. Crash Ingestion Lambda
**Responsibility**: Receive and validate trace uploads

**Workflow**:
1. Validate API key with Secrets Manager
2. Check rate limiting (100/hour per key)
3. Store raw trace in S3
4. Invoke Sanitizer Lambda
5. Return crash ID to client

**Configuration**:
- Runtime: Python 3.12
- Memory: 512 MB
- Timeout: 30 seconds

#### 2. Sanitizer Lambda
**Responsibility**: Apply 5-layer sanitization

**Workflow**:
1. Load raw trace from S3
2. Apply layers 1-4 (regex-based)
3. Apply layer 5 (Bedrock Guardrails)
4. Store sanitized trace in S3
5. Invoke AI Analyzer Lambda

**Configuration**:
- Runtime: Python 3.12
- Memory: 512 MB
- Timeout: 60 seconds

#### 3. AI Analyzer Lambda
**Responsibility**: AI-powered root cause analysis

**Workflow**:
1. Load sanitized trace from S3
2. Load project memory from DynamoDB
3. Build analysis context
4. Call Bedrock Claude Sonnet
5. Calculate confidence score
6. Execute decision logic:
   - ≥80%: Generate fix suggestions
   - 60-79%: Ask clarifying questions
   - <60%: Generate failure report
7. Store results in DynamoDB
8. Return analysis to client

**Configuration**:
- Runtime: Python 3.12
- Memory: 1024 MB
- Timeout: 60 seconds

**Confidence Scoring Algorithm**:
```python
def calculate_confidence(analysis, trace, context):
    score = 0.0
    
    # Specific line/variable (+30%)
    if has_specific_location(analysis):
        score += 30
    
    # Clear causal explanation (+25%)
    if has_causal_explanation(analysis):
        score += 25
    
    # Similar pattern in memory (+20%)
    if matches_known_pattern(analysis, context):
        score += 20
    
    # Actionable fix (+15%)
    if has_actionable_fix(analysis):
        score += 15
    
    # Uncertainty indicators (-10% each)
    uncertainty_count = count_uncertainty_words(analysis)
    score -= (uncertainty_count * 10)
    
    return min(100, max(0, score))
```

#### 4. Project Memory Lambda
**Responsibility**: Manage learned patterns and context

**Workflow**:
1. Extract patterns from successful analyses
2. Store crash signatures and fixes
3. Track question history
4. Provide context for new analyses
5. Enforce storage limits (1,000 crashes per project)

**Data Models**:
```python
# Pattern
{
    'project_id': 'web-app-2024',
    'pattern_id': 'null-pointer-api-response',
    'pattern_type': 'null_reference',
    'description': 'API response format changed',
    'frequency': 12,
    'confidence_boost': 0.15,
    'solution_template': 'Check API response structure'
}

# Crash History
{
    'crash_id': 'crash_20240220_142200_abc123',
    'project_id': 'web-app-2024',
    'timestamp': 1708441320,
    'analysis_result': {...},
    'resolution_status': 'auto_fixed',
    'ttl': 1711033320  # 30 days
}
```

#### 5. Failure Report Lambda
**Responsibility**: Generate detailed reports for low-confidence cases

**Workflow**:
1. Load crash data and analysis attempts
2. Generate markdown report with:
   - Why AI failed
   - Known facts about crash
   - Priority files for investigation
   - Pre-crafted prompts for Claude/ChatGPT
3. Store report in S3
4. Return report to client

## Data Flow

### Crash Analysis Flow

```
1. User runs script with Smart Debugger
   ↓
2. Tracer captures execution
   ↓
3. Crash detected → Save trace locally
   ↓
4. Sanitize trace (layers 1-4)
   ↓
5. Upload to AWS (if online)
   ↓
6. API Gateway → Crash Ingestion Lambda
   ↓
7. Store raw trace in S3
   ↓
8. Sanitizer Lambda (layer 5)
   ↓
9. Store sanitized trace in S3
   ↓
10. AI Analyzer Lambda
    ├─ Load project memory
    ├─ Call Bedrock Claude
    ├─ Calculate confidence
    └─ Execute decision logic
   ↓
11. Store results in DynamoDB
   ↓
12. Return analysis to CLI
   ↓
13. Display results to user
```

### Offline Mode Flow

```
1. User runs script with --offline flag
   ↓
2. Tracer captures execution
   ↓
3. Crash detected → Save trace locally
   ↓
4. Sanitize trace (layers 1-4 only)
   ↓
5. Analyze with local Ollama
   ↓
6. Calculate confidence (may be lower)
   ↓
7. Display results to user
   ↓
8. Mark as offline analysis
   ↓
9. Later: User runs 'sync' command
   ↓
10. Re-analyze with cloud AI
   ↓
11. Update results with higher confidence
```

### Time-Travel Debugging Flow

```
1. User runs 'navigate <crash-id>'
   ↓
2. Load trace from local storage
   ↓
3. Initialize TimeTravel navigator
   ↓
4. Display execution summary
   ↓
5. Jump to crash point
   ↓
6. Enter interactive mode
   ↓
7. User navigates with commands:
   - b/f: Step backward/forward
   - j: Jump to line
   - v: Show variable history
   - fn: Filter by function
   ↓
8. Display state at each step
   ↓
9. User quits navigation
```

## Key Design Decisions

### 1. sys.monitoring API (Python 3.12+)

**Decision**: Use sys.monitoring instead of sys.settrace

**Rationale**:
- Lower overhead (<20% vs. 50-100%)
- More reliable event delivery
- Better performance for production use
- Official Python 3.12+ API

**Trade-off**: Requires Python 3.12+, limiting compatibility

### 2. Differential Recording

**Decision**: Record only variable changes, not full snapshots

**Rationale**:
- 80% storage reduction
- Faster trace capture
- Lower memory usage
- Sufficient for debugging needs

**Trade-off**: Slightly more complex reconstruction logic

### 3. 5-Layer Sanitization

**Decision**: Multiple sanitization layers before LLM

**Rationale**:
- Defense in depth
- Catch different secret patterns
- Context-aware redaction
- Final validation with Bedrock Guardrails

**Trade-off**: May remove too much context in some cases

### 4. Confidence Scoring

**Decision**: Calculate confidence scores for all analyses

**Rationale**:
- Users know when to trust AI
- Enables decision logic (auto-fix vs. questions)
- Improves over time with project memory
- Transparent about uncertainty

**Trade-off**: Requires careful calibration

### 5. Offline Mode with Ollama

**Decision**: Support local AI analysis with Ollama

**Rationale**:
- Works without internet
- Privacy for sensitive code
- No API costs
- Graceful degradation

**Trade-off**: Lower accuracy than cloud AI

### 6. Serverless Architecture

**Decision**: Use AWS Lambda instead of EC2

**Rationale**:
- Auto-scaling
- Pay-per-use pricing
- No server management
- Built-in high availability

**Trade-off**: Cold start latency, 60s timeout limit

### 7. DynamoDB for Project Memory

**Decision**: Use DynamoDB instead of RDS

**Rationale**:
- Serverless (no provisioning)
- Auto-scaling
- Built-in TTL for cleanup
- Fast key-value access

**Trade-off**: Limited query capabilities

## Component Interactions

### Tracer ↔ Storage

```python
# Tracer saves trace to storage
trace = tracer.stop_tracing()
storage.save_trace(
    trace_id=trace_id,
    script_path=script_path,
    crash_line=crash_line,
    exception_type=exception_type,
    trace_data=trace.to_dict()
)

# Storage retrieves trace for analysis
trace_data = storage.get_trace(trace_id)
```

### CLI ↔ Uploader ↔ AWS

```python
# CLI triggers upload
uploader = TraceUploader(config)
crash_id = uploader.upload_trace(
    trace=trace,
    project_id=config.project_id
)

# Uploader compresses and sends to API Gateway
compressed = gzip.compress(json.dumps(trace).encode())
response = requests.post(
    f"{config.aws_endpoint}/crashes",
    headers={"X-Api-Key": config.api_key},
    data=compressed
)
```

### AI Analyzer ↔ Bedrock

```python
# AI Analyzer calls Bedrock
bedrock = boto3.client('bedrock-runtime')
response = bedrock.invoke_model(
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    body=json.dumps({
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': 4096,
        'messages': [{
            'role': 'user',
            'content': prompt
        }]
    })
)

# Parse response
result = json.loads(response['body'].read())
analysis = result['content'][0]['text']
```

### Project Memory ↔ DynamoDB

```python
# Store pattern
dynamodb.put_item(
    TableName='ProjectMemoryTable',
    Item={
        'project_id': {'S': project_id},
        'pattern_id': {'S': pattern_id},
        'pattern_type': {'S': 'null_reference'},
        'frequency': {'N': '12'},
        'confidence_boost': {'N': '0.15'}
    }
)

# Query patterns
response = dynamodb.query(
    TableName='ProjectMemoryTable',
    KeyConditionExpression='project_id = :pid',
    ExpressionAttributeValues={
        ':pid': {'S': project_id}
    }
)
patterns = response['Items']
```

## Security Architecture

### Authentication Flow

```
1. User configures API key in local config
   ↓
2. CLI includes key in X-Api-Key header
   ↓
3. API Gateway validates key
   ↓
4. Crash Ingestion Lambda verifies with Secrets Manager
   ↓
5. If valid: Process request
   If invalid: Return 401 Unauthorized
```

### Encryption

- **In Transit**: TLS 1.3 for all API calls
- **At Rest**: 
  - S3: AES256 server-side encryption
  - DynamoDB: Encryption at rest enabled
  - Local: SQLite database (no encryption by default)

### Rate Limiting

- 100 requests per hour per API key
- Enforced at API Gateway level
- Prevents abuse and controls costs

### Sanitization

- 5 layers of sanitization before LLM
- Regex patterns for common secrets
- Context-aware redaction
- Bedrock Guardrails as final check
- Sanitization failure = refuse to send to LLM

## Performance Considerations

### Tracer Performance

- **Target**: <20% execution time overhead
- **Optimization**: Differential recording
- **Memory Limit**: 500MB maximum
- **Trace Limit**: 10,000 steps or 100MB

### Analysis Performance

- **Target**: <30 seconds for analysis
- **Timeout**: 60 seconds Lambda timeout
- **Optimization**: 
  - Parallel Lambda invocations
  - Efficient DynamoDB queries
  - Compressed trace uploads

### Scalability

- **Lambda Concurrency**: 100 concurrent executions
- **API Gateway**: Unlimited requests (rate limited per key)
- **DynamoDB**: On-demand scaling
- **S3**: Unlimited storage

### Cost Optimization

- **Lambda**: Right-sized memory allocation
- **DynamoDB**: On-demand billing (no provisioned capacity)
- **S3**: Lifecycle rules (30-day deletion)
- **Bedrock**: Efficient prompts to minimize tokens

## Future Enhancements

### Planned Features

1. **Multi-Language Support**: Extend beyond Python
2. **IDE Integration**: VS Code extension
3. **Team Collaboration**: Shared project memory
4. **Custom Models**: Fine-tuned models per project
5. **Real-Time Analysis**: Analyze during execution
6. **Distributed Tracing**: Multi-service debugging

### Scalability Improvements

1. **Caching**: Cache common patterns
2. **Batch Processing**: Batch similar crashes
3. **Edge Deployment**: CloudFront for global access
4. **Model Optimization**: Smaller, faster models

### Security Enhancements

1. **Zero-Knowledge**: Client-side encryption
2. **Audit Logs**: Comprehensive audit trail
3. **RBAC**: Role-based access control
4. **Compliance**: SOC 2, GDPR compliance
