# Failure Report Lambda

This Lambda function generates detailed failure reports when the AI analyzer cannot fix a bug with sufficient confidence (below 80% after up to 3 refinement iterations).

## Purpose

When automatic analysis fails, this function:
1. Generates a comprehensive markdown report explaining why AI failed
2. Lists all known facts about the crash
3. Identifies priority files and line numbers for manual investigation
4. Creates pre-crafted prompts optimized for Claude and ChatGPT
5. Stores the report and sanitized trace in S3
6. Returns report location and prompts to the CLI

## Input Event

```json
{
  "crash_id": "crash_20240220_142200_abc123",
  "trace_s3_key": "sanitized/project-id/crash_20240220_142200_abc123.json",
  "project_id": "my-project",
  "analysis_result": {
    "root_cause": "Partial analysis...",
    "explanation": "...",
    "fix_suggestions": [],
    "specific_line": null,
    "specific_variable": null
  },
  "confidence_score": 55.0,
  "iteration_history": [
    {
      "questions": ["What is the expected format?"],
      "answers": {"What is the expected format?": "A dictionary"},
      "confidence_score": 55.0
    }
  ]
}
```

## Output Response

```json
{
  "statusCode": 200,
  "body": {
    "crash_id": "crash_20240220_142200_abc123",
    "action": "failure_report_generated",
    "report_url": "s3://bucket/reports/project-id/crash_20240220_142200_abc123_report.md",
    "trace_attachment_url": "s3://bucket/reports/project-id/crash_20240220_142200_abc123_trace.json",
    "failure_reason": "Confidence score too low (below 60%); Root cause could not be determined",
    "known_facts": [...],
    "priority_files": [...],
    "claude_prompt": "...",
    "chatgpt_prompt": "...",
    "elapsed_time": 0.5
  }
}
```

## Environment Variables

- `TRACE_BUCKET`: S3 bucket containing traces
- `REPORTS_BUCKET`: S3 bucket for reports (defaults to TRACE_BUCKET)
- `CRASH_HISTORY_TABLE`: DynamoDB table for crash records

## Report Structure

The generated markdown report includes:

1. **Why AI Failed**: Explanation of failure reasons
2. **Known Facts**: All extracted information about the crash
3. **Priority Files**: Files to investigate with priority levels (HIGH/MEDIUM/LOW)
4. **Refinement History**: Questions asked and answers provided during iterations
5. **Pre-Crafted Prompts**: Ready-to-use prompts for Claude and ChatGPT
6. **Next Steps**: Recommended actions for manual investigation

## Integration

This Lambda is triggered by the AI Analyzer Lambda when:
- Confidence score remains below 80% after 3 refinement iterations
- Confidence score is below 60% on first analysis
- Decision engine determines manual investigation is required

## Requirements

See `requirements.txt` for dependencies.
