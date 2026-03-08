# Smart Debugger Troubleshooting Guide

This guide helps you resolve common issues when using Smart Debugger.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [Runtime Issues](#runtime-issues)
- [Analysis Issues](#analysis-issues)
- [Offline Mode Issues](#offline-mode-issues)
- [Cloud Service Issues](#cloud-service-issues)
- [Performance Issues](#performance-issues)
- [Data and Storage Issues](#data-and-storage-issues)

## Installation Issues

### Python Version Error

**Problem**: `Smart Debugger requires Python 3.12 or higher`

**Solution**:
```bash
# Check your Python version
python --version

# Install Python 3.12+ from python.org or use pyenv
pyenv install 3.12.0
pyenv global 3.12.0
```

### Dependency Installation Fails

**Problem**: `pip install` fails with dependency errors

**Solution**:
```bash
# Upgrade pip first
pip install --upgrade pip

# Install with verbose output to see errors
pip install -e . -v

# If specific dependency fails, install it separately
pip install click requests boto3
```

### Command Not Found

**Problem**: `smart-debug: command not found`

**Solution**:
```bash
# Ensure package is installed
pip install -e .

# Check if script is in PATH
which smart-debug

# If not found, add to PATH or use full path
python -m smart_debug.cli run script.py
```

## Configuration Issues

### API Key Not Configured

**Problem**: `Configuration errors: API key not configured`

**Solution**:
```bash
# Create configuration directory
mkdir -p ~/.smart-debug

# Create config file with your API key
cat > ~/.smart-debug/config.json << EOF
{
  "api_key": "your-api-key-here",
  "aws_endpoint": "https://your-endpoint.com",
  "project_id": "my-project"
}
EOF

# Or use offline mode instead
smart-debug setup-offline
```

### Invalid Configuration Format

**Problem**: `Failed to load configuration: JSON decode error`

**Solution**:
```bash
# Validate JSON syntax
cat ~/.smart-debug/config.json | python -m json.tool

# If invalid, recreate the file
rm ~/.smart-debug/config.json
# Then create a new valid config
```

### AWS Endpoint Not Reachable

**Problem**: `Failed to connect to AWS endpoint`

**Solution**:
```bash
# Test endpoint connectivity
curl -I https://your-endpoint.com

# Check if endpoint URL is correct in config
cat ~/.smart-debug/config.json | grep aws_endpoint

# Try offline mode if cloud is unavailable
smart-debug run script.py --offline
```

## Runtime Issues

### Script Execution Fails

**Problem**: Script crashes immediately when run with Smart Debugger

**Solution**:
```bash
# Check if script runs normally without debugger
python script.py

# If it works, try with debugger
smart-debug run script.py

# Check tracer diagnostic info if errors occur
ls ~/.smart-debug/diagnostic_*.json
```

### Tracer Errors

**Problem**: `⚠ Tracer encountered N error(s) during execution`

**Solution**:
1. Check diagnostic file: `~/.smart-debug/diagnostic_<trace-id>.json`
2. Review tracer errors in the diagnostic file
3. Common causes:
   - Unsupported Python features
   - Very large data structures
   - Circular references

**Workaround**:
- Tracer errors don't crash your program
- Analysis may still work with partial trace
- Report persistent issues on GitHub

### Memory Usage Too High

**Problem**: System runs out of memory during tracing

**Solution**:
- Tracer automatically limits memory to 500MB
- Traces truncated to 10,000 steps if exceeding 100MB
- For very large programs, consider:
  - Running smaller portions of code
  - Using offline mode (lower memory overhead)
  - Increasing system swap space

### Execution Too Slow

**Problem**: Script runs much slower with Smart Debugger

**Solution**:
- Expected overhead: <20% execution time
- If much slower:
  - Check if trace is very large (>10,000 steps)
  - Reduce logging verbosity in config
  - Use offline mode for faster analysis

## Analysis Issues

### Analysis Fails

**Problem**: `Analysis failed. Use 'smart-debug replay <crash-id>' to retry.`

**Solution**:
```bash
# Check crash history
smart-debug history

# Retry analysis
smart-debug replay <crash-id>

# Try offline mode
smart-debug replay <crash-id> --offline

# Check logs for details
cat ~/.smart-debug/smart_debug.log
```

### Low Confidence Scores

**Problem**: Consistently getting confidence <60%

**Possible Causes**:
1. Using offline mode (lower accuracy than cloud)
2. Complex or unusual crash patterns
3. Insufficient execution context
4. Sanitization removed too much context

**Solutions**:
```bash
# Use cloud mode for better analysis
smart-debug sync

# Answer iterative questions with more detail
# When AI asks questions, provide specific information

# Check failure report for manual investigation
cat ~/.smart-debug/reports/<crash-id>.md
```

### No Fix Suggestions

**Problem**: Analysis completes but no fix suggestions provided

**Explanation**:
- Fix suggestions only generated when confidence ≥80%
- For confidence 60-79%: AI asks clarifying questions
- For confidence <60%: Failure report generated

**Solution**:
```bash
# Answer iterative questions to improve confidence
# Or check failure report for manual investigation guidance
```

### Iterative Questions Not Helpful

**Problem**: AI asks questions but answers don't improve confidence

**Solution**:
1. Provide specific, detailed answers
2. Include relevant context about your code
3. After 3 iterations, check failure report
4. Use failure report prompt with Claude/ChatGPT

## Offline Mode Issues

### Ollama Not Installed

**Problem**: `✗ Ollama is not installed`

**Solution**:
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Or download from: https://ollama.ai/download

# Verify installation
ollama --version
```

### Ollama Service Not Running

**Problem**: `✗ Ollama service is not running`

**Solution**:
```bash
# Start Ollama service
ollama serve

# Or start from applications menu (macOS/Windows)

# Verify service is running
curl http://localhost:11434/api/tags
```

### Model Download Fails

**Problem**: `✗ Failed to download model 'llama3.1:8b'`

**Solution**:
```bash
# Try manual download
ollama pull llama3.1:8b

# If network issues, check connectivity
curl -I https://ollama.ai

# Try smaller model if disk space limited
ollama pull llama3.1:7b
```

### Offline Analysis Lower Quality

**Problem**: Offline mode gives lower confidence than cloud

**Explanation**:
- Local models are smaller and less capable than Claude Sonnet
- This is expected behavior
- Offline mode is for when cloud is unavailable

**Solution**:
```bash
# Sync to cloud when connectivity restored
smart-debug sync

# This re-analyzes offline crashes with cloud AI
```

## Cloud Service Issues

### API Key Invalid

**Problem**: `401 Unauthorized: Invalid API key`

**Solution**:
```bash
# Verify API key in config
cat ~/.smart-debug/config.json | grep api_key

# Get new API key from your administrator
# Update config with correct key

# Test with a simple crash
smart-debug run test_script.py
```

### Rate Limit Exceeded

**Problem**: `429 Too Many Requests: Rate limit exceeded`

**Solution**:
```bash
# Wait for rate limit to reset (100 requests per hour)
# Or use offline mode temporarily
smart-debug run script.py --offline

# Check when rate limit resets
# Typically resets after 1 hour
```

### Network Timeout

**Problem**: `Analysis timed out after 30 seconds`

**Solution**:
```bash
# Retry analysis
smart-debug replay <crash-id>

# If persistent, check network connectivity
ping your-endpoint.com

# Use offline mode if cloud is slow
smart-debug run script.py --offline
```

### Cloud Service Unavailable

**Problem**: `Failed to connect to AWS services`

**Solution**:
```bash
# Check service status
curl -I https://your-endpoint.com

# Use offline mode
smart-debug run script.py --offline

# Sync later when service is back
smart-debug sync
```

## Performance Issues

### Trace Upload Slow

**Problem**: Large traces take too long to upload

**Solution**:
- Traces are automatically compressed before upload
- Streaming uploads used for traces >10MB
- Expected: ~1-2 seconds per MB
- If much slower, check network speed

### Analysis Takes Too Long

**Problem**: Analysis takes >30 seconds

**Solution**:
- Cloud analysis should complete within 30 seconds
- If timeout occurs, partial results returned
- Retry with: `smart-debug replay <crash-id>`
- Check CloudWatch logs for backend issues

### Database Queries Slow

**Problem**: `smart-debug history` is slow

**Solution**:
```bash
# Check database size
ls -lh ~/.smart-debug/traces.db

# If very large (>100MB), clean up old traces
# Backup first
cp ~/.smart-debug/traces.db ~/.smart-debug/traces.db.backup

# Then remove old traces (manual SQL)
sqlite3 ~/.smart-debug/traces.db "DELETE FROM traces WHERE timestamp < strftime('%s', 'now', '-30 days')"
```

## Data and Storage Issues

### Trace Not Found

**Problem**: `Trace {trace_id} not found`

**Solution**:
```bash
# List available crashes
smart-debug history

# Use correct crash ID from history
smart-debug replay crash_20240220_142200_abc123

# Check if database exists
ls -la ~/.smart-debug/traces.db
```

### Database Corrupted

**Problem**: `SQLite error: database disk image is malformed`

**Solution**:
```bash
# Backup database
cp ~/.smart-debug/traces.db ~/.smart-debug/traces.db.backup

# Try to recover
sqlite3 ~/.smart-debug/traces.db ".recover" | sqlite3 ~/.smart-debug/traces_recovered.db

# If recovery fails, start fresh
rm ~/.smart-debug/traces.db
# Smart Debugger will create new database on next run
```

### Disk Space Full

**Problem**: `Failed to save trace: No space left on device`

**Solution**:
```bash
# Check disk space
df -h ~/.smart-debug

# Clean up old traces
rm ~/.smart-debug/traces.db

# Or remove old diagnostic files
rm ~/.smart-debug/diagnostic_*.json

# Remove old reports
rm -rf ~/.smart-debug/reports/
```

### Sanitization Removes Too Much

**Problem**: Analysis fails because sanitization removed important context

**Solution**:
- Sanitization is intentionally aggressive for privacy
- Cannot be disabled (security requirement)
- Workarounds:
  1. Use more descriptive variable names
  2. Add comments explaining logic
  3. Provide context in iterative questions

## Getting Help

### Enable Debug Logging

```bash
# Edit config to enable debug logging
cat > ~/.smart-debug/config.json << EOF
{
  "api_key": "your-key",
  "aws_endpoint": "https://...",
  "project_id": "my-project",
  "log_level": "DEBUG"
}
EOF

# Run with debug logging
smart-debug run script.py

# Check logs
cat ~/.smart-debug/smart_debug.log
```

### Collect Diagnostic Information

```bash
# Version information
smart-debug --version
python --version

# Configuration (remove sensitive data before sharing)
cat ~/.smart-debug/config.json

# Recent logs
tail -n 100 ~/.smart-debug/smart_debug.log

# Tracer diagnostic info (if available)
cat ~/.smart-debug/diagnostic_*.json
```

### Report Issues

If you encounter persistent issues:

1. Enable debug logging
2. Collect diagnostic information
3. Create minimal reproduction case
4. Report on GitHub with:
   - Error message
   - Steps to reproduce
   - Diagnostic information
   - Python version
   - Operating system

## Common Error Messages

### `Configuration validation failed`
- Check config file syntax
- Ensure all required fields present
- Use offline mode if no API key

### `Tracer encountered errors`
- Check diagnostic file
- Tracer errors don't crash your program
- Analysis may still work

### `Sanitization failed`
- Trace will not be sent to LLM
- Use offline mode only
- Report issue if persistent

### `Project memory unavailable`
- DynamoDB connection issue
- Analysis continues without memory
- Confidence may be lower

### `Failed to generate failure report`
- Check disk space
- Check write permissions
- Report will be in logs

## Best Practices

### Prevent Issues

1. **Keep configuration valid**: Validate JSON syntax
2. **Monitor disk space**: Clean up old traces regularly
3. **Use offline mode as backup**: Set up Ollama for reliability
4. **Update regularly**: Keep Smart Debugger and dependencies updated
5. **Test with simple scripts first**: Verify setup before complex code

### Optimize Performance

1. **Use cloud mode for best results**: Higher confidence scores
2. **Sync offline crashes**: Re-analyze with cloud when available
3. **Clean up old data**: Remove traces older than 30 days
4. **Provide detailed answers**: Help AI improve confidence faster
5. **Use time-travel debugging**: Investigate before re-analyzing

### Maintain Privacy

1. **Trust sanitization**: 5-layer pipeline removes secrets
2. **Review failure reports**: Check before sharing externally
3. **Use offline mode for sensitive code**: No data leaves your machine
4. **Rotate API keys**: Change keys periodically
5. **Clean up old traces**: Remove after fixing issues
