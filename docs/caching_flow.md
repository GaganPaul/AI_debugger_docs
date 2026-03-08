# Smart Debugger Caching Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Application                          │
│                     (crashes with error)                         │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Execution Tracer                            │
│              (captures trace + stack trace)                      │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AI Analyzer Pipeline                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Step 0: Compute Cache Key                              │    │
│  │                                                         │    │
│  │  Input:                                                 │    │
│  │    • Exception type: ValueError                         │    │
│  │    • Exception message: "invalid literal..."            │    │
│  │    • Crash location: example.py:42                      │    │
│  │    • Stack trace: "Traceback..."                        │    │
│  │    • Execution path: [(40, main), (42, main)]           │    │
│  │                                                         │    │
│  │  Output:                                                │    │
│  │    • SHA256 hash: c158954d76b4bb9b...                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                             ↓                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Step 1: Check Cache (SQLite)                           │    │
│  │                                                         │    │
│  │  SELECT * FROM analysis_cache                           │    │
│  │  WHERE cache_key = 'c158954d76b4bb9b...'                │    │
│  └────────────────────────────────────────────────────────┘    │
│                             ↓                                   │
│              ┌──────────────┴──────────────┐                   │
│              ↓                              ↓                   │
│  ┌─────────────────────┐        ┌─────────────────────┐        │
│  │   CACHE HIT ✓       │        │   CACHE MISS ✗      │        │
│  │                     │        │                     │        │
│  │ • Found entry       │        │ • No entry found    │        │
│  │ • Check TTL         │        │ • Proceed to LLM    │        │
│  │ • Increment hits    │        │                     │        │
│  └─────────────────────┘        └─────────────────────┘        │
│              ↓                              ↓                   │
│  ┌─────────────────────┐        ┌─────────────────────┐        │
│  │ Return Cached       │        │ Step 2: Call LLM    │        │
│  │ Analysis            │        │                     │        │
│  │                     │        │ • Bedrock Claude    │        │
│  │ Time: ~0.01s        │        │ • or Ollama         │        │
│  │ Cost: $0            │        │                     │        │
│  └─────────────────────┘        │ Time: ~2.5s         │        │
│              ↓                  │ Cost: ~$0.003       │        │
│  ┌─────────────────────┐        └─────────────────────┘        │
│  │ Add cache_info      │                    ↓                   │
│  │ to response         │        ┌─────────────────────┐        │
│  └─────────────────────┘        │ Step 3: Cache       │        │
│                                 │ Result              │        │
│                                 │                     │        │
│                                 │ INSERT INTO         │        │
│                                 │ analysis_cache...   │        │
│                                 └─────────────────────┘        │
│                                             ↓                   │
│                                 ┌─────────────────────┐        │
│                                 │ Return Analysis     │        │
│                                 └─────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Display to User                             │
│                                                                  │
│  • Root cause                                                    │
│  • Explanation                                                   │
│  • Fix suggestions                                               │
│  • Confidence score                                              │
│  • [Cached] indicator (if cache hit)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Key Computation Details

```
┌─────────────────────────────────────────────────────────────────┐
│                    Input Components                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Exception Info:                                                 │
│    ├─ exception_type: "ValueError"                               │
│    ├─ exception_message: "invalid literal for int()"             │
│    ├─ crash_file: "example.py"                                   │
│    └─ crash_line: 42                                             │
│                                                                  │
│  Stack Trace:                                                    │
│    └─ "Traceback (most recent call last):\n..."                  │
│                                                                  │
│  Execution Path (last 10 steps):                                 │
│    ├─ Step 1: {line: 40, func: "main"}                           │
│    ├─ Step 2: {line: 41, func: "main"}                           │
│    └─ Step 3: {line: 42, func: "main"}                           │
│                                                                  │
│  Project ID (optional):                                          │
│    └─ "my-project"                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    JSON Serialization                            │
│                                                                  │
│  {                                                               │
│    "exception_type": "ValueError",                               │
│    "exception_message": "invalid literal for int()",             │
│    "crash_file": "example.py",                                   │
│    "crash_line": 42,                                             │
│    "stack_trace": "Traceback...",                                │
│    "execution_path": [                                           │
│      {"line": 40, "func": "main"},                               │
│      {"line": 42, "func": "main"}                                │
│    ],                                                            │
│    "project_id": "my-project"                                    │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SHA256 Hashing                              │
│                                                                  │
│  hashlib.sha256(json_string.encode('utf-8')).hexdigest()         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Cache Key (64 chars)                        │
│                                                                  │
│  c158954d76b4bb9b9029a3159081a6a59c9bd5eea41e751faf312063b9aad07f │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Hit vs Miss Comparison

### Scenario 1: Cache Miss (First Occurrence)

```
Time: 0ms
┌─────────────────┐
│ Crash Detected  │
└────────┬────────┘
         ↓
Time: 5ms
┌─────────────────┐
│ Compute Hash    │
│ c158954d...     │
└────────┬────────┘
         ↓
Time: 10ms
┌─────────────────┐
│ Check Cache     │
│ ✗ Not Found     │
└────────┬────────┘
         ↓
Time: 15ms
┌─────────────────┐
│ Call Bedrock    │
│ Claude API      │
└────────┬────────┘
         ↓
Time: 2500ms (2.5s)
┌─────────────────┐
│ Receive         │
│ Analysis        │
└────────┬────────┘
         ↓
Time: 2510ms
┌─────────────────┐
│ Store in Cache  │
└────────┬────────┘
         ↓
