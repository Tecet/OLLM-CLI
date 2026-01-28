# Reasoning Models

**Last Updated:** January 26, 2026  
**Status:** ⚠️ Partially Implemented (Post-Alpha Work Required)  
**Related Documents:**

- [dev_ModelManagement.md](./dev_ModelManagement.md) - Model detection and profiles
- [dev_ProviderSystem.md](./dev_ProviderSystem.md) - Ollama provider integration
- [dev_UI_Front.md](./dev_UI_Front.md) - Reasoning box UI
- [dev_ContextManagement.md](./dev_ContextManagement.md) - Context handling

---

## Overview

Reasoning models (e.g., DeepSeek R1, QwQ) expose their internal thinking process before generating final answers. OLLM CLI provides special handling for these models to capture, display, and manage reasoning content separately from final responses.

---

## Reasoning Model Examples

**Popular Reasoning Models:**

- DeepSeek R1 (7B, 14B, 32B, 70B)
- QwQ (32B)
- Future models with native thinking support

**Characteristics:**

- Expose `thinking` field in API responses
- Require longer warmup times (120s vs 30s)
- Generate reasoning tokens before answer tokens
- May use more context for reasoning process

---

## Current Implementation Status

### ✅ Implemented (Alpha)

1. **Ollama API Integration**
   - `think: true` parameter sent to Ollama
   - `message.thinking` field parsed from responses
   - Streaming support for reasoning content
   - Separate event type: `{ type: 'thinking', value: '...' }`

2. **UI Display**
   - Reasoning box component
   - Collapsible reasoning blocks
   - Auto-expand during streaming
   - Auto-collapse when complete
   - Manual toggle support

3. **Warmup Timeout**
   - Extended timeout for reasoning models (120s vs 30s)
   - Configured in model profiles
   - Prevents premature timeout errors

### ⚠️ Partially Implemented

1. **Reasoning Capture**
   - Basic capture in message state
   - No dedicated reasoning storage
   - No reasoning history management
   - No reasoning analytics

2. **Context Management**
   - Reasoning counted in token estimates
   - No special handling for reasoning tokens
   - No reasoning-specific compression
   - No reasoning preservation rules

### ❌ Not Implemented (Post-Alpha)

1. **Reasoning-Aware Context Management**
   - Separate token budget for reasoning
   - Reasoning preservation during compression
   - Reasoning-aware snapshot system
   - Reasoning token counting

2. **Reasoning Analytics**
   - Reasoning length tracking
   - Reasoning quality metrics
   - Reasoning pattern analysis
   - Reasoning cost tracking

3. **Reasoning History**
   - Dedicated reasoning storage
   - Reasoning search and retrieval
   - Reasoning export functionality
   - Reasoning comparison tools

---

## Ollama API Integration

### Request Format

**Enable Thinking:**

```typescript
{
  model: "deepseek-r1:7b",
  messages: [...],
  think: true,  // Enable native thinking mode
  options: {
    num_ctx: 8192,
    temperature: 0.3,
  }
}
```

**Location:** `packages/ollm-bridge/src/provider/localProvider.ts`

### Response Format

**Streaming Response:**

```json
{
  "message": {
    "role": "assistant",
    "thinking": "Let me think about this step by step...",
    "content": "The answer is..."
  },
  "done": false
}
```

**Complete Response:**

```json
{
  "message": {
    "role": "assistant",
    "thinking": "Complete reasoning process...",
    "content": "Final answer..."
  },
  "done": true,
  "done_reason": "stop"
}
```

### Event Mapping

**Thinking Events:**

```typescript
if (message?.thinking !== undefined) {
  yield {
    type: 'thinking',
    value: message.thinking
  };
}
```

**Text Events:**

```typescript
if (message?.content) {
  yield {
    type: 'text',
    value: message.content
  };
}
```

**Location:** `packages/ollm-bridge/src/provider/localProvider.ts:480-495`

---

## Message State Structure

### Reasoning Field

