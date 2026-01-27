# Sessions, Snapshots, and Chat History System

**Last Updated:** January 27, 2026  
**Status:** Source of Truth

**Related Documents:**
- `dev_ContextCompression.md` - Compression triggers and checkpoint system
- `dev_ContextManagement.md` - Context sizing and VRAM management
- `dev_Tokeniser.md` - Token counting for sessions
- `dev_PromptSystem.md` - System prompts in sessions

---

## Overview

The Sessions, Snapshots, and Chat History system provides three distinct but complementary mechanisms for preserving conversation data:

1. **Sessions** - Full, uncompressed chat history saved to disk
2. **Snapshots** - Point-in-time context state for recovery and rollback
3. **Compression** - In-memory optimization for LLM efficiency

**Core Principle:** Compression only affects what's sent to the LLM, not what's saved to disk.

---

## Architecture

### Three-Layer Storage Model

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTIVE CONTEXT (Memory)                   │
│  ┌────────────┬──────────────┬─────────────┬──────────────┐ │
│  │ System     │ Checkpoints  │ User        │ Recent       │ │
│  │ Prompt     │ (Compressed) │ Messages    │ Messages     │ │
│  │ (500 tok)  │ (2000 tok)   │ (Never      │ (Not yet     │ │
│  │            │              │ compressed) │ compressed)  │ │
│  └────────────┴──────────────┴─────────────┴──────────────┘ │
│  Sent to LLM with each message (compressed for efficiency)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  SNAPSHOTS (Disk - Recovery)                 │
│  ┌──────────────────────────────────────────────────────────┤
│  │ snapshot-abc123.json                                     │
│  │ ├─ Timestamp: 2026-01-27T10:30:00Z                      │
│  │ ├─ Token count: 8500                                    │
│  │ ├─ User messages: ALL (never truncated)                │
│  │ ├─ Other messages: system, assistant, tool             │
│  │ ├─ Goal stack: active goals and checkpoints            │
│  │ └─ Reasoning storage: thinking traces                  │
│  └──────────────────────────────────────────────────────────┤
│  Created at 85% context usage (before compression)          │
│  Used for: Recovery, rollback, debugging                    │
│  Location: ~/.ollm/context-snapshots/{sessionId}/           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              FULL SESSION HISTORY (Disk - Archive)           │
│  ┌──────────────────────────────────────────────────────────┤
│  │ {sessionId}.json                                         │
│  │ ├─ ALL messages (uncompressed, complete)               │
│  │ ├─ ALL tool calls (with full results)                  │
│  │ ├─ Metadata: model, provider, token counts             │
│  │ ├─ Mode transitions: auto/manual switches              │
│  │ └─ Compression history: when/how compressed            │
│  └──────────────────────────────────────────────────────────┤
│  Never affected by compression                               │
│  Used for: Review, export, analysis, debugging              │
│  Location: ~/.ollm/sessions/{sessionId}.json                │
└─────────────────────────────────────────────────────────────┘
```

---

## Session System

### What is a Session?

A **session** is the complete, uncompressed record of a conversation from start to finish. It contains:

- **ALL messages** (user, assistant, system, tool) - never compressed
- **ALL tool calls** with full arguments and results
- **Metadata**: model, provider, token counts, compression history
- **Mode transitions**: when and why modes changed
- **Timestamps**: for every message and event

### Session Lifecycle

```
1. Session Created
   ↓
   sessionId = uuid()
   file = ~/.ollm/sessions/{sessionId}.json
   
2. Messages Recorded (Auto-save)
   ↓
   Every message → Append to session file
   Every tool call → Append to session file
   
