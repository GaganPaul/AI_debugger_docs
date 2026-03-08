# Analysis Caching System

## Overview

Smart Debugger implements intelligent hash-based caching to skip repeat LLM calls for identical crashes. This feature:

- **Saves API costs** by avoiding redundant LLM calls
- **Improves response time** for previously seen crashes
- **Maintains accuracy** through content-based hashing
- **Respects privacy** by storing only sanitized data

## How It Works

### 1. Content-Based Hashing

When a crash occurs, the system computes a SHA256 hash from:
- Exception type and message
- Crash location (file + line number)
- Stack trace
- Recent execution path (last 10 steps)
- Project ID (optional, for project-specific caching)

**Important**: Variable values are NOT included in the hash, only the execution path. This means crashes with the same root cause but different data values will share the same cache entry.

### 2. Cache Storage

Cache entries are stored in a local SQLite database at `~/.smart-debug/analysis_cache.db` with:
- Analysis results (root cause, explanation, fix suggestions)
- Timestamp for TTL management
- Hit count for statistics
- Project ID for scoping

### 3. Cache Lookup Flow

```
Crash Detected
     ↓
Compute Hash Key
     ↓
Check Cache
     ↓
  ┌─────┴─────┐
  │           │
Cache Hit   Cache Miss
  │           │
  │      Call LLM API
  │           │
  │      Store Result
  │           │
  └─────┬─────┘
        ↓
Return Analysis
```

## Usage

### Automatic Caching

Caching is enabled by default. No configuration needed!

```python
from smart_debug.ai_analyzer_pipeline import AIAnalyzerPipeline

# Cache is automatically enabled
pipeline = AIAnalyzerPipeline()

# First call: Cache miss, calls LLM
result1 = pipeline.analyze(trace_data, stack_trace)

# Second call with identical crash: Cache hit, skips LLM!
result2 = pipeline.analyze(trace_data, stack_trace)
```

### Disable Caching

```python
# Disable cache if needed
pipeline = AIAnalyzerPipeline(enable_cache=False)
```

### Custom Cache TTL

```python
# Set custom TTL (default: 30 days)
pipeline = AIAnalyzerPipeline(
    enable_cache=True,
    cache_ttl_seconds=7 * 24 * 60 * 60  # 7 days
)
```

### Project-Specific Caching

```python
# Cache entries scoped by project
result = pipeline.analyze(
    trace_data,
    stack_trace,
    project_id="my-project"
)
```

## CLI Commands

### View Cache Statistics

```bash
smart-debug cache
```

Output:
```
=== Analysis Cache Statistics ===

Total Entries:     42
Total Cache Hits:  156
Average Age:       12.3 hours
Most Hit Entry:    a3f2e1b4c5d6... (8 hits)

Cache Location:    /home/user/.smart-debug/analysis_cache.db

✓ Saved ~114 LLM calls through caching!
```

### Clear Cache

```bash
# Clear entire cache
smart-debug cache --clear

# Clear cache for specific project
smart-debug cache --clear --project-id my-project
```

## Cache Management

### Automatic Cleanup

The cache automatically:
- **Expires entries** after TTL (default: 30 days)
- **Limits size** to 1000 entries (removes oldest when exceeded)
- **Tracks hits** for statistics

### Manual Cleanup

```python
from smart_debug.analysis_cache import AnalysisCache

cache = AnalysisCache()

# Remove expired entries
deleted = cache.cleanup_expired()
print(f"Removed {deleted} expired entries")

# Clear all entries
deleted = cache.clear()
print(f"Removed {deleted} entries")

# Clear project-specific entries
deleted = cache.clear(project_id="my-project")
print(f"Removed {deleted} entries for project")
```

## Performance Benefits

### Example Scenario

Without caching:
```
Crash 1: 2.5s (LLM call)
Crash 2 (identical): 2.5s (LLM call)
Crash 3 (identical): 2.5s (LLM call)
Total: 7.5s
```

With caching:
```
Crash 1: 2.5s (LLM call, cache miss)
Crash 2 (identical): 0.05s (cache hit!)
Crash 3 (identical): 0.05s (cache hit!)
Total: 2.6s (65% faster!)
```

### Cost Savings

Assuming $0.003 per LLM call:
- 100 crashes with 50% cache hit rate
- Without cache: 100 calls × $0.003 = $0.30
- With cache: 50 calls × $0.003 = $0.15
- **Savings: 50%**

## Cache Statistics API

### Get Statistics

```python
from smart_debug.ai_analyzer_pipeline import AIAnalyzerPipeline

pipeline = AIAnalyzerPipeline()
stats = pipeline.get_cache_stats()

print(f"Total entries: {stats['total_entries']}")
print(f"Total hits: {stats['total_hits']}")
print(f"Average age: {stats['avg_age_seconds']}s")
```

### Clear Cache Programmatically

```python
# Clear all
deleted = pipeline.clear_cache()

# Clear project-specific
deleted = pipeline.clear_cache(project_id="my-project")
```

## Implementation Details

### Hash Computation

```python
def compute_cache_key(trace_data, stack_trace, project_id=None):
    """Compute SHA256 hash from crash components."""
    hash_components = {
        'exception_type': exception_info['exception_type'],
        'exception_message': exception_info['message'],
        'crash_file': exception_info['filename'],
        'crash_line': exception_info['line_number'],
        'stack_trace': stack_trace.strip(),
        'execution_path': simplified_steps,  # Line numbers + function names
        'project_id': project_id or ''
    }
    
    hash_input = json.dumps(hash_components, sort_keys=True)
    return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
```

