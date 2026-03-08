# Offline Mode with Local Ollama

Smart Debugger supports offline mode using local Ollama for AI-powered crash analysis when cloud services are unavailable or when you prefer to keep your code analysis completely local.

## Features

- **Local AI Analysis**: Uses Ollama running on your machine for crash analysis
- **Automatic Fallback**: Automatically switches to offline mode when cloud services are unavailable
- **Privacy-First**: All analysis happens locally without sending data to the cloud
- **Sync Capability**: Re-analyze offline crashes with cloud AI when connectivity returns
- **Same Interface**: Uses the same analysis interface as cloud mode for consistency

## Setup

### 1. Install Ollama

Visit [https://ollama.ai/download](https://ollama.ai/download) and install Ollama for your platform.

Or use the installation script:
```bash
curl https://ollama.ai/install.sh | sh
```

### 2. Start Ollama Service

Make sure Ollama is running:
```bash
ollama serve
```

### 3. Configure Smart Debugger

Run the setup command to configure offline mode:
```bash
smart-debug setup-offline
```

This will:
- Verify Ollama is installed and running
- Download the required AI model (llama3.2 by default)
- Test offline analysis functionality
- Configure Smart Debugger to use offline mode

## Usage

### Run with Offline Mode

Use the `--offline` flag to explicitly use offline mode:
```bash
smart-debug run script.py --offline
```

Or configure offline mode as default in your config:
```bash
# Offline mode will be used automatically
smart-debug run script.py
```

### Automatic Fallback

If cloud services are unavailable, Smart Debugger automatically falls back to offline mode:
```bash
smart-debug run script.py
# If cloud is unavailable:
# ✗ Cannot reach cloud service
# Automatically switching to offline mode...
```

### Sync Offline Analyses

When connectivity is restored, you can re-analyze offline crashes with cloud AI for potentially better results:

```bash
# Check for unsynced offline crashes
smart-debug history

# Sync all offline crashes to cloud
smart-debug sync
```

The sync command will:
1. Check cloud connectivity
2. Find all offline crashes that haven't been synced
3. Re-analyze them with cloud AI
4. Update the analysis results with higher confidence scores

## Differences from Cloud Mode

### Offline Mode
- ✅ Complete privacy - no data leaves your machine
- ✅ Works without internet connection
- ✅ No API key required
- ⚠️ May provide lower confidence scores
- ⚠️ No project memory (pattern learning)
- ⚠️ Depends on local model capabilities

### Cloud Mode
- ✅ Higher confidence scores
- ✅ Project memory and pattern learning
- ✅ More powerful AI models (Claude Sonnet)
- ⚠️ Requires internet connection
- ⚠️ Requires API key
- ⚠️ Data sent to AWS (after sanitization)

## Configuration

### Default Model

By default, offline mode uses the `llama3.2` model. You can change this by modifying the OllamaAnalyzer configuration:

```python
from smart_debug.ollama_analyzer import OllamaAnalyzer

analyzer = OllamaAnalyzer(model="llama3.1")
```

### Ollama Endpoint

If Ollama is running on a different host or port:

```python
analyzer = OllamaAnalyzer(endpoint="http://localhost:11434")
```

## Troubleshooting

### Ollama Not Found

```
✗ Ollama is not installed
```

**Solution**: Install Ollama from https://ollama.ai/download

### Ollama Service Not Running

```
✗ Ollama service is not running
```

**Solution**: Start Ollama service:
```bash
ollama serve
```

### Model Not Available

```
✗ Model 'llama3.2' not found
```

**Solution**: The setup command will automatically download the model, or manually:
```bash
ollama pull llama3.2
```

### Analysis Timeout

```
✗ Offline analysis timed out
```

**Solution**: 
- Ensure your machine has sufficient resources
- Try a smaller model
- Increase timeout in configuration

## Performance Considerations

- **First Analysis**: May be slower as the model loads into memory
- **Subsequent Analyses**: Faster as model stays in memory
- **Memory Usage**: Requires ~4-8GB RAM depending on model size
- **CPU Usage**: Higher during analysis (30-60 seconds typical)

## Best Practices

1. **Use Cloud Mode When Available**: Cloud mode provides better results with project memory
2. **Sync Regularly**: Run `smart-debug sync` when online to get improved analyses
3. **Keep Ollama Updated**: Update Ollama and models regularly for best performance
4. **Monitor Resources**: Ensure sufficient RAM and CPU for local AI analysis

## Example Workflow

```bash
# Setup offline mode once
smart-debug setup-offline

# Work offline
smart-debug run app.py --offline
# Crash detected and analyzed locally

# Later, when online
smart-debug history
# ⚠ You have 3 offline crash(es) that can be re-analyzed with cloud AI
# ✓ Cloud service is available
# Run 'smart-debug sync' to re-analyze with cloud AI for better results.

smart-debug sync
# Re-analyzing 3 crashes with cloud AI...
# ✓ Successfully synced 3 crash(es)
```

## Technical Details

### Architecture

```
┌─────────────────┐
│   CLI Command   │
└────────┬────────┘
         │
         ├─ Cloud Available? ──Yes──> AWS Bedrock
         │
         └─ No ──> OllamaAnalyzer
                   │
                   ├─ Local Ollama API
                   ├─ Same Analysis Interface
                   └─ Store as Offline Crash
```

### Analysis Flow

1. **Crash Detection**: Same as cloud mode
2. **Trace Capture**: Same as cloud mode
3. **Sanitization**: Same 5-layer sanitization
4. **Analysis**: Local Ollama instead of AWS Bedrock
5. **Confidence Scoring**: Same algorithm
6. **Storage**: Marked as offline for later sync

### Sync Process

1. Detect connectivity restoration
2. Query unsynced offline crashes
3. Re-analyze with cloud AI
4. Update confidence scores
5. Mark as synced

## Security

- All sanitization layers still apply in offline mode
- No data leaves your machine in offline mode
- Sync only happens when explicitly requested
- API keys not required for offline mode

## Future Enhancements

- [ ] Support for custom Ollama models
- [ ] Configurable timeout values
- [ ] Automatic sync on connectivity restoration
- [ ] Offline project memory (local pattern learning)
- [ ] Model performance benchmarking
