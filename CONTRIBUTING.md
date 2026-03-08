# Contributing to Smart Debugger

Thank you for your interest in contributing to Smart Debugger! This document provides guidelines and information for developers who want to contribute to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, background, or identity.

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Assume good intentions
- Respect differing viewpoints and experiences

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information
- Any conduct that would be inappropriate in a professional setting

## Getting Started

### Prerequisites

- Python 3.12 or higher
- Git
- AWS CLI (for backend development)
- Basic understanding of:
  - Python async/await patterns
  - AWS Lambda and serverless architecture
  - AI/LLM concepts
  - Debugging and tracing concepts

### Finding Issues to Work On

1. Check the [Issues](https://github.com/your-org/smart-debugger/issues) page
2. Look for issues labeled:
   - `good first issue`: Great for newcomers
   - `help wanted`: We need community help
   - `bug`: Something isn't working
   - `enhancement`: New feature or improvement
3. Comment on the issue to express interest
4. Wait for maintainer approval before starting work

### Asking Questions

- For usage questions: Use [Discussions](https://github.com/your-org/smart-debugger/discussions)
- For bug reports: Create an [Issue](https://github.com/your-org/smart-debugger/issues)
- For feature requests: Create an [Issue](https://github.com/your-org/smart-debugger/issues) with `enhancement` label

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/smart-debugger.git
cd smart-debugger/ai_debugger

# Add upstream remote
git remote add upstream https://github.com/original-org/smart-debugger.git
```

### 2. Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
# Install package in development mode with all dependencies
pip install -e ".[dev]"

# Verify installation
smart-debug --version
pytest --version
```

### 4. Configure Development Environment

```bash
# Create development configuration
mkdir -p ~/.smart-debug
cat > ~/.smart-debug/config.json << EOF
{
  "api_key": "dev-api-key",
  "aws_endpoint": "http://localhost:3000",
  "project_id": "dev-project",
  "offline_mode": true,
  "log_level": "DEBUG"
}
EOF

# Set up Ollama for offline development
smart-debug setup-offline
```

### 5. Run Tests

```bash
# Run all tests
pytest -v

# Run with coverage
pytest --cov=smart_debug --cov-report=html

# Open coverage report
open htmlcov/index.html
```

## Architecture Overview

### System Components

Smart Debugger consists of five major components:

1. **Local Agent (CLI)**: Python CLI tool that runs on developer's machine
2. **Tracer Module**: Captures execution traces using sys.monitoring API
3. **AWS Backend**: Serverless infrastructure for processing and analysis
4. **AI Analyzer**: Bedrock-powered analysis engine with confidence scoring
5. **Project Memory**: DynamoDB-based learning system

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Local Agent (CLI)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Tracer     │  │   Storage    │  │    Config    │      │
│  │  (sys.mon)   │  │   (SQLite)   │  │   Manager    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Time Travel  │  │ Result       │  │   Uploader   │      │
│  │  Navigator   │  │  Formatter   │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Crash      │  │  Sanitizer   │  │ AI Analyzer  │      │
│  │  Ingestion   │  │   Lambda     │  │   Lambda     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Project    │  │   Failure    │  │      S3      │      │
│  │   Memory     │  │   Report     │  │   Storage    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   DynamoDB   │  │   Bedrock    │                        │
│  │   Tables     │  │    Claude    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
ai_debugger/
├── smart_debug/              # Main package
│   ├── __init__.py
│   ├── cli.py               # CLI interface
│   ├── tracer.py            # Execution tracer
│   ├── storage.py           # Local SQLite storage
│   ├── config.py            # Configuration management
│   ├── crash_detector.py    # Crash detection
│   ├── sanitizer.py         # 5-layer sanitization
│   ├── time_travel.py       # Time-travel debugging
│   ├── fix_suggester.py     # Fix generation
│   ├── iterative_refiner.py # Iterative refinement
│   ├── bedrock_analyzer.py  # Bedrock integration
│   ├── ollama_analyzer.py   # Ollama integration
│   ├── result_formatter.py  # Terminal output formatting
│   ├── trace_uploader.py    # Trace upload/compression
│   └── logger.py            # Logging utilities
├── lambda/                   # AWS Lambda functions
│   ├── crash_ingestion/
│   ├── sanitizer/
│   ├── ai_analyzer/
│   ├── project_memory/
│   ├── failure_report/
│   └── shared/              # Shared utilities
├── infrastructure/           # AWS infrastructure code
│   ├── template.yaml        # SAM template
│   ├── template.json        # CloudFormation template
│   └── deploy.sh            # Deployment script
├── tests/                    # Test suite
│   ├── conftest.py          # Pytest fixtures
│   ├── test_*.py            # Unit tests
│   └── property_tests/      # Property-based tests
├── examples/                 # Usage examples
└── docs/                     # Documentation
```

### Key Design Principles

1. **Privacy-First**: Multi-layer sanitization before any LLM processing
2. **Graceful Degradation**: Offline mode when cloud unavailable
3. **Educational**: Teach debugging methodology, not just provide fixes
4. **Incremental Learning**: Project memory improves over time
5. **Beginner-Friendly**: Simple CLI, no jargon in output

## Development Workflow

### 1. Create Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Changes

```bash
# Make your changes
# Write tests for new functionality
# Update documentation as needed

# Run tests frequently
pytest tests/test_your_module.py -v

# Check code style
black smart_debug/
flake8 smart_debug/
```

### 3. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: brief description

Detailed explanation of what changed and why.

Fixes #123"
```

### 4. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# Fill out the PR template
# Link related issues
```

### Commit Message Guidelines

Format:
```
<type>: <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat: Add time-travel debugging navigation

Implement interactive time-travel debugging that allows users to
navigate backwards through execution history and inspect variable
states at each step.

Features:
- Step backward/forward through execution
- Jump to specific line numbers
- Filter by function or variable
- Show variable history

Closes #45
```

## Testing Strategy

### Test Types

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **Property-Based Tests**: Test universal properties with hypothesis
4. **End-to-End Tests**: Test complete workflows

### Running Tests

```bash
# Run all tests
pytest -v

# Run specific test file
pytest tests/test_tracer.py -v

# Run specific test
pytest tests/test_tracer.py::test_trace_capture -v

# Run with coverage
pytest --cov=smart_debug --cov-report=html

# Run property-based tests only
pytest tests/ -k "property" -v

# Run with verbose hypothesis output
pytest tests/ -k "property" -v --hypothesis-verbosity=verbose
```

### Writing Unit Tests

```python
# tests/test_example.py
import pytest
from smart_debug.example import ExampleClass

def test_example_function():
    """Test that example function works correctly."""
    # Arrange
    input_data = {"key": "value"}
    expected = "expected_result"
    
    # Act
    result = ExampleClass().process(input_data)
    
    # Assert
    assert result == expected

def test_example_error_handling():
    """Test that example function handles errors correctly."""
    with pytest.raises(ValueError, match="Invalid input"):
        ExampleClass().process(None)
```

### Writing Property-Based Tests

```python
# tests/property_tests/test_tracer_properties.py
from hypothesis import given, strategies as st
from smart_debug.tracer import ExecutionTracer

@given(st.text(min_size=1))
def test_property_trace_capture(script_content):
    """
    Property 1: Complete Trace Capture
    
    For any Python program that crashes, the captured execution trace
    should contain all required elements.
    
    Feature: smart-debugger, Property 1: Complete Trace Capture
    """
    # Create temporary script
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(script_content)
        script_path = f.name
    
    try:
        tracer = ExecutionTracer(script_path)
        tracer.start_tracing()
        
        # Execute script (may crash)
        try:
            exec(compile(script_content, script_path, 'exec'))
        except:
            pass
        
        trace = tracer.stop_tracing()
        
        # Verify trace completeness
        assert trace is not None
        assert hasattr(trace, 'steps')
        assert hasattr(trace, 'exception_info')
        
    finally:
        os.unlink(script_path)
```

### Test Coverage Requirements

- Minimum 80% code coverage for new code
- All public APIs must have tests
- Critical paths must have property-based tests
- Error handling must be tested

### Running Tests Locally

```bash
# Before committing
pytest -v --cov=smart_debug --cov-report=term-missing

# Check coverage
pytest --cov=smart_debug --cov-report=html
open htmlcov/index.html
```

## Code Style

### Python Style Guide

We follow [PEP 8](https://pep8.org/) with some modifications:

- Line length: 100 characters (not 79)
- Use double quotes for strings
- Use type hints for function signatures
- Use docstrings for all public functions/classes

### Formatting Tools

```bash
# Format code with Black
black smart_debug/

# Check with flake8
flake8 smart_debug/

# Sort imports with isort
isort smart_debug/

# Type checking with mypy
mypy smart_debug/
```

### Docstring Format

Use Google-style docstrings:

```python
def example_function(param1: str, param2: int) -> bool:
    """Brief description of function.
    
    Longer description if needed. Explain what the function does,
    not how it does it.
    
    Args:
        param1: Description of param1
        param2: Description of param2
    
    Returns:
        Description of return value
    
    Raises:
        ValueError: When param1 is empty
        TypeError: When param2 is not an integer
    
    Example:
        >>> example_function("test", 42)
        True
    """
    if not param1:
        raise ValueError("param1 cannot be empty")
    return len(param1) > param2
```

### Type Hints

Use type hints for all function signatures:

```python
from typing import List, Dict, Optional, Union

def process_trace(
    trace_data: Dict[str, Any],
    options: Optional[Dict[str, str]] = None
) -> List[str]:
    """Process trace data and return results."""
    pass
```

## Pull Request Process

### Before Submitting

1. **Run all tests**: `pytest -v`
2. **Check coverage**: `pytest --cov=smart_debug`
3. **Format code**: `black smart_debug/`
4. **Check style**: `flake8 smart_debug/`
5. **Update documentation**: If adding features
6. **Add tests**: For new functionality
7. **Update CHANGELOG**: Add entry for your changes

### PR Template

When creating a PR, fill out the template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Property tests added/updated
- [ ] All tests passing
- [ ] Coverage maintained/improved

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added for new functionality
- [ ] All tests pass locally
```

### Review Process

1. **Automated Checks**: CI runs tests and style checks
2. **Code Review**: Maintainer reviews code
3. **Feedback**: Address review comments
4. **Approval**: Maintainer approves PR
5. **Merge**: Maintainer merges to main

### After Merge

1. **Delete branch**: Clean up feature branch
2. **Update local**: Pull latest main
3. **Close issues**: Link PR to issues

## Issue Guidelines

### Bug Reports

Include:
- **Description**: What happened vs. what should happen
- **Steps to Reproduce**: Minimal steps to reproduce
- **Environment**: Python version, OS, Smart Debugger version
- **Logs**: Relevant error messages or logs
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened

Template:
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Run command '...'
2. See error

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g., macOS 14.0]
- Python: [e.g., 3.12.0]
- Smart Debugger: [e.g., 1.0.0]

**Logs**
```
Paste relevant logs here
```

**Additional context**
Any other context about the problem.
```

### Feature Requests

Include:
- **Problem**: What problem does this solve?
- **Solution**: Proposed solution
- **Alternatives**: Alternative solutions considered
- **Use Cases**: Real-world use cases

Template:
```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Use cases**
Real-world scenarios where this would be useful.

**Additional context**
Any other context or screenshots.
```

## Development Tips

### Local Development with Ollama

```bash
# Use offline mode for faster development
smart-debug run script.py --offline

# No need for AWS credentials
# Faster iteration cycle
```

### Debugging the Debugger

```bash
# Enable debug logging
export SMART_DEBUG_LOG_LEVEL=DEBUG

# Run with verbose output
smart-debug run script.py -v

# Check diagnostic files
cat ~/.smart-debug/diagnostic_*.json
```

### Testing AWS Integration

```bash
# Use localstack for local AWS testing
docker run -d -p 4566:4566 localstack/localstack

# Configure AWS CLI for localstack
export AWS_ENDPOINT_URL=http://localhost:4566

# Run integration tests
pytest tests/integration/ -v
```

### Performance Profiling

```bash
# Profile tracer performance
python -m cProfile -o profile.stats smart_debug/tracer.py

# Analyze profile
python -m pstats profile.stats
```

## Additional Resources

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Testing Guide](docs/TESTING.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

## Questions?

- **Usage Questions**: [Discussions](https://github.com/your-org/smart-debugger/discussions)
- **Bug Reports**: [Issues](https://github.com/your-org/smart-debugger/issues)
- **Feature Requests**: [Issues](https://github.com/your-org/smart-debugger/issues)
- **Security Issues**: Email security@example.com

Thank you for contributing to Smart Debugger!
