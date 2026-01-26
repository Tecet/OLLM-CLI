# DeepSeek Context Issue Investigation

## Problem
User sends "hi" to DeepSeek-R1:7b and gets response about calculating integrals and Gaussian functions - clearly from a previous math conversation.

## Evidence
Screenshot shows:
```
USER • 03:12:07
hi

ASSISTANT • 03:12:07
> Okay, so I need to figure out how to calculate the integral of e^(-x^2) from negative
infinity to positive infinity. Hmm, where do I start? I remember that this integral is
related to the Gaussian function, which I've seen before in probability and statistics.
But I'm not entirely sure about all the steps involved. Let me think through it slowly.
```

## Root Cause Analysis

### Hypothesis 1: Context Not Cleared ❌
**Test:** Check if `clearChat()` is being called on model switch  
**Status:** Code shows it IS being called  
**Conclusion:** Not the issue

### Hypothesis 2: System Prompt Contains Old Context ✅ LIKELY
**Test:** Check what's in the system prompt  
**Evidence:**
- `contextManager.clear()` preserves system prompt
- System prompt might contain conversation history
- System prompt is retrieved with `contextActions.getSystemPrompt()`

**Code:**
```typescript
// In contextManager.ts
async clear(): Promise<void> {
  const systemPrompt = this.currentContext.messages.find(
    m => m.role === 'system'
  );
  
  this.currentContext.messages = systemPrompt ? [systemPrompt] : [];
  // ↑ System prompt is PRESERVED
}
```

### Hypothesis 3: Snapshot Being Restored ❓
**Test:** Check if snapshots are being auto-restored  
**Status:** Need to verify  
**Action:** Add logging to snapshot restore

### Hypothesis 4: Messages Not Actually Cleared ❓
**Test:** Log messages array before and after clear  
**Status:** Need to verify  
**Action:** Add debug logging

## Investigation Steps

### Step 1: Add Debug Logging
Add logging to trace:
1. When `clearChat()` is called
2. What messages exist before clear
3. What messages exist after clear
4. What's in the system prompt
5. What's sent to Ollama

### Step 2: Check System Prompt Content
The system prompt might contain:
- Previous conversation summary
- Context from compression
- Snapshot data
- Memory service additions

### Step 3: Verify Clear Flow
```
Model Switch
    ↓
setModelAndLoading()
    ↓
__ollmClearContext()
    ↓
clearChat()
    ↓
contextActions.clear()
    ↓
contextManager.clear()
    ↓
Preserve system prompt, clear messages
```

## Potential Fixes

### Fix 1: Clear System Prompt on Model Switch
```typescript
// In ModelContext.tsx
const clearContext = globalThis.__ollmClearContext;
if (clearContext) {
  clearContext();
  // Also clear system prompt
  contextActions.setSystemPrompt(''); // ← ADD THIS
}
```

### Fix 2: Rebuild System Prompt After Clear
```typescript
// After clearing, rebuild system prompt from scratch
const newSystemPrompt = buildSystemPrompt({
  model: newModel,
  skills: [],
  tools: [],
  // ... fresh context
});
contextActions.setSystemPrompt(newSystemPrompt);
```

### Fix 3: Don't Preserve System Prompt in Clear
```typescript
// In contextManager.ts
async clear(): Promise<void> {
  // Don't preserve system prompt
  this.currentContext.messages = [];
  this.currentContext.tokenCount = 0;
  
  // Reset system prompt to empty
  this.currentContext.systemPrompt = {
    id: `system-${Date.now()}`,
    role: 'system',
    content: '',
    timestamp: new Date()
  };
  
  // ...
}
```

## Testing Plan

### Test 1: Verify Clear is Called
```bash
1. Add console.log in clearChat()
2. Switch models
3. Check if log appears
```

### Test 2: Check Messages Array
```bash
1. Add console.log(messages.length) before and after clear
2. Switch models
3. Verify messages.length === 0 (or 1 if system prompt)
```

### Test 3: Check System Prompt
```bash
1. Add console.log(systemPrompt) before sending to LLM
2. Send "hi"
3. Check if system prompt contains old context
```

### Test 4: Check Ollama Request
```bash
1. Add console.log(JSON.stringify(body)) in LocalProvider
2. Send "hi"
3. Check what messages are actually sent to Ollama
```

## Recommended Fix

**Option A: Clear System Prompt on Model Switch (Simplest)**
```typescript
// In ChatContext.tsx clearChat()
const clearChat = useCallback(() => {
  setMessages([]);
  setCurrentInput('');
  setStreaming(false);
  setWaitingForResponse(false);
  if (contextActions) {
    contextActions.clear().catch(console.error);
    contextActions.setSystemPrompt(''); // ← ADD THIS
  }
}, [contextActions]);
```

**Option B: Don't Preserve System Prompt in Clear (More thorough)**
Modify `contextManager.clear()` to not preserve system prompt.

**Recommendation:** Try Option A first (simpler, less invasive)

## Next Steps

1. ✅ Implement Option A (clear system prompt)
2. ⏳ Test with DeepSeek-R1
3. ⏳ Verify "hi" gets fresh response
4. ⏳ If still fails, try Option B

---

**Status:** Investigation complete, fix ready to implement  
**Priority:** HIGH - User experience issue