**Message Interface:**

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: {
    content: string; // Reasoning text
    complete: boolean; // Streaming complete?
    duration?: number; // Time taken (seconds)
  };
  expanded?: boolean; // UI collapse state
  timestamp: number;
}
```

**Location:** `packages/cli/src/features/context/ChatContext.tsx`

### State Management

**During Streaming:**

```typescript
const assistantMsg = addMessage({
  role: 'assistant',
  content: '',
  reasoning: {
    content: '',
    complete: false,
  },
  expanded: true, // Show reasoning as it streams
});
```

**On Completion:**

```typescript
if (msg.reasoning) {
  updates.reasoning = {
    ...msg.reasoning,
    complete: true,
    duration: metrics.evalDuration > 0 ? metrics.evalDuration / 1e9 : 0,
  };
  updates.expanded = false; // Auto-collapse
}
```

---

## UI Rendering

### Reasoning Box Behavior

**Three States:**

1. **Streaming (expanded: true, complete: false)**
   - Reasoning shows EXPANDED
   - Content streams in real-time
   - User sees thinking process
   - Box remains open

2. **Complete (expanded: false, complete: true)**
   - Auto-collapses to summary
   - Shows "Reasoning: (collapsed)"
   - Saves screen space
   - User can expand manually

3. **Historical (expanded: false, complete: true)**
   - Starts collapsed
   - Shows summary line only
   - No unnecessary space used

### Rendering Architecture

**Line-Based System:**

```typescript
// ChatHistory.tsx
const isExpanded = message.expanded === true;