Time: 2520ms
┌─────────────────┐
│ Return Result   │
└─────────────────┘

Total: ~2.5 seconds
Cost: $0.003
```

### Scenario 2: Cache Hit (Subsequent Occurrence)

```
Time: 0ms
┌─────────────────┐
│ Crash Detected  │
└────────┬────────┘
         ↓
Time: 5ms
┌─────────────────┐
│ Compute Hash    │
│ c158954d...     │
└────────┬────────┘
         ↓
Time: 10ms
┌─────────────────┐
│ Check Cache     │
│ ✓ Found!        │
└────────┬────────┘
         ↓
Time: 15ms
┌─────────────────┐
│ Return Cached   │
│ Result          │
└─────────────────┘

Total: ~0.015 seconds
Cost: $0

Speedup: 167x faster!
Savings: 100% cost reduction
```

## Cache Database Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    analysis_cache.db (SQLite)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Table: analysis_cache                                           │
│  ┌────────────────────┬──────────────────────────────────────┐  │
│  │ cache_key (PK)     │ c158954d76b4bb9b9029a3159081a6a5... │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ root_cause         │ "Invalid input to int() conversion" │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ explanation        │ "The user input 'abc' cannot be..." │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ fix_suggestions    │ ["Add input validation", "Use..."]  │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ specific_line      │ 42                                   │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ specific_variable  │ "user_input"                         │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ timestamp          │ 1709654321.123                       │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ hit_count          │ 5                                    │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ project_id         │ "my-project"                         │  │
│  ├────────────────────┼──────────────────────────────────────┤  │
│  │ success            │ 1                                    │  │
│  └────────────────────┴──────────────────────────────────────┘  │
│                                                                  │
│  Indexes:                                                        │
│    • idx_timestamp (for TTL cleanup)                             │
│    • idx_project_id (for project-specific queries)               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cache Entry Lifecycle                       │
└─────────────────────────────────────────────────────────────────┘

Day 0: Entry Created
├─ Cache miss occurs
├─ LLM analysis performed
├─ Result stored with timestamp
└─ hit_count = 1

Day 1-29: Active Usage
├─ Cache hits increment hit_count
├─ Entry remains valid (within TTL)
└─ Provides instant results

Day 30: TTL Expiration
├─ Entry age exceeds TTL (30 days)
├─ Next cache lookup detects expiration
├─ Entry automatically deleted
└─ Next occurrence triggers new LLM call

Cleanup Events:
├─ Automatic: On expired entry access
├─ Manual: `smart-debug cache --clear`
└─ Size limit: When cache exceeds 1000 entries
```

## Performance Metrics

```
┌─────────────────────────────────────────────────────────────────┐
│                    Performance Comparison                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Scenario: 100 crashes, 50% are duplicates                      │
│                                                                  │
│  WITHOUT CACHING:                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Crash 1-100: All call LLM                               │   │
│  │ Time: 100 × 2.5s = 250 seconds                          │   │
│  │ Cost: 100 × $0.003 = $0.30                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  WITH CACHING:                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Crash 1-50: Call LLM (cache miss)                       │   │
│  │   Time: 50 × 2.5s = 125s                                │   │
│  │   Cost: 50 × $0.003 = $0.15                             │   │
│  │                                                          │   │
│  │ Crash 51-100: Use cache (cache hit)                     │   │
│  │   Time: 50 × 0.01s = 0.5s                               │   │
│  │   Cost: 50 × $0 = $0                                    │   │
│  │                                                          │   │
│  │ Total Time: 125.5 seconds                               │   │
│  │ Total Cost: $0.15                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  SAVINGS:                                                        │
│  ├─ Time: 124.5s saved (50% faster)                              │
│  └─ Cost: $0.15 saved (50% reduction)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## CLI Usage Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Command: smart-debug cache                │
└─────────────────────────────────────────────────────────────────┘

$ smart-debug cache
         ↓
┌─────────────────────┐
│ Load AnalysisCache  │
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Query SQLite DB     │
│ for statistics      │
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Calculate metrics:  │
│ • Total entries     │
│ • Total hits        │
│ • Average age       │
│ • Most hit entry    │
│ • LLM calls saved   │
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│ Display formatted   │
│ statistics          │
└─────────────────────┘

Output:
═══ Analysis Cache Statistics ═══

Total Entries:     42
Total Cache Hits:  156
Average Age:       12.3 hours
Most Hit Entry:    a3f2e1b4... (8 hits)

✓ Saved ~114 LLM calls through caching!
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                    System Integration                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ExecutionTracer                                              │
│     └─> Captures crash data                                      │
│         └─> Passes to AI Analyzer Pipeline                       │
│                                                                  │
│  2. AI Analyzer Pipeline                                         │
│     ├─> Computes cache key                                       │
│     ├─> Checks AnalysisCache                                     │
│     ├─> Calls Bedrock/Ollama (if miss)                           │
│     └─> Stores result (if miss)                                  │
│                                                                  │
│  3. AnalysisCache                                                │
│     ├─> Manages SQLite database                                  │
│     ├─> Handles TTL expiration                                   │
│     ├─> Tracks hit counts                                        │
│     └─> Provides statistics API                                  │
│                                                                  │
│  4. CLI                                                          │
│     ├─> `smart-debug cache` (view stats)                         │
│     └─> `smart-debug cache --clear` (clear cache)                │
│                                                                  │
│  5. Configuration                                                │
│     ├─> enable_cache (default: True)                             │
│     └─> cache_ttl_seconds (default: 30 days)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
