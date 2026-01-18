# Mode-Specific Event Tracking Usage Guide

This document explains how to track mode-specific events in the OLLM CLI application.

## Overview

The `ModeMetricsTracker` tracks mode-specific events to provide insights into how different modes are being used and their effectiveness. Events are tracked through the `PromptModeManager.trackEvent()` method.

## Event Types

### Debugger Events

```typescript
// When analyzing an error
modeManager.trackEvent({
  type: 'debugger:error-analyzed',
  errorType: 'TypeError' // or 'ReferenceError', 'SyntaxError', etc.
});

// When a bug is identified
modeManager.trackEvent({
  type: 'debugger:bug-found',
  severity: 'high' // 'critical', 'high', 'medium', or 'low'
});

// When a fix is applied
modeManager.trackEvent({
  type: 'debugger:fix-applied',
  success: true,
  timeToFix: 45000 // milliseconds from mode entry to fix
});
```

### Security Events

```typescript
// When a vulnerability is found
modeManager.trackEvent({
  type: 'security:vulnerability-found',
  severity: 'critical',
  vulnerabilityType: 'SQL Injection'
});

// When a security fix is applied
modeManager.trackEvent({
  type: 'security:fix-applied',
  vulnerabilityType: 'XSS'
});

// When a security audit is performed
modeManager.trackEvent({
  type: 'security:audit-performed',
  filesScanned: 42
});
```

### Reviewer Events

```typescript
// When a code review is performed
modeManager.trackEvent({
  type: 'reviewer:review-performed',
  filesReviewed: 3,
  linesReviewed: 450,
  timeSpent: 300000 // milliseconds
});

// When an issue is found
modeManager.trackEvent({
  type: 'reviewer:issue-found',
  severity: 'medium'
});

// When a suggestion is given
modeManager.trackEvent({
  type: 'reviewer:suggestion-given',
  category: 'performance'
});

// When positive feedback is given
modeManager.trackEvent({
  type: 'reviewer:positive-feedback',
  category: 'clean-code'
});
```

### Performance Events

```typescript
// When a bottleneck is found
modeManager.trackEvent({
  type: 'performance:bottleneck-found',
  category: 'database-query'
});

// When an optimization is applied
modeManager.trackEvent({
  type: 'performance:optimization-applied',
  category: 'caching',
  improvement: 45.5 // percentage improvement
});

// When a benchmark is run
modeManager.trackEvent({
  type: 'performance:benchmark-run',
  metric: 'response-time',
  value: 125 // milliseconds
});

// When a performance profile is generated
modeManager.trackEvent({
  type: 'performance:profile-generated',
  profileType: 'cpu'
});
```

### Planning Events

```typescript
// When a plan is created
modeManager.trackEvent({
  type: 'planning:plan-created',
  planType: 'feature-implementation'
});

// When a research query is run
modeManager.trackEvent({
  type: 'planning:research-query',
  query: 'best practices for authentication'
});

// When a file is analyzed
modeManager.trackEvent({
  type: 'planning:file-analyzed',
  filePath: 'src/auth/authController.ts'
});

// When a design document is created
modeManager.trackEvent({
  type: 'planning:design-created',
  designType: 'architecture'
});

// When an architecture diagram is created
modeManager.trackEvent({
  type: 'planning:architecture-diagram',
  diagramType: 'component-diagram'
});
```

### Developer Events

```typescript
// When a file is created
modeManager.trackEvent({
  type: 'developer:file-created',
  filePath: 'src/utils/helper.ts'
});

// When a file is modified
modeManager.trackEvent({
  type: 'developer:file-modified',
  filePath: 'src/main.ts',
  linesAdded: 25,
  linesRemoved: 10
});

// When a file is deleted
modeManager.trackEvent({
  type: 'developer:file-deleted',
  filePath: 'src/old/deprecated.ts'
});

// When a test is written
modeManager.trackEvent({
  type: 'developer:test-written',
  testType: 'unit'
});

// When a commit is created
modeManager.trackEvent({
  type: 'developer:commit-created',
  message: 'feat: add authentication system'
});

// When a refactoring is performed
modeManager.trackEvent({
  type: 'developer:refactoring-performed',
  refactoringType: 'extract-method'
});
```

### Prototype Events

```typescript
// When a prototype is created
modeManager.trackEvent({
  type: 'prototype:prototype-created',
  prototypeType: 'api-integration'
});

// When an experiment is run
modeManager.trackEvent({
  type: 'prototype:experiment-run',
  experimentType: 'performance-test',
  success: true
});

// When a prototype transitions to production
modeManager.trackEvent({
  type: 'prototype:transition-to-production',
  prototypeId: 'auth-spike-001'
});
```

### Teacher Events