3. Session Active
   ↓
   User continues conversation
   Compression may occur (doesn't affect session file)
   
4. Session Ends
   ↓
   Final save to disk
   Session remains available for review
   
5. Session Management
   ↓
   User can: List, View, Export, Delete
   Auto-cleanup: Keep last 100 sessions (configurable)
```

### Session File Structure

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2026-01-27T10:00:00Z",
  "lastActivity": "2026-01-27T11:30:00Z",
  "model": "llama3.2:3b",
  "provider": "ollama",
  "messages": [
    {
      "role": "user",
      "parts": [{ "type": "text", "text": "..." }],
      "timestamp": "2026-01-27T10:00:00Z"
    },
    {
      "role": "assistant",
      "parts": [{ "type": "text", "text": "..." }],
      "timestamp": "2026-01-27T10:00:15Z"
    }
  ],
  "toolCalls": [
    {
      "id": "call_123",
      "name": "read_file",
      "args": { "path": "file.ts" },
      "result": { "llmContent": "..." },
      "timestamp": "2026-01-27T10:00:20Z"
    }
  ],
  "metadata": {
    "tokenCount": 8500,
    "compressionCount": 2,
    "modeHistory": [
      {
        "from": "assistant",
        "to": "code",
        "timestamp": "2026-01-27T10:15:00Z",
        "trigger": "auto",
        "confidence": 0.95
      }
    ]
  }
}
```

### Session Storage Location

```
~/.ollm/sessions/
├── 550e8400-e29b-41d4-a716-446655440000.json
├── 660e8400-e29b-41d4-a716-446655440001.json
└── 770e8400-e29b-41d4-a716-446655440002.json
```

### Session Operations

**Create Session:**
```typescript
const sessionId = await chatRecordingService.createSession(model, provider);
```

**Record Message:**
```typescript
await chatRecordingService.recordMessage(sessionId, {
  role: 'user',
  parts: [{ type: 'text', text: 'Hello' }],
  timestamp: new Date().toISOString()
});
```

**Record Tool Call:**
```typescript
await chatRecordingService.recordToolCall(sessionId, {
  id: 'call_123',
  name: 'read_file',
  args: { path: 'file.ts' },
  result: { llmContent: '...' },
  timestamp: new Date().toISOString()
});
```

**List Sessions:**
```typescript
const sessions = await chatRecordingService.listSessions();
// Returns: [{ sessionId, startTime, lastActivity, model, messageCount, tokenCount }]
```

**Get Session:**
```typescript
const session = await chatRecordingService.getSession(sessionId);
// Returns: Full session with all messages and tool calls
```

**Delete Session:**
```typescript
await chatRecordingService.deleteSession(sessionId);
```

### Session Configuration

```typescript
interface ChatRecordingServiceConfig {
  dataDir?: string;        // Default: ~/.ollm/sessions
  maxSessions?: number;    // Default: 100
  autoSave?: boolean;      // Default: true
}
```

### Auto-Save Behavior

- **Enabled by default** (`autoSave: true`)
- Every message is immediately written to disk
- Every tool call is immediately written to disk
- Atomic writes with durability guarantees (fsync)
- No data loss even if app crashes

---

## Snapshot System

### What is a Snapshot?

A **snapshot** is a point-in-time capture of the conversation context, created for recovery and rollback purposes. Unlike sessions (which record everything), snapshots capture the **current state** of the context.

### When Snapshots are Created

**Automatic Triggers:**
1. **Before Compression** (default: 85% context usage)
   - Captures state before messages are compressed
   - Allows recovery if compression goes wrong
   - Configurable via `autoThreshold`

2. **Before Risky Operations**
   - Before major context changes
   - Before experimental features
   - Before mode transitions

**Manual Triggers:**
- User explicitly requests snapshot
- Via `/context snapshot` command
- Via API call

### Snapshot vs Session

| Feature | Snapshot | Session |
|---------|----------|---------|
| **Purpose** | Recovery, rollback | Complete history |
| **Trigger** | Automatic (85%) or manual | Continuous recording |
| **Content** | Current context state | ALL messages ever |
| **Compression** | Reflects current state | Never compressed |
| **User Messages** | ALL preserved in full | ALL preserved in full |
| **Location** | `~/.ollm/context-snapshots/` | `~/.ollm/sessions/` |
| **Cleanup** | Keep last 5 (configurable) | Keep last 100 |
| **Use Case** | "Undo" to this point | Review full conversation |

### Snapshot Structure

```typescript
interface ContextSnapshot {
  id: string;                    // Unique snapshot ID
  sessionId: string;             // Parent session ID
  timestamp: Date;               // When snapshot was created
  tokenCount: number;            // Total tokens at snapshot time
  summary: string;               // Human-readable summary
  
  // User messages (NEVER truncated)
  userMessages: Message[];       // ALL user messages in full
  archivedUserMessages: [];      // Empty (no archiving)
  
  // Other messages (system, assistant, tool)
  messages: Message[];           // Excludes user messages
  
  // Goal and reasoning state
  goalStack?: GoalStack;         // Active goals and checkpoints
  reasoningStorage?: ReasoningStorage;  // Thinking traces
  
  // Metadata
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
    totalUserMessages: number;
    activeGoalId?: string;
    totalGoalsCompleted?: number;
    totalCheckpoints?: number;
    isReasoningModel?: boolean;
    totalThinkingTokens?: number;
  };
}
```

### Snapshot Storage Location

```
~/.ollm/context-snapshots/
└── {sessionId}/
    └── snapshots/
        ├── snapshot-abc123.json
        ├── snapshot-def456.json
        ├── snapshot-ghi789.json
        └── snapshots-index.json  (metadata index)
```

### Snapshot Operations

**Create Snapshot:**
```typescript
const snapshot = await snapshotManager.createSnapshot(context);
// Automatically saves to disk
// Triggers rolling cleanup if maxCount exceeded
```

**Restore Snapshot:**
```typescript
const context = await snapshotManager.restoreSnapshot(snapshotId);
// Reconstructs full context from snapshot
// Handles both new and old snapshot formats
```

**List Snapshots:**
```typescript
const snapshots = await snapshotManager.listSnapshots(sessionId);
// Returns: Array of snapshots, newest first
```

**Delete Snapshot:**
```typescript
await snapshotManager.deleteSnapshot(snapshotId);
```

### Snapshot Configuration

```typescript
interface SnapshotConfig {
  enabled: boolean;        // Enable/disable snapshots
  maxCount: number;        // Max snapshots per session (default: 5)
  autoCreate: boolean;     // Auto-create at threshold (default: true)
  autoThreshold: number;   // Trigger threshold 0.0-1.0 (default: 0.85)
}
```

### Snapshot Triggers and Thresholds

```typescript
// Register threshold callback
snapshotManager.onContextThreshold(0.85, async () => {
  console.log('Context at 85%, creating snapshot...');
  await snapshotManager.createSnapshot(context);
});

// Register pre-overflow callback
snapshotManager.onBeforeOverflow(() => {
  console.warn('Context nearly full! Emergency snapshot needed');
});

// Check thresholds (called after each message)
snapshotManager.checkThresholds(currentTokens, maxTokens);
```

### Rolling Cleanup

When `maxCount` is exceeded, oldest snapshots are automatically deleted:

```
Snapshots (maxCount = 5):
├── snapshot-5 (newest) ✅ Keep
├── snapshot-4          ✅ Keep
├── snapshot-3          ✅ Keep
├── snapshot-2          ✅ Keep
├── snapshot-1          ✅ Keep
└── snapshot-0 (oldest) ❌ Delete
```

---

## Compression System Integration

### Compression Triggers

Compression is triggered at **80% of available budget** (not total context):

```
Available Budget = Ollama Limit - System Prompt - Checkpoints

Example (8K context):
├─ Ollama limit: 6963 tokens (85% of 8K)
├─ System prompt: 500 tokens
├─ Checkpoints: 0 tokens (initially)
└─ Available budget: 6463 tokens
   └─ Trigger at: 6463 * 0.80 = 5170 tokens
```

### Compression Flow with Snapshots

```
1. Context reaches 85% (5940 tokens)
   ↓
   Snapshot created automatically
   ↓
2. Context reaches 80% of available budget (5170 tokens)
   ↓
   Compression triggered
   ↓
3. Compression creates checkpoint
   ├─ Old messages → Compressed summary (2000 tokens)
   ├─ User messages → Preserved in full (never compressed)
   └─ Recent messages → Kept as-is
   ↓
4. New available budget calculated
   ├─ Ollama limit: 6963 tokens
   ├─ System prompt: 500 tokens
   ├─ Checkpoint 1: 2000 tokens
   └─ Available budget: 4463 tokens
      └─ Next trigger: 4463 * 0.80 = 3570 tokens
```

### What Gets Compressed?

**COMPRESSED (in active context):**
- ✅ Assistant messages (LLM output)
- ✅ Tool call results
- ✅ System messages (except current system prompt)

**NEVER COMPRESSED:**
- ❌ User messages (always preserved in full)
- ❌ Current system prompt
- ❌ Active goals and decisions
- ❌ Architecture decisions
- ❌ Locked decisions

**SAVED TO DISK (uncompressed):**
- ✅ Session file: ALL messages, ALL tool calls
- ✅ Snapshot file: Current context state
- ✅ User messages: ALWAYS in full

---

## User Access to Chat History

### Viewing Full History

Users can access the complete, uncompressed chat history at any time:

**Via CLI Commands:**
```bash
# List all sessions
ollm sessions list

# View specific session
ollm sessions view <sessionId>

# Export session to file
ollm sessions export <sessionId> --output chat-history.json

# Search sessions
ollm sessions search "keyword"
```

**Via UI:**
```
Chat Menu → History → View Full History
├─ Shows ALL messages (uncompressed)
├─ Shows ALL tool calls
├─ Shows timestamps
└─ Allows export to JSON/Markdown
```

### Deleting History

Users have full control over their data:

**Delete Single Session:**
```bash
ollm sessions delete <sessionId>
```

**Delete All Sessions:**
```bash
ollm sessions clear --all
```

**Delete Old Sessions:**
```bash
ollm sessions cleanup --keep 10
# Keeps 10 most recent, deletes older
```

**Auto-Cleanup:**
- Configured via `maxSessions` (default: 100)
- Automatically deletes oldest sessions
- User can disable: `maxSessions: 0`

### Privacy and Data Control

**Local Storage Only:**
- All data stored locally in `~/.ollm/`
- No cloud sync (unless user explicitly enables)
- No telemetry or tracking

**Data Locations:**
```
~/.ollm/
├── sessions/              # Full chat history
│   └── {sessionId}.json
├── context-snapshots/     # Recovery snapshots
│   └── {sessionId}/
│       └── snapshots/
└── config.yaml            # User settings
```

**Data Deletion:**
- Deleting a session removes:
  - Session file
  - All snapshots for that session
  - All associated metadata
- No recovery after deletion (permanent)

---

## Compression Cycle and Session Lifecycle

### Complete Flow Example

```
User starts conversation:
├─ Session created: session-123
├─ Session file: ~/.ollm/sessions/session-123.json
└─ Active context: Empty

User sends message 1:
├─ Message recorded to session file (uncompressed)
├─ Message added to active context
└─ Tokens: 100 / 6963 (1%)

User sends messages 2-50:
├─ All messages recorded to session file (uncompressed)
├─ All messages in active context
└─ Tokens: 5940 / 6963 (85%)

Snapshot trigger (85%):
├─ Snapshot created: snapshot-abc123
├─ Location: ~/.ollm/context-snapshots/session-123/snapshots/
├─ Contains: ALL user messages + current context state
└─ Session file: Unchanged (still has everything)

User sends message 51:
├─ Message recorded to session file (uncompressed)
├─ Message added to active context
└─ Tokens: 6100 / 6963 (87%)

Compression trigger (80% of available budget):
├─ Checkpoint created from messages 1-40
│  ├─ Assistant messages → Compressed summary (2000 tokens)
│  ├─ User messages → Preserved in full (never compressed)
│  └─ Tool results → Compressed
├─ Active context updated:
│  ├─ System prompt: 500 tokens
│  ├─ Checkpoint 1: 2000 tokens (compressed)
│  ├─ User messages 1-50: 1500 tokens (never compressed)
│  └─ Recent messages 41-51: 1000 tokens
└─ Session file: Unchanged (still has everything uncompressed)

User continues conversation:
├─ New messages recorded to session file (uncompressed)
├─ New messages added to active context
├─ Available budget: 4463 tokens (6963 - 500 - 2000)
└─ Next compression at: 3570 tokens (80% of 4463)

User views history:
├─ Reads session file: ~/.ollm/sessions/session-123.json
├─ Sees ALL messages (uncompressed)
├─ Sees ALL tool calls
└─ Compression is invisible to user
```

---

## Best Practices

### For Developers

**Session Management:**
- ✅ Enable auto-save (default)
- ✅ Use atomic writes for durability
- ✅ Handle corrupted session files gracefully
- ✅ Implement session cleanup (maxSessions)

**Snapshot Management:**
- ✅ Create snapshots before risky operations
- ✅ Keep maxCount low (5-10) to save disk space
- ✅ Use autoThreshold wisely (default: 0.85)
- ✅ Implement rolling cleanup

**Compression:**
- ✅ Never compress user messages
- ✅ Never compress active goals/decisions
- ✅ Trigger at 80% of available budget
- ✅ Track checkpoint space in budget calculation

### For Users

**Viewing History:**
- Use `/history` command to view full conversation
- Export sessions for documentation
- Search across sessions for insights

**Managing Storage:**
- Review old sessions periodically
- Delete unnecessary sessions
- Configure maxSessions for auto-cleanup
- Monitor disk usage in `~/.ollm/`

**Privacy:**
- All data stored locally
- Delete sessions to remove data permanently
- No cloud sync unless explicitly enabled

---

## Configuration

### Session Configuration

```yaml
# ~/.ollm/config.yaml
sessions:
  dataDir: ~/.ollm/sessions
  maxSessions: 100
  autoSave: true
```

### Snapshot Configuration

```yaml
# ~/.ollm/config.yaml
snapshots:
  enabled: true
  maxCount: 5
  autoCreate: true
  autoThreshold: 0.85
```

### Compression Configuration

```yaml
# ~/.ollm/config.yaml
compression:
  enabled: true
  strategy: summarize
  threshold: 0.80  # 80% of available budget
  preserveRecent: 2048
  summaryMaxTokens: 1024
```

---

## Events

### Session Events

- `session-created` - New session started
- `message-recorded` - Message saved to session
- `tool-call-recorded` - Tool call saved to session
- `session-saved` - Session file written to disk

### Snapshot Events

- `snapshot-created` - Snapshot created
- `auto-snapshot-created` - Automatic snapshot created
- `snapshot-restored` - Snapshot restored
- `snapshot-deleted` - Snapshot deleted
- `snapshot-error` - Snapshot operation failed

### Compression Events

- `compressed` - Compression completed
- `compression-skipped` - Compression not needed
- `compression-error` - Compression failed
- `checkpoint-created` - New checkpoint created
- `checkpoint-aged` - Checkpoint compressed further

---

## Troubleshooting

### Session File Corrupted

**Symptom:** "Failed to load session" error

**Solutions:**
1. Check file permissions
2. Verify JSON syntax
3. Restore from snapshot if available
4. Delete corrupted session file

### Snapshot Not Created

**Symptom:** No snapshot at 85% usage

**Solutions:**
1. Verify `autoCreate: true` in config
2. Check `autoThreshold` setting
3. Ensure snapshots are enabled
4. Check disk space

### Compression Too Frequent

**Symptom:** Compression triggers immediately after previous compression

**Solutions:**
1. Verify dynamic budget calculation is working
2. Check checkpoint tokens are being tracked
3. Ensure checkpoints are aging properly
4. Review compression trigger threshold (should be 80% of available)

### Disk Space Issues

**Symptom:** Running out of disk space

**Solutions:**
1. Reduce `maxSessions` (default: 100)
2. Reduce `maxCount` for snapshots (default: 5)
3. Delete old sessions manually
4. Run cleanup: `ollm sessions cleanup --keep 10`

---

## File Locations

| Component | Location | Purpose |
|-----------|----------|---------|
| **Sessions** | `~/.ollm/sessions/{sessionId}.json` | Full chat history |
| **Snapshots** | `~/.ollm/context-snapshots/{sessionId}/snapshots/` | Recovery points |
| **Snapshot Index** | `~/.ollm/context-snapshots/{sessionId}/snapshots/snapshots-index.json` | Metadata index |
| **Snapshot Map** | `~/.ollm/context-snapshots/snapshot-map.json` | Quick lookup |
| **Config** | `~/.ollm/config.yaml` | User settings |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `packages/core/src/services/chatRecordingService.ts` | Session management |
| `packages/core/src/context/snapshotManager.ts` | Snapshot lifecycle |
| `packages/core/src/context/snapshotStorage.ts` | Snapshot persistence |
| `packages/core/src/context/compressionCoordinator.ts` | Compression orchestration |
| `packages/core/src/context/checkpointManager.ts` | Checkpoint management |
| `packages/core/src/context/messageStore.ts` | Message tracking and triggers |

---

## Cross-References

### Related Systems

**Context Compression** (`dev_ContextCompression.md`)
- Compression triggers (80% of available budget)
- Checkpoint creation and aging
- Dynamic budget calculation
- Never-compressed content rules

**Context Management** (`dev_ContextManagement.md`)
- Context sizing and VRAM management
- Auto-sizing logic
- Memory thresholds
- Token counting

**Token Counter** (`dev_Tokeniser.md`)
- Token counting for sessions
- Cache management
- Metrics tracking
- Validation

**Prompt System** (`dev_PromptSystem.md`)
- System prompt in sessions
- Tier-based prompts
- Mode-specific prompts
- Goal integration

---

**Note:** This document describes the complete session, snapshot, and chat history system. For compression details, see `dev_ContextCompression.md`. For context sizing, see `dev_ContextManagement.md`.