### Database Schema

```sql
CREATE TABLE analysis_cache (
    cache_key TEXT PRIMARY KEY,
    root_cause TEXT NOT NULL,
    explanation TEXT NOT NULL,
    fix_suggestions TEXT NOT NULL,
    specific_line INTEGER,
    specific_variable TEXT,
    raw_response TEXT,
    timestamp REAL NOT NULL,
    hit_count INTEGER DEFAULT 1,
    project_id TEXT,
    success INTEGER DEFAULT 1,
    error_message TEXT
);

CREATE INDEX idx_timestamp ON analysis_cache(timestamp);
CREATE INDEX idx_project_id ON analysis_cache(project_id);
```

## Best Practices

### 1. Use Project IDs

For multi-project setups, use project IDs to scope cache entries:

```python
result = pipeline.analyze(
    trace_data,
    stack_trace,
    project_id="project-alpha"
)
```

### 2. Monitor Cache Hit Rate

Regularly check cache statistics to understand effectiveness:

```bash
smart-debug cache
```

Aim for >30% hit rate for optimal benefit.

### 3. Adjust TTL Based on Usage

- **Active development**: Shorter TTL (7 days)
- **Production monitoring**: Longer TTL (30 days)
- **Testing**: Disable cache or very short TTL

### 4. Clear Cache After Major Changes

Clear cache when:
- Updating code significantly
- Changing error handling logic
- Refactoring exception types

```bash
smart-debug cache --clear --project-id my-project
```

## Troubleshooting

### Cache Not Working

**Problem**: Cache always misses

**Solutions**:
1. Check if cache is enabled: `pipeline.cache is not None`
2. Verify cache directory permissions: `~/.smart-debug/`
3. Check logs for cache errors

### Cache Too Large

**Problem**: Cache database growing too large

**Solutions**:
1. Reduce TTL: `cache_ttl_seconds=7 * 24 * 60 * 60`
2. Clear old entries: `smart-debug cache --clear`
3. Adjust max size: `cache.MAX_CACHE_SIZE = 500`

### Stale Cache Entries

**Problem**: Getting outdated analysis results

**Solutions**:
1. Clear cache: `smart-debug cache --clear`
2. Reduce TTL for faster expiration
3. Clear project-specific cache after code changes

## Privacy & Security

### What's Cached

✅ **Cached (safe)**:
- Exception types and messages (sanitized)
- Stack traces (sanitized)
- Execution paths (line numbers + function names)
- Analysis results (root cause, explanations, fixes)

❌ **NOT cached**:
- Variable values
- Secrets or credentials
- Raw unsanitized data
- User-specific information

### Cache Location

Cache is stored locally at:
- Linux/Mac: `~/.smart-debug/analysis_cache.db`
- Windows: `C:\Users\<username>\.smart-debug\analysis_cache.db`

**Never uploaded to cloud** - cache is 100% local.

## Advanced Usage

### Custom Cache Implementation

```python
from smart_debug.analysis_cache import AnalysisCache
from pathlib import Path

# Custom cache directory
cache = AnalysisCache(
    cache_dir=Path("/custom/cache/dir"),
    ttl_seconds=14 * 24 * 60 * 60  # 14 days
)

# Use with pipeline
pipeline = AIAnalyzerPipeline(enable_cache=False)
pipeline.cache = cache
```

### Cache Warming

Pre-populate cache with known crashes:

```python
from smart_debug.analysis_cache import AnalysisCache
from smart_debug.bedrock_analyzer import AnalysisResult

cache = AnalysisCache()

# Add known crash patterns
for crash_pattern in known_patterns:
    analysis = AnalysisResult(
        root_cause=crash_pattern['root_cause'],
        explanation=crash_pattern['explanation'],
        fix_suggestions=crash_pattern['fixes']
    )
    
    cache.put(
        crash_pattern['trace_data'],
        crash_pattern['stack_trace'],
        analysis,
        project_id="my-project"
    )
```

## Comparison with Other Approaches

### vs. DynamoDB Cache (Cloud)

| Feature | Local Cache | DynamoDB Cache |
|---------|-------------|----------------|
| Speed | ⚡ Instant | 🐌 Network latency |
| Cost | 💰 Free | 💸 AWS charges |
| Privacy | 🔒 100% local | ☁️ Cloud storage |
| Sharing | ❌ Per-machine | ✅ Team-wide |

### vs. Redis Cache

| Feature | SQLite Cache | Redis Cache |
|---------|--------------|-------------|
| Setup | ✅ Zero config | ⚙️ Requires server |
| Persistence | ✅ Automatic | ⚠️ Optional |
| Complexity | 🟢 Simple | 🟡 Moderate |
| Performance | 🟢 Fast enough | 🟢 Faster |

## Future Enhancements

Planned improvements:
- [ ] Distributed cache sharing across team
- [ ] Cache compression for large entries
- [ ] Smart cache invalidation based on code changes
- [ ] Cache analytics dashboard
- [ ] Export/import cache for CI/CD

## References

- [Hash-based Caching Best Practices](https://en.wikipedia.org/wiki/Cache_(computing))
- [Content-Addressable Storage](https://en.wikipedia.org/wiki/Content-addressable_storage)
- [SQLite Performance Tuning](https://www.sqlite.org/optoverview.html)