```typescript
// When a concept is explained
modeManager.trackEvent({
  type: 'teacher:concept-explained',
  concept: 'closures',
  timeSpent: 180000 // milliseconds
});

// When an example is provided
modeManager.trackEvent({
  type: 'teacher:example-provided',
  exampleType: 'code-snippet'
});

// When a question is asked to check understanding
modeManager.trackEvent({
  type: 'teacher:question-asked',
  questionType: 'comprehension-check'
});

// When an analogy is used
modeManager.trackEvent({
  type: 'teacher:analogy-used',
  analogyType: 'real-world'
});

// When a tutorial is suggested
modeManager.trackEvent({
  type: 'teacher:tutorial-suggested',
  tutorialTopic: 'async-await'
});
```

### Tool Events

```typescript
// When a tool is executed
modeManager.trackEvent({
  type: 'tool:tool-executed',
  toolName: 'read_file',
  success: true,
  executionTime: 45 // milliseconds
});
```

## Integration Points

### In Tool Execution

When tools are executed, track relevant events:

```typescript
// In tool execution handler
async function executeTool(toolName: string, args: any) {
  const startTime = Date.now();
  
  try {
    const result = await tool.execute(args);
    
    // Track successful execution
    modeManager.trackEvent({
      type: 'tool:tool-executed',
      toolName,
      success: true,
      executionTime: Date.now() - startTime
    });
    
    // Track mode-specific events based on tool and mode
    if (modeManager.getCurrentMode() === 'developer') {
      if (toolName === 'write_file') {
        modeManager.trackEvent({
          type: 'developer:file-created',
          filePath: args.path
        });
      }
    }
    
    return result;
  } catch (error) {
    // Track failed execution
    modeManager.trackEvent({
      type: 'tool:tool-executed',
      toolName,
      success: false,
      executionTime: Date.now() - startTime
    });
    
    throw error;
  }
}
```

### In Mode-Specific Logic

Track events when mode-specific actions occur:

```typescript
// In debugger mode logic
if (currentMode === 'debugger') {
  // Analyze error
  const errorType = analyzeError(errorMessage);
  modeManager.trackEvent({
    type: 'debugger:error-analyzed',
    errorType
  });
  
  // If bug found
  if (bugIdentified) {
    modeManager.trackEvent({
      type: 'debugger:bug-found',
      severity: determineSeverity(bug)
    });
  }
  
  // When fix is applied
  const fixStartTime = modeEntryTime;
  const fixEndTime = Date.now();
  modeManager.trackEvent({
    type: 'debugger:fix-applied',
    success: true,
    timeToFix: fixEndTime - fixStartTime
  });
}
```

## Retrieving Metrics

### Get All Metrics

```typescript
const metrics = modeManager.getMetricsTracker().getMetrics();
console.log('Total bugs fixed:', metrics.debuggerMetrics.fixesApplied);
console.log('Success rate:', metrics.debuggerMetrics.successRate);
```

### Get Mode-Specific Summary

```typescript
const debuggerSummary = modeManager.getMetricsTracker()
  .getModeSpecificSummary('debugger');
console.log(debuggerSummary);
// {
//   errorsAnalyzed: 15,
//   bugsFound: 12,
//   fixesApplied: 10,
//   successRate: '83.3%',
//   averageTimeToFix: '45.2s'
// }
```

### Get Productivity Summary

```typescript
const productivity = modeManager.getMetricsTracker()
  .getProductivitySummary();
console.log('Total files changed:', productivity.totalFiles);
console.log('Total bugs fixed:', productivity.totalBugsFixed);
```

### Get Session Summary

```typescript
const session = modeManager.getMetricsTracker()
  .getSessionSummary();
console.log('Session duration:', session.duration);
console.log('Most used mode:', session.mostUsedMode);
```

## Persistence

Metrics are automatically persisted to disk:

```typescript
// Save metrics
modeManager.getMetricsTracker().saveMetricsToDisk();
// Saves to ~/.ollm/metrics/mode-metrics.json

// Load metrics
modeManager.getMetricsTracker().loadMetricsFromDisk();
// Loads from ~/.ollm/metrics/mode-metrics.json

// Clear persisted metrics
modeManager.getMetricsTracker().clearPersistedMetrics();
```

## Best Practices

1. **Track events immediately**: Track events as soon as they occur, not in batches
2. **Be specific**: Use descriptive error types, categories, and names
3. **Include context**: Provide relevant metadata (file paths, durations, etc.)
4. **Don't over-track**: Only track meaningful events that provide insights
5. **Handle errors**: Wrap tracking calls in try-catch to prevent failures from breaking functionality

## Example: Complete Debugging Session

```typescript
// User enters debugger mode
// (automatically tracked by PromptModeManager)

// Analyze the error
modeManager.trackEvent({
  type: 'debugger:error-analyzed',
  errorType: 'TypeError'
});

// Identify the bug
modeManager.trackEvent({
  type: 'debugger:bug-found',
  severity: 'high'
});

// Apply the fix
const modeEntryTime = /* get from mode manager */;
modeManager.trackEvent({
  type: 'debugger:fix-applied',
  success: true,
  timeToFix: Date.now() - modeEntryTime
});

// Switch back to developer mode
// (automatically tracked by PromptModeManager)

// View metrics
const summary = modeManager.getMetricsTracker()
  .getModeSpecificSummary('debugger');
console.log('Debugger metrics:', summary);
```
