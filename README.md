# Smart Debugger

An AI-powered debugging assistant for Python that transforms debugging from a manual, time-consuming process into an automated, educational workflow. Smart Debugger captures execution traces, analyzes crashes with AI, and provides root cause explanations with confidence scores and fix suggestions.

## Features

- 🔍 **Automatic Crash Analysis**: AI-powered root cause identification using Amazon Bedrock Claude Sonnet
- 🎯 **Confidence Scoring**: Know how certain the AI is about its analysis (0-100%)
- 🔧 **Fix Suggestions**: Get specific code fixes with verification steps when confidence ≥80%
- 🕐 **Time-Travel Debugging**: Navigate backwards through execution history to see variable states
- 🧠 **Project Memory**: System learns from previous crashes to improve over time
- ⚡ **Smart Caching**: Hash-based caching skips repeat LLM calls for identical crashes (saves time & costs)
- 🔒 **Privacy-First**: 5-layer sanitization removes secrets before any LLM processing
- 📴 **Offline Mode**: Use local Ollama when cloud services are unavailable
- 📊 **Iterative Refinement**: AI asks targeted questions when uncertain (max 3 iterations)
- 📝 **Failure Reports**: Detailed reports when AI can't fix the issue

## Installation

### Prerequisites

- Python 3.12 or higher
- pip package manager

### Install Smart Debugger

```bash
# Install from source
cd ai_debugger
pip install -e .

# Or install with development dependencies
pip install -e ".[dev]"
```

### Verify Installation

```bash
smart-debug --version
```

## Quick Start

### 1. Configure API Key (Cloud Mode)

To use cloud-based AI analysis with Amazon Bedrock:

```bash
# Set up configuration directory
mkdir -p ~/.smart-debug

# Create config file
cat > ~/.smart-debug/config.json << EOF
{
  "api_key": "your-api-key-here",
  "aws_endpoint": "https://your-api-endpoint.com",
  "project_id": "my-project",
  "offline_mode": false
}
EOF
```

### 2. Or Set Up Offline Mode

To use local Ollama instead of cloud services:

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai/download
# Or run: curl https://ollama.ai/install.sh | sh

# Set up offline mode
smart-debug setup-offline
```

This will:
- Check if Ollama is installed
- Download required models (llama3.1:8b)
- Test offline analysis
- Configure Smart Debugger for offline mode

### 3. Run Your First Script

```bash
# Run a Python script with debugging enabled
smart-debug run your_script.py

# Or use offline mode
smart-debug run your_script.py --offline
```

When a crash occurs, Smart Debugger will:
1. Capture the execution trace
2. Sanitize sensitive data
3. Analyze the crash with AI
4. Display root cause and fix suggestions

## CLI Commands

### `smart-debug run <script.py>`

Run a Python script with debugging enabled. Automatically captures crashes and triggers AI analysis.

**Options:**
- `--offline`: Use local Ollama instead of AWS Bedrock

**Example:**
```bash
smart-debug run app.py
smart-debug run app.py --offline
```

**Output:**
```
Running app.py with Smart Debugger...

✗ Crash detected: AttributeError
  'NoneType' object has no attribute 'get'
  at line 42 in app.py

Analyzing crash...

=== Analysis Result ===
Confidence: 87%

Root Cause:
  Variable 'user_data' is None when accessing 'name' attribute

Explanation:
  The API response format changed. The 'user' field was moved from
  the top level to inside a 'data' object...

Fix Suggestion:
  Change line 42 from:
    user_data = response['user']
  To:
    user_data = response.get('data', {}).get('user')
```

### `smart-debug history`

View previous crash history with analysis results.

**Options:**
- `--limit <n>`: Number of crashes to show (default: 10)

**Example:**
```bash
smart-debug history
smart-debug history --limit 20
```

**Output:**
```
Showing last 5 crashes:

[1] crash_20240220_142200_abc123
    AttributeError at line 42 in app.py
    Confidence: 87% | Status: auto_fixed
    2024-02-20 14:22:00

[2] crash_20240220_103015_def456
    ZeroDivisionError at line 15 in calc.py
    Confidence: 92% | Status: auto_fixed
    2024-02-20 10:30:15
```

### `smart-debug replay <crash-id>`

Re-analyze a previous crash. Useful for getting updated analysis or trying cloud analysis after offline mode.

**Options:**
- `--offline`: Use local Ollama instead of AWS Bedrock

**Example:**
```bash
smart-debug replay crash_20240220_142200_abc123
smart-debug replay crash_20240220_142200_abc123 --offline
```

### `smart-debug navigate <crash-id>`

Interactive time-travel debugging. Navigate through execution history and inspect variable states.

**Example:**
```bash
smart-debug navigate crash_20240220_142200_abc123
```

**Navigation Commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `b [n]` | Step backward n steps (default 1) | `b`, `b 5` |
| `f [n]` | Step forward n steps (default 1) | `f`, `f 3` |
| `j <line>` | Jump to specific line number | `j 42` |
| `s <step>` | Jump to specific step number | `s 100` |
| `c` | Jump to crash point | `c` |
| `v [name]` | Show variable history or all variables | `v`, `v user_data` |
| `fn <name>` | Filter execution by function name | `fn process_data` |
| `var <name>` | Filter by variable changes | `var result` |
| `a` | Toggle showing all vs. changed variables | `a` |
| `h` | Show help | `h` |
| `q` | Quit navigation mode | `q` |

**Example Session:**
```
navigate> b 5
Step 1242/1247
Location: app.py:38 in process_data()
Time: 0.518s