if (showReasoning && message.reasoning) {
  if (isExpanded) {
    // Show full reasoning content
    addLine([{ text: message.reasoning.content, color: 'cyan' }]);
  } else {
    // Show collapsed summary
    addLine([{ text: 'Reasoning: (collapsed)', color: 'dim' }]);
  }
}
```

**Key Insight:** Rendering happens in `buildChatLines()` utility, not React components.

**Location:** `packages/cli/src/ui/components/chat/ChatHistory.tsx`

**Reference:** [dev_UI_Front.md](./dev_UI_Front.md) - Message Rendering Architecture

---

## Model Profile Configuration

### Warmup Timeout

**Standard Models:**

```json
{
  "warmup_timeout": 30000 // 30 seconds
}
```

**Reasoning Models:**

```json
{
  "warmup_timeout": 120000 // 120 seconds (2 minutes)
}
```

**Location:** `packages/cli/src/config/LLM_profiles.json`

### Model Detection

**Reasoning Model Indicators:**

- Model name contains "r1", "qwq", "reasoning"
- Profile has `warmup_timeout > 60000`
- Profile has `reasoning: true` flag (future)

**Location:** `packages/cli/src/features/profiles/ProfileManager.ts`

---

## Post-Alpha Implementation Plan

### Task 1: Reasoning-Aware Context Management

**Priority:** HIGH  
**Effort:** 1-2 weeks

**Requirements:**

1. **Separate Token Budget**
   - Reserve tokens for reasoning (e.g., 20% of context)
   - Track reasoning tokens separately
   - Adjust available budget dynamically

2. **Reasoning Preservation**
   - Never compress reasoning content
   - Keep reasoning in checkpoints
   - Preserve reasoning in snapshots

3. **Reasoning Token Counting**
   - Accurate token counting for reasoning
   - Separate counters for thinking vs content
   - Display reasoning token usage in UI

**Implementation:**

```typescript
interface ContextBudget {
  total: number;
  system: number;
  reasoning: number; // NEW: Reserved for reasoning
  available: number; // total - system - reasoning
  used: number;
}
```

**Files to Modify:**

- `packages/core/src/context/contextManager.ts`
- `packages/core/src/context/tokenCounter.ts`
- `packages/core/src/context/compressionService.ts`

---

### Task 2: Reasoning Analytics

**Priority:** MEDIUM  
**Effort:** 1 week

**Requirements:**

1. **Reasoning Metrics**
   - Track reasoning length (tokens/chars)
   - Track reasoning time (duration)
   - Track reasoning frequency
   - Track reasoning cost

2. **Reasoning Quality**
   - Reasoning depth score
   - Reasoning coherence score
   - Reasoning relevance score

3. **Reasoning Patterns**
   - Common reasoning structures
   - Reasoning efficiency
   - Reasoning effectiveness

**Implementation:**

```typescript
interface ReasoningMetrics {
  totalReasoningTokens: number;
  totalReasoningTime: number;
  averageReasoningLength: number;
  reasoningFrequency: number;
  reasoningCost: number;
  qualityScores: {
    depth: number;
    coherence: number;
    relevance: number;
  };
}
```

**Files to Create:**

- `packages/core/src/services/reasoningAnalytics.ts`
- `packages/core/src/services/reasoningMetrics.ts`

---

### Task 3: Reasoning History Management

**Priority:** MEDIUM  
**Effort:** 1-2 weeks

**Requirements:**

1. **Dedicated Storage**
   - Separate reasoning database
   - Efficient reasoning retrieval
   - Reasoning indexing

2. **Reasoning Search**
   - Search by content
   - Search by model
   - Search by date/time
   - Search by quality score

3. **Reasoning Export**
   - Export to markdown
   - Export to JSON
   - Export to text
   - Export with metadata

4. **Reasoning Comparison**
   - Compare reasoning across models
   - Compare reasoning across prompts
   - Identify reasoning patterns

**Implementation:**

```typescript
interface ReasoningHistory {
  id: string;
  messageId: string;
  model: string;
  content: string;
  duration: number;
  tokenCount: number;
  timestamp: number;
  metadata: {
    prompt: string;
    response: string;
    quality: number;
  };
}
```

**Files to Create:**

- `packages/core/src/services/reasoningHistory.ts`
- `packages/core/src/services/reasoningSearch.ts`
- `packages/core/src/services/reasoningExport.ts`

---

### Task 4: Reasoning-Specific Compression

**Priority:** HIGH  
**Effort:** 1 week

**Requirements:**

1. **Reasoning Preservation Rules**
   - Never compress reasoning content
   - Keep reasoning in full fidelity
   - Preserve reasoning structure

2. **Reasoning-Aware Summarization**
   - Summarize around reasoning
   - Keep reasoning as anchor points
   - Reference reasoning in summaries

3. **Reasoning Checkpoints**
   - Create checkpoints at reasoning boundaries
   - Use reasoning as natural break points
   - Preserve reasoning in checkpoint metadata

**Implementation:**

```typescript
interface CompressionOptions {
  preserveReasoning: boolean; // NEW: Never compress reasoning
  reasoningAsCheckpoints: boolean; // NEW: Use reasoning as checkpoints
  summarizeAroundReasoning: boolean; // NEW: Keep reasoning context
}
```

**Files to Modify:**

- `packages/core/src/context/compressionService.ts`
- `packages/core/src/context/checkpointManager.ts`

**Reference:** [dev_ContextCompression.md](./dev_ContextCompression.md)

---

### Task 5: Reasoning Model Detection

**Priority:** LOW  
**Effort:** 2-3 days

**Requirements:**

1. **Auto-Detection**
   - Detect reasoning capability from Ollama
   - Detect from model name patterns
   - Detect from first response

2. **Profile Enhancement**
   - Add `reasoning: true` flag to profiles
   - Add reasoning-specific settings
   - Add reasoning token budgets

3. **Runtime Learning**
   - Learn reasoning patterns
   - Adjust settings based on usage
   - Update profiles automatically

**Implementation:**

```typescript
interface ModelProfile {
  reasoning: boolean; // NEW: Supports reasoning
  reasoningTokenBudget: number; // NEW: Reserved tokens
  reasoningTimeout: number; // NEW: Extended timeout
}
```

**Files to Modify:**

- `packages/cli/src/config/LLM_profiles.json`
- `packages/cli/src/features/profiles/ProfileManager.ts`

---

## Known Issues

### Issue 1: Reasoning Not Preserved in Compression

**Status:** ❌ Not Implemented  
**Impact:** HIGH  
**Description:** Reasoning content is compressed like regular text, losing valuable thinking process.

**Solution:** Implement reasoning preservation rules (Task 4)

---

### Issue 2: No Reasoning Token Budget

**Status:** ❌ Not Implemented  
**Impact:** HIGH  
**Description:** Reasoning tokens counted against general context budget, reducing available space for conversation.

**Solution:** Implement separate reasoning token budget (Task 1)

---

### Issue 3: No Reasoning Analytics

**Status:** ❌ Not Implemented  
**Impact:** MEDIUM  
**Description:** No visibility into reasoning quality, length, or cost.

**Solution:** Implement reasoning analytics (Task 2)

---

### Issue 4: Reasoning Box Behavior Fixed

**Status:** ✅ FIXED (January 27, 2026)  
**Impact:** LOW  
**Description:** Reasoning box was always collapsed, hiding thinking process during streaming.

**Solution:**

- Set `expanded: true` on message creation (shows reasoning as it streams)
- Set `expanded: false` on completion (auto-collapse to save space)
- User can manually toggle at any time

**Implementation:**

```typescript
// During streaming
const assistantMsg = addMessage({
  role: 'assistant',
  content: '',
  reasoning: {
    content: '',
    complete: false,
  },
  expanded: true, // ✅ Show reasoning as it streams
});

