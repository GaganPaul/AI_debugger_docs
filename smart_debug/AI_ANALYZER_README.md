# AI Analyzer Implementation

This document describes the AI Analyzer implementation for the Smart Debugger project.

## Overview

The AI Analyzer is responsible for analyzing crash traces using Amazon Bedrock Claude Sonnet, calculating confidence scores, and making decisions about how to proceed (auto-fix, ask questions, or generate failure report).

## Components

### 1. BedrockAnalyzer (`bedrock_analyzer.py`)

**Purpose**: Main interface to Amazon Bedrock Claude Sonnet for crash analysis.

**Key Features**:
- Integrates with Amazon Bedrock Claude Sonnet 3.5
- Builds structured prompts with trace, stack trace, and context
- Parses AI responses for root cause, explanation, and fix suggestions
- Implements 30-second timeout handling
- Handles API errors gracefully

**Usage**:
```python
from smart_debug.bedrock_analyzer import BedrockAnalyzer

analyzer = BedrockAnalyzer(region_name="us-east-1")
result = analyzer.analyze_crash(trace_data, stack_trace, project_context)

if result.success:
    print(f"Root cause: {result.root_cause}")
    print(f"Explanation: {result.explanation}")
    print(f"Fixes: {result.fix_suggestions}")
```

**Requirements Satisfied**:
- 3.1: Send sanitized trace to Amazon Bedrock Claude Sonnet
- 3.2: Provide AI with execution trace, stack trace, and context
- 3.5: Return analysis within 30 seconds
- 9.4: Use Amazon Bedrock for AI analysis

### 2. ConfidenceCalculator (`confidence_calculator.py`)

**Purpose**: Calculate confidence scores based on analysis quality.

**Scoring Algorithm**:
- **Specific line/variable identification**: +30%
  - +15% for specific line number
  - +15% for specific variable name
- **Clear causal explanation**: +25%
  - +10% for causal words (because, therefore, etc.)
  - +10% for substantial explanation (≥20 words)
  - +5% for specific (not generic) root cause
- **Similar patterns in project memory**: +20%
  - +20% for strong pattern match
  - +10% for partial pattern match
  - +5% for having context but no match
- **Actionable fix suggestion**: +15%
  - +5% for having at least one fix
  - +5% for specific code or line references
  - +5% for non-vague suggestions
- **Uncertainty penalty**: -10% per uncertainty word (max -30%)
  - Words like "might", "maybe", "possibly", "perhaps", etc.

**Usage**:
```python
from smart_debug.confidence_calculator import ConfidenceCalculator

calculator = ConfidenceCalculator()
score = calculator.calculate_confidence(analysis_result, trace_data, project_context)

print(f"Confidence: {score.total_score:.1f}%")
print(f"Level: {calculator.get_confidence_level(score.total_score)}")
print(f"Breakdown: {score.breakdown}")
```

**Requirements Satisfied**:
- 4.1: Calculate confidence scores between 0% and 100%

### 3. DecisionEngine (`decision_logic.py`)

**Purpose**: Determine next action based on confidence score.

**Decision Rules**:
- **Confidence ≥80%**: Auto-fix with specific code changes
- **Confidence 60-79%**: Ask targeted clarifying questions (max 3 iterations)
- **Confidence <60%**: Generate failure report

**Question Generation**:
The engine generates targeted questions based on missing information:
- Missing specific location → Ask about expected behavior at crash line
- Missing specific variable → Ask about expected variable values
- No fix suggestions → Ask about expected behavior
- Import/Module errors → Ask about dependencies
- Connection/Network errors → Ask about service accessibility
- File/IO errors → Ask about file paths and permissions
- Type/Attribute errors → Ask about data format

**Usage**:
```python
from smart_debug.decision_logic import DecisionEngine, DecisionType

engine = DecisionEngine()
decision = engine.make_decision(
    analysis_result=analysis,
    confidence_score=75.0,
    trace_data=trace_data,
    iteration_count=0
)

if decision.decision_type == DecisionType.AUTO_FIX:
    response = engine.format_auto_fix_response(decision)
elif decision.decision_type == DecisionType.ASK_QUESTIONS:
    response = engine.format_questions_response(decision)
else:  # GENERATE_REPORT
    response = engine.format_report_response(decision)
```

**Requirements Satisfied**:
- 4.2: Provide automatic fix when confidence ≥80%
- 4.3: Ask clarifying questions when confidence <80%

### 4. AIAnalyzerPipeline (`ai_analyzer_pipeline.py`)

**Purpose**: Complete pipeline integrating all components.

**Pipeline Steps**:
1. **Analyze crash** with Bedrock Claude
2. **Calculate confidence** score
3. **Make decision** based on confidence
4. **Format response** for user

