# How OLLM CLI Uses Hooks

**Complete Guide to Hook Architecture and Execution Flow**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Hook Lifecycle](#hook-lifecycle)
4. [Event System](#event-system)
5. [Hook Execution Flow](#hook-execution-flow)
6. [Hook Types and Events](#hook-types-and-events)
7. [Security and Trust](#security-and-trust)
8. [Integration Points](#integration-points)
9. [Examples](#examples)

---

## Overview

OLLM CLI uses a **event-driven hook system** that allows custom code to run at specific points during LLM execution. The system is built on three core concepts:

1. **Events** - Things that happen during execution (e.g., "before agent runs", "after tool executes")
2. **Hooks** - Executable scripts that respond to events
3. **Message Bus** - Event distribution system that connects events to hooks

### Key Benefits

- **Extensibility** - Add custom behavior without modifying core code
- **Safety** - Hooks run in isolated processes with timeout and trust controls
- **Flexibility** - Hooks can validate, modify, or abort operations
- **Observability** - Hooks provide visibility into execution flow

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        OLLM CLI Application                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Core Execution Flow                      │ │
│  │                                                             │ │
│  │  Agent → Model → Tool Selection → Tool Execution           │ │
│  │    ↓       ↓            ↓                ↓                 │ │
│  │  Events emitted at each stage...                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Message Bus                            │ │
│  │                                                             │ │
│  │  • Receives events from core execution                     │ │
│  │  • Distributes events to subscribers                       │ │
│  │  • Maintains event queue                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Hook Event Handler                         │ │
│  │                                                             │ │
│  │  • Subscribes to all hook events                           │ │
│  │  • Looks up registered hooks for each event                │ │
│  │  • Delegates execution to Hook Runner                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Hook Registry                           │ │
│  │                                                             │ │
│  │  • Stores registered hooks by event type                   │ │
│  │  • Provides hook lookup by event                           │ │
│  │  • Maintains hook metadata                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Hook Planner                           │ │
│  │                                                             │ │
│  │  • Determines execution order                              │ │
│  │  • Prioritizes by source (builtin > user > workspace)      │ │
│  │  • Creates execution plan                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Hook Runner                            │ │
│  │                                                             │ │
│  │  • Spawns hook processes                                   │ │
│  │  • Manages stdin/stdout communication                      │ │
│  │  • Enforces timeouts and security                          │ │
│  │  • Handles errors and retries                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Hook Process (External)                  │ │
│  │                                                             │ │
│  │  • Receives event data via stdin (JSON)                    │ │
│  │  • Processes event (custom logic)                          │ │
│  │  • Returns response via stdout (JSON)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Response Processing                      │ │
│  │                                                             │ │
│  │  • Parse hook output                                       │ │
│  │  • Check continue flag                                     │ │
│  │  • Collect system messages                                 │ │
│  │  • Aggregate data for next hook                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Continue or Abort Execution                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Message Bus** (`packages/core/src/hooks/messageBus.ts`)
- **Purpose:** Event distribution system
- **Responsibilities:**
  - Emit events from core execution
  - Manage event subscribers
  - Maintain event queue
  - Provide pub/sub interface

#### 2. **Hook Registry** (`packages/core/src/hooks/hookRegistry.ts`)
- **Purpose:** Hook storage and lookup
- **Responsibilities:**
  - Register hooks by event type
  - Retrieve hooks for specific events
  - Manage hook metadata
  - Support hook CRUD operations

#### 3. **Hook Event Handler** (`packages/core/src/hooks/hookEventHandler.ts`)
- **Purpose:** Bridge between events and hook execution
- **Responsibilities:**
  - Subscribe to all hook events on Message Bus
  - Look up registered hooks for each event
  - Delegate execution to Hook Runner
  - Aggregate results from multiple hooks

#### 4. **Hook Planner** (`packages/core/src/hooks/hookPlanner.ts`)
- **Purpose:** Determine hook execution order
- **Responsibilities:**
  - Order hooks by source priority
  - Create execution plans
  - Support sequential/parallel execution

#### 5. **Hook Runner** (`packages/core/src/hooks/hookRunner.ts`)
- **Purpose:** Execute hooks safely
- **Responsibilities:**
  - Spawn hook processes
  - Manage stdin/stdout communication
  - Enforce timeouts
  - Handle errors
  - Check trust/approval

#### 6. **Hook Translator** (`packages/core/src/hooks/hookTranslator.ts`)
- **Purpose:** Format data for hooks
- **Responsibilities:**
  - Serialize input to JSON
  - Parse output from JSON
  - Structure event-specific data
  - Validate hook responses

#### 7. **Trusted Hooks** (`packages/core/src/hooks/trustedHooks.ts`)
- **Purpose:** Security and trust management
- **Responsibilities:**
  - Check if hooks are trusted
  - Request user approval
  - Store approval records
  - Compute hook hashes

---

## Hook Lifecycle

### 1. Registration Phase (Startup)

```
App Startup
    ↓
Load hooks from JSON files
    ├─ ~/.ollm/hooks/*.json (user hooks)
    └─ .ollm/hooks/*.json (workspace hooks)
    ↓
Convert UIHooks to Core Hooks
    ├─ Map UI event types to core events
    └─ Build command strings
    ↓
Register in Hook Registry
    ├─ Group by event type
    └─ Store metadata
    ↓
Start Hook Event Handler
    ├─ Subscribe to all hook events
    └─ Ready to execute hooks
```

### 2. Execution Phase (Runtime)

```
Core Execution Flow
    ↓
Event occurs (e.g., before_agent)
    ↓
Emit event to Message Bus
    ├─ Event type: "before_agent"
    └─ Event data: { prompt, context, ... }
    ↓
Message Bus notifies subscribers
    ↓
Hook Event Handler receives event
    ↓
Look up hooks in Registry
    ├─ Get all hooks for "before_agent"
    └─ Found: [hook1, hook2, hook3]
    ↓
Hook Planner creates execution plan
    ├─ Order by source priority
    └─ Plan: [builtin_hook, user_hook, workspace_hook]
    ↓
Hook Runner executes each hook
    ├─ Check trust/approval
    ├─ Spawn process
    ├─ Send input via stdin
    ├─ Wait for output via stdout
    ├─ Parse response
    └─ Check continue flag
    ↓
Aggregate results
    ├─ Collect system messages
    ├─ Merge data
    └─ Determine if should continue
    ↓
Return to core execution
    ├─ If continue: true → proceed
    └─ If continue: false → abort
```

### 3. Hook Process Execution

```
Hook Process Spawned
    ↓
Receive input via stdin
    ├─ JSON format
    └─ Contains: { event, data }
    ↓
Parse input
    ↓
Execute custom logic
    ├─ Validate data
    ├─ Perform checks
    ├─ Make decisions
    └─ Generate output
    ↓
Return response via stdout
    ├─ JSON format
    └─ Contains: { continue, message, data }
    ↓
Process exits
```

---

## Event System

### Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Execution Timeline                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  session_start                                              │
│      ↓                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User submits prompt                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│      ↓                                                      │
│  before_agent                                               │
│      ↓                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Agent processes prompt                              │   │
│  └─────────────────────────────────────────────────────┘   │
│      ↓                                                      │
│  before_model                                               │
│      ↓                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Model generates response                            │   │
│  └─────────────────────────────────────────────────────┘   │
│      ↓                                                      │
│  after_model                                                │
│      ↓                                                      │
│  before_tool_selection                                      │
│      ↓                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Select tools to execute                             │   │
│  └─────────────────────────────────────────────────────┘   │
│      ↓                                                      │
│  before_tool (for each tool)                                │
│      ↓                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Execute tool                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│      ↓                                                      │
│  after_tool (for each tool)                                 │
│      ↓                                                      │
│  after_agent                                                │
│      ↓                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Return response to user                             │   │
│  └─────────────────────────────────────────────────────┘   │
│      ↓                                                      │
│  session_end                                                │
│                                                             │
│  Special Events:                                            │
│  • pre_compress - Before context compression                │
│  • post_compress - After context compression                │
│  • notification - General notifications                     │
└─────────────────────────────────────────────────────────────┘
```

### Event Types and Data

#### 1. **session_start**
**When:** Session begins  
**Data:**
```json
{
  "sessionId": "session-123",
  "user": "username",
  "timestamp": "2026-01-18T10:00:00Z"
}
```

#### 2. **session_end**
**When:** Session ends  
**Data:**
```json
{
  "sessionId": "session-123",
  "duration": 3600000,
  "messageCount": 42
}
```

#### 3. **before_agent**
**When:** Before agent processes prompt  
**Data:**
```json
{
  "prompt": "User's prompt text",
  "context": { "files": [...], "history": [...] },
  "sessionId": "session-123"
}
```

#### 4. **after_agent**
**When:** After agent generates response  
**Data:**
```json
{
  "prompt": "User's prompt text",
  "response": "Agent's response",
  "toolCalls": [...],
  "sessionId": "session-123"
}
```

#### 5. **before_model**
**When:** Before model generates response  
**Data:**
```json
{
  "model": "llama3.2",
  "messages": [...],
  "sessionId": "session-123"
}
```

#### 6. **after_model**
**When:** After model generates response  
**Data:**
```json
{
  "model": "llama3.2",
  "response": "Model response",
  "tokens": 150,
  "duration": 2500
}
```

#### 7. **before_tool_selection**
**When:** Before selecting tools to execute  
**Data:**
```json
{
  "availableTools": ["readFile", "writeFile", "shell"],
  "context": {...}
}
```

#### 8. **before_tool**
**When:** Before executing a tool  
**Data:**
```json
{
  "toolName": "readFile",
  "args": { "path": "file.txt" },
  "sessionId": "session-123"
}
```

#### 9. **after_tool**
**When:** After executing a tool  
**Data:**
```json
{
  "toolName": "readFile",
  "args": { "path": "file.txt" },
  "result": "File contents...",
  "duration": 50
}
```

#### 10. **pre_compress**
**When:** Before context compression  
**Data:**
```json
{
  "contextSize": 8000,
  "maxSize": 4096,
  "sessionId": "session-123"
}
```

#### 11. **post_compress**
**When:** After context compression  
**Data:**
```json
{
  "originalSize": 8000,
  "compressedSize": 3500,
  "compressionRatio": 0.4375
}
```

#### 12. **notification**
**When:** General notifications  
**Data:**
```json
{
  "type": "info|warning|error",
  "message": "Notification message",
  "data": {...}
}
```

---

## Hook Execution Flow

### Sequential Execution (Default)

```
Event: before_agent
    ↓
Hooks: [builtin_hook, user_hook, workspace_hook]
    ↓
Execute builtin_hook
    ├─ Input: { event: "before_agent", data: {...} }
    ├─ Output: { continue: true, data: { validated: true } }
    └─ Pass data to next hook
    ↓
Execute user_hook
    ├─ Input: { event: "before_agent", data: { validated: true, ... } }
    ├─ Output: { continue: true, systemMessage: "User hook executed" }
    └─ Pass data to next hook
    ↓
Execute workspace_hook
    ├─ Input: { event: "before_agent", data: { validated: true, ... } }
    ├─ Output: { continue: false, systemMessage: "Abort execution" }
    └─ Stop execution (continue: false)
    ↓
Aggregate results
    ├─ shouldContinue: false
    ├─ systemMessages: ["User hook executed", "Abort execution"]
    └─ aggregatedData: { validated: true }
    ↓
Return to core execution
    └─ Abort operation (continue: false)
```

### Parallel Execution (Optional)

```
Event: after_tool
    ↓
Hooks: [log_hook, notify_hook, metrics_hook]
    ↓
Execute all hooks in parallel
    ├─ log_hook → { continue: true, data: { logged: true } }
    ├─ notify_hook → { continue: true, data: { notified: true } }
    └─ metrics_hook → { continue: true, data: { recorded: true } }
    ↓
Wait for all to complete
    ↓
Aggregate results
    ├─ shouldContinue: true (all returned true)
    ├─ systemMessages: []
    └─ aggregatedData: { logged: true, notified: true, recorded: true }
    ↓
Return to core execution
    └─ Continue operation
```

---

## Hook Types and Events

### UI Event Types → Core Event Types Mapping

The hooks we created use UI-friendly event types that map to core event types:

```typescript
const UI_TO_CORE_EVENT_MAP = {
  'fileEdited': 'before_tool',      // File edits trigger before tool execution
  'fileCreated': 'before_tool',     // File creation triggers before tool execution
  'fileDeleted': 'before_tool',     // File deletion triggers before tool execution
  'userTriggered': 'notification',  // Manual triggers use notification event
  'promptSubmit': 'before_agent',   // Prompt submission triggers before agent
  'agentStop': 'after_agent',       // Agent completion triggers after agent
};
```

### Our Hooks

#### 1. **Debug Test Runner**
- **UI Event:** `fileEdited`
- **Core Event:** `before_tool`
- **Trigger:** When `.ts`, `.tsx`, `.js`, `.jsx` files are saved
- **Action:** `askAgent` - Asks agent to run relevant tests
- **Flow:**
  ```
  File saved → before_tool event → Hook executes →
  Agent runs tests → Results displayed
  ```

#### 2. **Security Check: Dangerous Commands**
- **UI Event:** `promptSubmit`
- **Core Event:** `before_agent`
- **Trigger:** When any prompt is submitted
- **Action:** `askAgent` - Asks agent to validate commands
- **Flow:**
  ```
  Prompt submitted → before_agent event → Hook executes →
  Agent checks for dangerous commands → Warns if found →
  User confirms or cancels
  ```

#### 3. **Auto Format on Save**
- **UI Event:** `fileEdited`
- **Core Event:** `before_tool`
- **Trigger:** When code files are saved
- **Action:** `runCommand` - Runs Prettier directly
- **Flow:**
  ```
  File saved → before_tool event → Hook executes →
  Prettier formats file → File updated
  ```

---

## Security and Trust

### Trust Levels

Hooks have different trust levels based on their source:

#### 1. **Builtin Hooks** (source: `builtin`)
- **Trust:** Always trusted
- **Approval:** Never required
- **Execution:** Automatic
- **Example:** System hooks, core functionality

#### 2. **User Hooks** (source: `user`)
- **Trust:** Trusted by default
- **Approval:** Not required
- **Execution:** Automatic
- **Location:** `~/.ollm/hooks/`

#### 3. **Workspace Hooks** (source: `workspace`)
- **Trust:** Requires approval first time
- **Approval:** Required on first use
- **Execution:** After approval
- **Location:** `.ollm/hooks/`

#### 4. **Downloaded Hooks** (source: `downloaded`)
- **Trust:** Never trusted
- **Approval:** Required every time
- **Execution:** After approval each time
- **Location:** Extensions, marketplace

### Trust Checking Flow

```
Hook execution requested
    ↓
Check trust level
    ├─ builtin → Execute immediately
    ├─ user → Execute immediately
    ├─ workspace → Check if approved
    │   ├─ Approved → Execute
    │   └─ Not approved → Request approval
    │       ├─ User approves → Store approval → Execute
    │       └─ User denies → Skip hook
    └─ downloaded → Request approval
        ├─ User approves → Execute (don't store)
        └─ User denies → Skip hook
```

### Security Features

1. **Process Isolation**
   - Hooks run in separate processes
   - No direct access to app memory
   - Communication only via stdin/stdout

2. **Timeout Enforcement**
   - Default: 30 seconds
   - Configurable per hook
   - Force kill after grace period

3. **Command Validation**
   - No shell metacharacters allowed
   - Must be absolute path or whitelisted command
   - Whitelist: `node`, `python`, `bash`, `sh`, `npx`, `uvx`

4. **Output Size Limits**
   - Max output: 1MB
   - Prevents memory exhaustion
   - Kills process if exceeded

5. **Error Isolation**
   - Hook errors don't crash app
   - Errors logged and returned
   - Execution continues with remaining hooks

---

## Integration Points

### Where Hooks Are Triggered

#### 1. **Chat Service** (`packages/core/src/services/chatService.ts`)
```typescript
// Before processing prompt
messageBus.emit('before_agent', {
  prompt: userPrompt,
  context: currentContext,
  sessionId: session.id
});

// After agent response
messageBus.emit('after_agent', {
  prompt: userPrompt,
  response: agentResponse,
  toolCalls: extractedToolCalls,
  sessionId: session.id
});
```

#### 2. **Tool Execution** (`packages/core/src/tools/tool-registry.ts`)
```typescript
// Before tool execution
messageBus.emit('before_tool', {
  toolName: tool.name,
  args: toolArgs,
  sessionId: session.id
});

// After tool execution
messageBus.emit('after_tool', {
  toolName: tool.name,
  args: toolArgs,
  result: toolResult,
  duration: executionTime
});
```

#### 3. **Context Compression** (`packages/core/src/context/compressionService.ts`)
```typescript
// Before compression
messageBus.emit('pre_compress', {
  contextSize: currentSize,
  maxSize: maxContextSize,
  sessionId: session.id
});

// After compression
messageBus.emit('post_compress', {
  originalSize: originalSize,
  compressedSize: newSize,
  compressionRatio: ratio
});
```

#### 4. **Session Management** (`packages/core/src/services/sessionService.ts`)
```typescript
// Session start
messageBus.emit('session_start', {
  sessionId: session.id,
  user: currentUser,
  timestamp: new Date().toISOString()
});

// Session end
messageBus.emit('session_end', {
  sessionId: session.id,
  duration: sessionDuration,
  messageCount: messages.length
});
```

---

## Examples

### Example 1: Validation Hook

**Scenario:** Validate that file operations don't modify system files

**Hook Implementation:**
```bash
#!/bin/bash
# validate-file-ops.sh

# Read input from stdin
input=$(cat)

# Extract tool name and args
tool=$(echo "$input" | jq -r '.data.toolName')
args=$(echo "$input" | jq -r '.data.args')

# Check if tool is file operation
if [[ "$tool" == "writeFile" ]] || [[ "$tool" == "deleteFile" ]]; then
  # Extract file path
  path=$(echo "$args" | jq -r '.path')
  
  # Check if path is in system directory
  if [[ "$path" == /etc/* ]] || [[ "$path" == /sys/* ]]; then
    # Block operation
    echo '{"continue": false, "systemMessage": "Blocked: Cannot modify system files"}'
    exit 0
  fi
fi

# Allow operation
echo '{"continue": true}'
```

**Hook Registration:**
```json
{
  "name": "Validate File Operations",
  "version": "1.0.0",
  "description": "Prevents modification of system files",
  "when": {
    "type": "fileEdited"
  },
  "then": {
    "type": "runCommand",
    "command": "./validate-file-ops.sh"
  }
}
```

**Execution Flow:**
```
User: "Delete /etc/passwd"
    ↓
Agent plans to execute deleteFile tool
    ↓
before_tool event emitted
    ↓
validate-file-ops.sh hook executes
    ├─ Receives: { toolName: "deleteFile", args: { path: "/etc/passwd" } }
    ├─ Detects system file
    └─ Returns: { continue: false, systemMessage: "Blocked: Cannot modify system files" }
    ↓
Hook Runner receives response
    ├─ continue: false → Abort operation
    └─ systemMessage added to chat
    ↓
Agent: "I cannot delete /etc/passwd as it's a system file."
```

### Example 2: Logging Hook

**Scenario:** Log all tool executions to a file

**Hook Implementation:**
```javascript
// log-tool-execution.js
const fs = require('fs');
const path = require('path');

// Read input from stdin
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  const data = JSON.parse(input);
  
  // Extract tool info
  const toolName = data.data.toolName;
  const args = data.data.args;
  const timestamp = new Date().toISOString();
  
  // Create log entry
  const logEntry = `${timestamp} - ${toolName} - ${JSON.stringify(args)}\n`;
  
  // Append to log file
  const logPath = path.join(process.env.HOME, '.ollm', 'tool-execution.log');
  fs.appendFileSync(logPath, logEntry);
  
  // Return success
  console.log(JSON.stringify({
    continue: true,
    data: { logged: true }
  }));
});
```

**Hook Registration:**
```json
{
  "name": "Log Tool Execution",
  "version": "1.0.0",
  "description": "Logs all tool executions to a file",
  "when": {
    "type": "fileEdited"
  },
  "then": {
    "type": "runCommand",
    "command": "node ./log-tool-execution.js"
  }
}
```

### Example 3: Notification Hook

**Scenario:** Send Slack notification when errors occur

**Hook Implementation:**
```python
#!/usr/bin/env python3
# notify-error.py
import sys
import json
import requests

# Read input from stdin
input_data = json.load(sys.stdin)

# Extract error info
error = input_data['data'].get('error', 'Unknown error')
session_id = input_data['data'].get('sessionId', 'unknown')

# Send to Slack
webhook_url = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
message = {
    'text': f'Error in session {session_id}: {error}'
}

try:
    response = requests.post(webhook_url, json=message)
    response.raise_for_status()
    
    # Return success
    print(json.dumps({
        'continue': True,
        'data': { 'notified': True }
    }))
except Exception as e:
    # Return error but continue
    print(json.dumps({
        'continue': True,
        'error': str(e)
    }))
```

---

## Summary

### How It All Works Together

1. **Startup:**
   - Load hooks from JSON files
   - Register in Hook Registry
   - Start Hook Event Handler
   - Subscribe to all events

2. **Runtime:**
   - Core execution emits events
   - Message Bus distributes events
   - Hook Event Handler receives events
   - Hook Runner executes hooks
   - Results aggregated and returned

3. **Hook Execution:**
   - Check trust/approval
   - Spawn process
   - Send input via stdin
   - Receive output via stdout
   - Parse response
   - Check continue flag

4. **Security:**
   - Process isolation
   - Timeout enforcement
   - Command validation
   - Output size limits
   - Error isolation

### Key Takeaways

- ✅ Hooks are event-driven
- ✅ Hooks run in isolated processes
- ✅ Hooks can validate, modify, or abort operations
- ✅ Hooks are ordered by source priority
- ✅ Hooks communicate via JSON stdin/stdout
- ✅ Hooks have trust levels and approval requirements
- ✅ Hooks are safe and secure by design

---

**Created:** January 18, 2026  
**Author:** Kiro AI Assistant  
**Version:** 1.0.0
