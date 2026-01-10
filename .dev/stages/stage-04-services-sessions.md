# Stage 04: Services and Sessions

## Overview
Persist sessions and enable resume. Manage context size and prevent runaway loops. Provide safe environment sanitization for shell tools.

## Prerequisites
- Stage 02 complete (core runtime)

## Estimated Effort
3-4 days

## Can Run Parallel With
- Stage 03 (Tool System and Policy)

## Data Locations
- User data: `~/.ollm/`
- Workspace data: `.ollm/`
- Sessions: `~/.ollm/session-data/`

---

## Tasks

### S04-T01: Session Recording

**Context**: Store session history for resume and export.

**Steps**:
1. Implement `ChatRecordingService`:
   - `recordMessage(sessionId, message): void`
   - `recordToolCall(sessionId, toolCall, result): void`
   - `getSession(sessionId): Session`
   - `listSessions(): SessionSummary[]`
   - `deleteSession(sessionId): void`
2. Save sessions under `~/.ollm/session-data/`
3. Define JSON format:
   ```json
   {
     "sessionId": "uuid",
     "startTime": "ISO8601",
     "model": "model-name",
     "messages": [],
     "toolCalls": []
   }
   ```
4. Implement session resume logic

**Deliverables**:
- `packages/core/src/services/chatRecordingService.ts`

**Acceptance Criteria**:
- Sessions can be resumed and listed
- Session data persists across CLI restarts

---

### S04-T02: Chat Compression

**Context**: Maintain context size within model limits.

**Steps**:
1. Implement `ChatCompressionService`:
   - `compress(messages, options): CompressedMessages`
   - `shouldCompress(messages, tokenLimit): boolean`
2. Compression strategies:
   - **Summarize**: Use model to create summary of older messages
   - **Truncate**: Remove oldest messages
   - **Hybrid**: Summarize old, keep recent intact
3. Trigger when token usage exceeds configurable threshold (default: 80%)
4. Preserve system prompt and recent N messages

**Deliverables**:
- `packages/core/src/services/chatCompressionService.ts`

**Acceptance Criteria**:
- Compression replaces older history with a summary
- Recent messages are preserved
- Compression triggers automatically at threshold

---

### S04-T03: Loop Detection

**Context**: Prevent infinite loops in tool calling.

**Steps**:
1. Implement `LoopDetectionService`:
   - Track repeated outputs (exact or similar)
   - Count consecutive tool calls
   - Monitor turn count
2. Detection criteria:
   - Same tool called N times with same args
   - Same output repeated N times
   - Turn count exceeds limit
3. Expose configuration:
   - `maxTurns`: Maximum turns per conversation (default: 50)
   - `repeatThreshold`: Repeated output count (default: 3)
4. Emit loop event when conditions met

**Deliverables**:
- `packages/core/src/services/loopDetectionService.ts`

**Acceptance Criteria**:
- Runtime stops and emits loop event when conditions met
- Configuration is respected
- User is notified of loop detection

---

### S04-T04: Context Manager

**Context**: Provide just-in-time context injection.

**Steps**:
1. Implement `ContextManager`:
   - `addContext(key, content, options): void`
   - `removeContext(key): void`
   - `getContext(): ContextEntry[]`
   - `getSystemPromptAdditions(): string`
2. Context sources:
   - Hooks can add context
   - Extensions can add context
   - User can add via commands
3. Context is included in system prompt for every turn
4. Support context priorities and ordering

**Deliverables**:
- `packages/core/src/services/contextManager.ts`

**Acceptance Criteria**:
- Context is included in system prompt
- Multiple sources can contribute context
- Context can be added/removed dynamically

---

### S04-T05: File Discovery

**Context**: Fast project scanning for tools and context.

**Steps**:
1. Implement `FileDiscoveryService`:
   - `discover(root, options): FileEntry[]`
   - `watchChanges(root, callback): Disposable`
2. Fast directory traversal:
   - Use async iteration
   - Respect depth limits
3. Ignore patterns:
   - Read `.ollmignore`
   - Read `.gitignore`
   - Built-in ignores (node_modules, .git, etc.)
4. Cache results for performance

**Deliverables**:
- `packages/core/src/services/fileDiscoveryService.ts`

**Acceptance Criteria**:
- File discovery returns consistent, filtered results
- Ignore patterns are respected
- Performance is acceptable for large projects

---

### S04-T06: Environment Sanitization

**Context**: Prevent secrets from leaking to tools.

**Steps**:
1. Implement sanitization service:
   - Allow list: Variables always passed (PATH, HOME, etc.)
   - Deny list: Variables never passed (API keys, tokens)
   - Pattern-based redaction
2. Default deny patterns:
   - `*_KEY`, `*_SECRET`, `*_TOKEN`
   - `*_PASSWORD`, `*_CREDENTIAL`
   - `AWS_*`, `GITHUB_*`
3. Always allow core variables:
   - `PATH`, `HOME`, `USER`, `SHELL`
   - `TERM`, `LANG`, `LC_*`
4. Configuration for custom rules

**Deliverables**:
- `packages/core/src/services/environmentSanitization.ts`

**Acceptance Criteria**:
- Sensitive variables are removed from tool environments
- Core variables are preserved
- Custom rules can be configured

---

## File Structure After Stage 04

```
packages/core/src/services/
├── chatRecordingService.ts
├── chatCompressionService.ts
├── loopDetectionService.ts
├── contextManager.ts
├── fileDiscoveryService.ts
└── environmentSanitization.ts
```

---

## Session File Format

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2024-01-15T10:30:00Z",
  "lastActivity": "2024-01-15T11:45:00Z",
  "model": "llama3.1:8b",
  "provider": "ollama",
  "messages": [
    {
      "role": "user",
      "parts": [{ "type": "text", "text": "Hello" }],
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "role": "assistant",
      "parts": [{ "type": "text", "text": "Hi there!" }],
      "timestamp": "2024-01-15T10:30:05Z"
    }
  ],
  "toolCalls": [
    {
      "id": "call_123",
      "name": "read_file",
      "args": { "path": "README.md" },
      "result": { "llmContent": "...", "returnDisplay": "..." },
      "timestamp": "2024-01-15T10:35:00Z"
    }
  ],
  "metadata": {
    "tokenCount": 1234,
    "compressionCount": 0
  }
}
```

---

## Configuration Example

```yaml
services:
  session:
    dataDir: ~/.ollm/session-data
    maxSessions: 100
    autoSave: true
    
  compression:
    enabled: true
    threshold: 0.8
    strategy: hybrid
    preserveRecent: 4096
    
  loopDetection:
    enabled: true
    maxTurns: 50
    repeatThreshold: 3
    
  environment:
    allowList:
      - PATH
      - HOME
      - USER
    denyPatterns:
      - "*_KEY"
      - "*_SECRET"
```

---

## Verification Checklist

- [ ] Sessions save and load correctly
- [ ] Session list shows all sessions
- [ ] Session resume restores conversation
- [ ] Compression triggers at threshold
- [ ] Compression preserves recent messages
- [ ] Loop detection stops runaway loops
- [ ] Context manager injects context
- [ ] File discovery respects ignores
- [ ] Environment sanitization removes secrets