**Usage**:
```python
from smart_debug.ai_analyzer_pipeline import AIAnalyzerPipeline

pipeline = AIAnalyzerPipeline(region_name="us-east-1")

# Initial analysis
result = pipeline.analyze(trace_data, stack_trace, project_context)

if result.success:
    if result.decision.decision_type == DecisionType.ASK_QUESTIONS:
        # User answers questions
        user_answers = {
            "Question 1": "Answer 1",
            "Question 2": "Answer 2"
        }
        
        # Re-analyze with answers
        result = pipeline.analyze_with_user_input(
            trace_data, 
            stack_trace, 
            user_answers,
            project_context,
            iteration_count=1
        )
```

## Data Flow

```
Trace Data + Stack Trace
         ↓
   BedrockAnalyzer
         ↓
   AnalysisResult
         ↓
 ConfidenceCalculator
         ↓
   ConfidenceScore
         ↓
   DecisionEngine
         ↓
      Decision
         ↓
 Formatted Response
```

## Response Formats

### Auto-Fix Response
```json
{
    "action": "auto_fix",
    "confidence": 85.0,
    "root_cause": "Variable x is None",
    "explanation": "The variable was not initialized...",
    "fix_suggestions": [
        "Change line 42 to: x = get_value() or default_value"
    ],
    "specific_line": 42,
    "specific_variable": "x",
    "confidence_breakdown": {
        "total": 85.0,
        "level": "HIGH",
        "components": {...}
    }
}
```

### Questions Response
```json
{
    "action": "ask_questions",
    "confidence": 65.0,
    "root_cause": "Possible null reference",
    "explanation": "The variable might be null...",
    "questions": [
        "What is the expected value of variable x?",
        "Has the data format changed recently?"
    ],
    "partial_analysis": {
        "fix_suggestions": [],
        "specific_line": null,
        "specific_variable": null
    },
    "confidence_breakdown": {...}
}
```

### Report Response
```json
{
    "action": "generate_report",
    "confidence": 45.0,
    "reason": "Confidence score 45.0% below threshold",
    "partial_analysis": {
        "root_cause": "Unable to determine",
        "explanation": "...",
        "fix_suggestions": [],
        "specific_line": null,
        "specific_variable": null
    },
    "confidence_breakdown": {...}
}
```

## Testing

The implementation includes comprehensive unit tests in `tests/test_ai_analyzer.py`:

- **BedrockAnalyzer tests**: Initialization, prompt building, response parsing, timeout handling
- **ConfidenceCalculator tests**: High/low confidence scenarios, pattern matching, uncertainty penalties
- **DecisionEngine tests**: Decision rules, question generation, response formatting

Run tests:
```bash
pytest tests/test_ai_analyzer.py -v
```

## Configuration

### AWS Credentials
The BedrockAnalyzer requires AWS credentials with access to Amazon Bedrock. Configure using:
- Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- AWS credentials file: `~/.aws/credentials`
- IAM role (when running on AWS)

### Required IAM Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": "arn:aws:bedrock:*:*:model/anthropic.claude-3-5-sonnet-20241022-v2:0"
        }
    ]
}
```

## Error Handling

All components implement comprehensive error handling:

- **Network errors**: Graceful fallback with error messages
- **Timeouts**: Return partial results or timeout error
- **API errors**: Log and return error response
- **Parse errors**: Fallback to unstructured parsing
- **Unexpected errors**: Catch-all with detailed logging

## Future Enhancements

Potential improvements for future iterations:

1. **Caching**: Cache similar analyses to reduce API calls
2. **Streaming**: Stream responses for faster perceived performance
3. **Multi-model**: Support multiple AI models (Claude, GPT-4, etc.)
4. **Fine-tuning**: Fine-tune models on project-specific patterns
5. **Metrics**: Track accuracy and user satisfaction metrics
6. **A/B testing**: Test different prompts and scoring algorithms

## Dependencies

- `boto3>=1.34.0`: AWS SDK for Bedrock integration
- `botocore`: AWS core library (included with boto3)

## Related Components

- **Sanitizer** (`sanitizer.py`): Sanitizes traces before sending to AI
- **ExecutionTracer** (`tracer.py`): Captures execution traces
- **LocalStorage** (`storage.py`): Stores traces and analysis results
- **Project Memory** (future): Stores learned patterns for confidence boosting

## References

- Design Document: `ai_debugger/.kiro/specs/smart-debugger/design.md`
- Requirements Document: `ai_debugger/.kiro/specs/smart-debugger/requirements.md`
- Tasks Document: `ai_debugger/.kiro/specs/smart-debugger/tasks.md`