// On completion
if (msg.reasoning) {
  updates.reasoning = {
    ...msg.reasoning,
    complete: true,
  };
  updates.expanded = false; // ✅ Auto-collapse
}
```

**Files Modified:**

- `packages/cli/src/features/context/ChatContext.tsx`
- `packages/cli/src/features/context/handlers/agentLoopHandler.ts`

**See:** ChatContext refactoring work (January 27, 2026)

---

## Best Practices

### For Users

1. **Use Reasoning Models for Complex Tasks**
   - Math problems
   - Logic puzzles
   - Code debugging
   - Complex analysis

2. **Monitor Reasoning Quality**
   - Check if reasoning is coherent
   - Verify reasoning leads to correct answer
   - Report poor reasoning to model developers

3. **Manage Context Carefully**
   - Reasoning uses more tokens
   - May need larger context windows
   - Consider compression more frequently

### For Developers

1. **Always Check for Reasoning Field**

   ```typescript
   if (message.reasoning) {
     // Handle reasoning separately
   }
   ```

2. **Preserve Reasoning in Operations**
   - Never compress reasoning
   - Keep reasoning in snapshots
   - Include reasoning in exports

3. **Track Reasoning Metrics**
   - Token usage
   - Time taken
   - Quality scores

---

## Testing Strategy

### Unit Tests

1. **Reasoning Capture**
   - Test `thinking` field parsing
   - Test reasoning state updates
   - Test reasoning completion

2. **Reasoning Display**
   - Test expand/collapse behavior
   - Test streaming updates
   - Test historical display

3. **Reasoning Preservation**
   - Test compression skips reasoning
   - Test snapshot includes reasoning
   - Test export includes reasoning

### Integration Tests

1. **End-to-End Reasoning Flow**
   - Send message to reasoning model
   - Verify reasoning captured
   - Verify reasoning displayed
   - Verify reasoning preserved

2. **Context Management**
   - Test reasoning token budget
   - Test reasoning preservation
   - Test reasoning in compression

3. **Model Switching**
   - Switch from reasoning to non-reasoning model
   - Verify reasoning still displayed
   - Verify no reasoning for non-reasoning models

---

## File Locations

| File                                                   | Purpose                                          |
| ------------------------------------------------------ | ------------------------------------------------ |
| `packages/ollm-bridge/src/provider/localProvider.ts`   | Ollama API integration, thinking parameter       |
| `packages/cli/src/features/context/ChatContext.tsx`    | Message state management, reasoning field        |
| `packages/cli/src/ui/components/chat/ChatHistory.tsx`  | Reasoning box rendering                          |
| `packages/cli/src/ui/components/chat/ReasoningBox.tsx` | Reasoning box component (not used for rendering) |
| `packages/cli/src/config/LLM_profiles.json`            | Model profiles, warmup timeouts                  |

---

## References

**Audit Documents:**

- `.dev/docs/devs/audits-bugtracker/ContextManagement/W3-W4-LLM-audit/LLM-audit.md`
- `.dev/docs/devs/audits-bugtracker/ContextManagement/W3-W4-LLM-audit/other/ollama-communication-audit-2026-01-18.md`
- `.dev/docs/devs/audits-bugtracker/ContextManagement/W3-W4-LLM-audit/other/reasoning-box-behavior-fix.md`

**Related Documentation:**

- [dev_ModelManagement.md](./dev_ModelManagement.md)
- [dev_ProviderSystem.md](./dev_ProviderSystem.md)
- [dev_UI_Front.md](./dev_UI_Front.md)
- [dev_ContextManagement.md](./dev_ContextManagement.md)
- [dev_ContextCompression.md](./dev_ContextCompression.md)

---