Changed variables:
  data = [1, 2, 3, 4, 5]

navigate> v data
History of 'data':
  Step 10 (line 15, t=0.012s): []
  Step 234 (line 25, t=0.156s): [1, 2, 3]
  Step 1242 (line 38, t=0.518s): [1, 2, 3, 4, 5]

navigate> fn process_data
Steps in function 'process_data':
  Step 1200: line 35 (t=0.500s)
  Step 1210: line 36 (t=0.505s)
  Step 1242: line 38 (t=0.518s)
  ... and 15 more
```

### `smart-debug sync`

Sync offline analyses to cloud when connectivity is restored. Re-analyzes offline crashes with cloud AI for better results.

**Example:**
```bash
smart-debug sync
```

**Output:**
```
Checking cloud connectivity...
✓ Cloud service is reachable

Found 3 offline crash(es) to re-analyze with cloud AI

Re-analyze these crashes with cloud AI for better results? [y/N]: y

Syncing crashes  [####################################]  100%

✓ Successfully synced 3 crash(es)
```

### `smart-debug cache`

View or manage analysis cache statistics. The cache stores AI analysis results to skip repeat LLM calls for identical crashes.

**Options:**
- `--clear`: Clear the analysis cache
- `--project-id <id>`: Clear cache for specific project only

**Example:**
```bash
# View cache statistics
smart-debug cache

# Clear entire cache
smart-debug cache --clear

# Clear project-specific cache
smart-debug cache --clear --project-id my-project
```

**Output:**
```
=== Analysis Cache Statistics ===

Total Entries:     42
Total Cache Hits:  156
Average Age:       12.3 hours
Most Hit Entry:    a3f2e1b4c5d6... (8 hits)

Cache Location:    /home/user/.smart-debug/analysis_cache.db

✓ Saved ~114 LLM calls through caching!
```

### `smart-debug setup-offline`

Set up offline mode with local Ollama. Downloads required models and tests offline analysis.

**Example:**
```bash
smart-debug setup-offline
```

**Output:**
```
Setting up offline mode...

✓ Ollama is installed
  Version: ollama version 0.1.26

Checking Ollama service...
✓ Ollama service is running

Checking for required models...
✗ Model 'llama3.1:8b' not found

Downloading llama3.1:8b model (this may take a few minutes)...
Downloading  [####################################]  100%
✓ Model 'llama3.1:8b' downloaded successfully

Testing offline analysis...
✓ Offline analysis test passed
  Root cause identified: The variable 'b' is zero, causing a division...

✓ Offline mode configured successfully!

You can now use Smart Debugger without an API key.
Run: smart-debug run <script.py>

Note: Offline mode may provide lower confidence scores than cloud analysis.
```

## Configuration

Configuration is stored in `~/.smart-debug/config.json`:

```json
{
  "api_key": "your-api-key-here",
  "aws_endpoint": "https://api.smart-debug.example.com",
  "project_id": "my-project",
  "offline_mode": false,
  "log_level": "INFO"
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `api_key` | API key for AWS backend authentication | None |
| `aws_endpoint` | AWS API Gateway endpoint URL | None |
| `project_id` | Project identifier for memory system | None |
| `offline_mode` | Use local Ollama instead of cloud | `false` |
| `log_level` | Logging level (DEBUG, INFO, WARNING, ERROR) | `INFO` |

## Understanding Analysis Results

### Confidence Scores

Smart Debugger calculates confidence scores (0-100%) based on analysis quality:

- **≥80%**: High confidence - Auto-fix with specific code changes
- **60-79%**: Medium confidence - Ask targeted clarifying questions
- **<60%**: Low confidence - Generate detailed failure report

**Confidence Calculation:**
- Specific line/variable identification: +30%
- Clear causal explanation: +25%
- Similar pattern in project memory: +20%
- Actionable fix suggestion: +15%
- Uncertainty indicators ("might", "possibly"): -10% each

### Fix Suggestions

When confidence ≥80%, Smart Debugger provides:

1. **Unified Diff**: Before and after code with line numbers
2. **Explanation**: What the fix does and why it solves the root cause
3. **Verification Steps**: How to confirm the fix works
4. **Side Effects**: Potential impacts of the change
5. **Dependencies**: Installation commands for external packages (if needed)

**Example Fix:**
```diff
--- app.py (original)
+++ app.py (fixed)
@@ -40,7 +40,7 @@
 def fetch_user(response):
-    user_data = response['user']
+    user_data = response.get('data', {}).get('user')
     if user_data:
         return user_data['name']
```

### Iterative Refinement

When confidence is 60-79%, Smart Debugger asks targeted questions:

```
Confidence: 72%

I need more information to provide a confident fix:

Question 1: What is the expected format of the API response?
  a) {"user": {"name": "John"}}
  b) {"data": {"user": {"name": "John"}}}
  c) Other (please describe)

Your answer: b

Re-analyzing with your input...
```

Maximum 3 iterations. If confidence remains <80%, generates failure report.

### Failure Reports

When AI cannot fix the issue with sufficient confidence, Smart Debugger generates a detailed markdown report:

- Why the AI failed to determine root cause
- All known facts about the crash
- Priority files and line numbers for investigation
- Pre-crafted prompts for Claude or ChatGPT
- Sanitized execution trace attachment

Reports are saved to `~/.smart-debug/reports/`.

## Privacy and Security

### 5-Layer Sanitization

All traces are sanitized before any LLM processing:

1. **Layer 1**: API key detection (regex patterns)
2. **Layer 2**: Password and credential detection
3. **Layer 3**: PII detection (emails, phone numbers)
4. **Layer 4**: Context-aware sanitization (variable names, file paths)
5. **Layer 5**: AWS Bedrock Guardrails (cloud mode only)

Detected secrets are replaced with placeholders like `[REDACTED_API_KEY]`.

### Data Storage

- **Local**: Traces stored in `~/.smart-debug/traces.db` (SQLite)
- **Cloud**: Encrypted storage in S3 with 30-day TTL
- **Transmission**: TLS 1.3 encryption for all uploads

### Rate Limiting

- 100 requests per hour per API key
- Automatic fallback to offline mode when limit exceeded

## Troubleshooting

### Configuration Errors

**Problem**: `Configuration errors: API key not configured`

**Solution**:
```bash
# Set up configuration
mkdir -p ~/.smart-debug
echo '{"api_key": "your-key", "aws_endpoint": "https://..."}' > ~/.smart-debug/config.json

# Or use offline mode
smart-debug setup-offline
```

### Ollama Not Found

**Problem**: `✗ Ollama is not installed`

**Solution**:
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Or visit: https://ollama.ai/download
```

### Ollama Service Not Running

**Problem**: `✗ Ollama service is not running`

**Solution**:
```bash
# Start Ollama service
ollama serve

# Or start from applications menu
```

### Cloud Service Unavailable

**Problem**: Analysis fails with network errors

**Solution**:
```bash
# Use offline mode
smart-debug run script.py --offline

# Or configure offline mode permanently
smart-debug setup-offline
```

### Trace Not Found

**Problem**: `Trace {trace_id} not found`

**Solution**:
```bash
# Check crash history
smart-debug history

# Use correct crash ID from history
smart-debug replay crash_20240220_142200_abc123
```

### Low Confidence Scores

**Problem**: Consistently getting confidence <60%

**Possible Causes**:
- Using offline mode (lower accuracy than cloud)
- Complex or unusual crash patterns
- Insufficient execution context

**Solutions**:
- Use cloud mode for better analysis: `smart-debug sync`
- Provide more context when answering iterative questions
- Check failure reports for manual investigation guidance

### Memory Usage Issues

**Problem**: High memory usage during tracing

**Solution**:
- Tracer automatically limits memory to 500MB
- Traces truncated to 10,000 steps if exceeding 100MB
- Check diagnostic info if tracer errors occur

## Local Storage

### Database Location

`~/.smart-debug/traces.db` (SQLite)

### Database Schema

```sql
-- Execution traces
CREATE TABLE traces (
    id TEXT PRIMARY KEY,
    script_path TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    crash_line INTEGER,
    exception_type TEXT,
    trace_data BLOB,
    uploaded BOOLEAN DEFAULT FALSE
);

-- Crash history
CREATE TABLE crashes (
    id TEXT PRIMARY KEY,
    trace_id TEXT REFERENCES traces(id),
    analysis_result TEXT,
    confidence_score REAL,
    fixed BOOLEAN DEFAULT FALSE,
    created_at INTEGER NOT NULL
);
```

### Cleanup

```bash
# Remove old traces (manual cleanup)
rm ~/.smart-debug/traces.db

# Smart Debugger will create a new database on next run
```

## Testing

Run the test suite:

```bash
# Run all tests
pytest -v

# Run with coverage
pytest --cov=smart_debug --cov-report=html

# Run specific test file
pytest tests/test_cli.py -v

# Run property-based tests
pytest tests/ -k "property" -v
```

## Examples

See the `examples/` directory for usage examples:

- `time_travel_example.py`: Time-travel debugging demonstration
- `fix_suggester_example.py`: Fix suggestion generation
- `iterative_refinement_example.py`: Iterative refinement workflow
- `trace_upload_example.py`: Trace upload and compression

## Requirements

- Python 3.12 or higher
- Dependencies: Click, requests, boto3, hypothesis
- Dev dependencies: pytest, pytest-cov, moto

## License

MIT
