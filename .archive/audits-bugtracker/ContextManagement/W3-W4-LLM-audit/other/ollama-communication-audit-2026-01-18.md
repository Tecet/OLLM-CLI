# Ollama Communication Audit - January 18, 2026

## Executive Summary

**Status**: IN PROGRESS  
**Focus**: OLLM ↔ Ollama API communication verification  
**Areas**: Context, Memory, Temperature, Tools, Model Loading, Warmup

---

## 1. Temperature Configuration

### Current Implementation
**Location:** `packages/cli/src/config/defaults.ts`
```typescript
model: {
  default: 'llama3.2:3b',
  temperature: 0.3,  // ← Current value
  maxTokens: 4096,
}
```

### Ollama API Default
- **Default temperature:** 0.8 (from Ollama API docs)
- **Range:** 0.0 - 2.0
- **Recommended for coding:** 0.0 - 0.2

### Analysis
| Aspect | OLLM | Ollama Default | Recommendation |
|--------|------|----------------|----------------|
| Current Value | 0.3 | 0.8 | ⚠️ Good but could be lower |
| Coding Tasks | 0.3 | 0.8 | ✅ Better than default |
| Determinism | Medium | Low | 🔧 Use 0.0-0.1 for code |
| Creativity | Low | Medium | ✅ Appropriate for agents |

### Recommendation
**For coding agents: Use temperature 0.0 - 0.1**
- 0.0 = Fully deterministic (best for code generation)
- 0.1 = Slight variation (good for code with minor creativity)
- 0.3 = Current (acceptable but not optimal)

**Action:** Add profile-based temperature settings:
- `coding`: 0.0
- `general`: 0.3
- `creative`: 0.7

---

## 2. Context Window Management

### Current Implementation
**Location:** `packages/cli/src/config/defaults.ts`
```typescript
context_behavior: {
  standard: {
    contextWindow: 4096,
    compressionThreshold: 0.7,
    retentionRatio: 0.3,
  },
  low_vram: {
    contextWindow: 2048,
    compressionThreshold: 0.5,
    retentionRatio: 0.2,
  }
}
```

### Ollama API Parameters
```json
{
  "num_ctx": 2048,  // Default context window
  "num_predict": 128  // Default max tokens to generate
}
```

### Model-Specific Context Windows
From `LLM_profiles.json`:
- All models: `context_window: 131072` (128k)
- Default context: `4096` (4k)

### Comparison with Ollama

| Parameter | OLLM | Ollama API | Status |
|-----------|------|------------|--------|
| Context Window | 4096 (default) | 2048 (default) | ✅ Better |
| Max Context | 131072 (128k) | Model-dependent | ✅ Correct |
| Dynamic Sizing | ✅ Yes (VRAM-aware) | ❌ No | ✅ Advanced |
| Compression | ✅ Yes (0.7 threshold) | ❌ No | ✅ Advanced |

### Issues Found
❌ **We're not passing `num_ctx` to Ollama API**
- We configure context size internally
- But don't send it to Ollama in requests
- Ollama might use its default (2048) instead of our configured size

### Action Required
✅ **Pass context size to Ollama:**
```typescript
{
  model: "...",
  messages: [...],
  options: {
    num_ctx: contextSize,  // ← ADD THIS
    temperature: 0.3,
  }
}
```

---

## 3. Model Loading & Unloading

### Current Implementation

**Loading:**
- Location: `ModelContext.setModelAndLoading()`
- Triggers warmup on model switch
- Shows loading state in UI

**Unloading:**
- Location: `ModelContext.setModelAndLoading()`
- Calls `provider.unloadModel(previousModel)`
- Uses Ollama's `keep_alive: 0` parameter

**Warmup:**
- Location: `ModelContext` useEffect
- Sends test message "warmup"
- Retries with delays: [1s, 2s, 4s]
- Timeout: 30s (default) or 120s (reasoning models)

### Ollama API Behavior

**Model Loading:**
- Automatic on first request
- Can take 5-30 seconds depending on model size
- No explicit "load" endpoint

**Model Unloading:**
```bash
POST /api/generate
{
  "model": "model-name",
  "prompt": "",
  "keep_alive": 0  # Unload immediately
}
```

**Keep Alive:**
- Default: 5 minutes
- Can be set per-request
- `keep_alive: 0` = unload immediately
- `keep_alive: -1` = keep loaded indefinitely

### Comparison

| Feature | OLLM | Ollama | Status |
|---------|------|--------|--------|
| Auto-load on request | ✅ Yes | ✅ Yes | ✅ Match |
| Explicit unload | ✅ Yes | ✅ Yes | ✅ Match |
| Warmup mechanism | ✅ Yes (custom) | ❌ No | ✅ Advanced |
| Retry logic | ✅ Yes (3 attempts) | ❌ No | ✅ Advanced |
| Timeout handling | ✅ Yes (configurable) | ⚠️ Basic | ✅ Better |

### Issues Found

❌ **Warmup spinner not visible**
- User reports: "I can't see it now"
- Warmup status is tracked in state
- Need to verify UI component is rendering

❌ **Warmup timeout might be too short**
- Default: 30s
- Reasoning models: 120s
- Large models on slow hardware might need more time

### Action Required

1. **Verify warmup spinner rendering:**
   - Check if `WarmupIndicator` component exists
   - Check if it's being rendered in UI
   - Check if `modelLoading` state is being displayed

2. **Add configurable warmup timeout:**
   - Per-model timeout in profiles
   - User-configurable global timeout
   - Better error messages on timeout

---

## 4. Tool Support Communication

### Current Implementation

**Tool Schema Mapping:**
- Location: `LocalProvider.mapTools()`
- Converts our schema to Ollama format
- Validates schema before sending

**Tool Call Detection:**
- Reads `message.tool_calls` from Ollama response
- Parses arguments (handles both string and object)
- Has "healer" for small models that output JSON in content

**Tool Error Handling:**
- Detects `TOOL_UNSUPPORTED` errors
- Retries without tools
- Updates runtime overrides

### Ollama API Format

**Request:**
```json
{
  "model": "...",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "tool_name",
        "description": "...",
        "parameters": { /* JSON Schema */ }
      }
    }
  ]
}
```

**Response:**
```json
{
  "message": {
    "role": "assistant",
    "content": "...",
    "tool_calls": [
      {
        "id": "call_123",
        "type": "function",
        "function": {
          "name": "tool_name",
          "arguments": { /* object or string */ }
        }
      }
    ]
  }
}
```

### Comparison

| Feature | OLLM | Ollama | Status |
|---------|------|--------|--------|
| Tool schema format | ✅ Correct | ✅ Standard | ✅ Match |
| Tool call parsing | ✅ Yes | ✅ Yes | ✅ Match |
| Error handling | ✅ Advanced | ⚠️ Basic | ✅ Better |
| Fallback for non-tool models | ✅ Yes | ❌ No | ✅ Advanced |
| JSON healing | ✅ Yes | ❌ No | ✅ Advanced |

### Issues Found

✅ **Tool support is correctly implemented**
- Schema validation is thorough
- Error handling is robust
- Fallback mechanisms work

⚠️ **Tool support detection could be improved**
- Currently relies on profiles
- Could auto-detect from Ollama model info
- Runtime learning is good but could be faster

---

## 5. Thinking/Reasoning Support

### Current Implementation (AFTER FIX)

**Request:**
```typescript
{
  model: "...",
  messages: [...],
  think: true,  // ← NEW: Ollama native thinking
}
```

**Response Handling:**
```typescript
if (message?.thinking !== undefined) {
  yield { type: 'thinking', value: thinking };
}
```

### Ollama API Format

**Request:**
```json
{
  "model": "deepseek-r1",
  "messages": [...],
  "think": true  // Enable thinking mode
}
```

**Response:**
```json
{
  "message": {
    "thinking": "reasoning content here...",
    "content": "final answer here..."
  }
}
```

### Comparison

| Feature | OLLM (Before) | OLLM (After) | Ollama | Status |
|---------|---------------|--------------|--------|--------|
| Thinking parameter | ❌ No | ✅ Yes | ✅ Yes | ✅ Fixed |
| Thinking field parsing | ❌ No | ✅ Yes | ✅ Yes | ✅ Fixed |
| Separate display | ⚠️ Text parsing | ✅ Native | ✅ Native | ✅ Fixed |
| Streaming support | ❌ No | ✅ Yes | ✅ Yes | ✅ Fixed |

### Status
✅ **Fully implemented and matches Ollama API**

---

## 6. Memory & VRAM Monitoring

### Current Implementation

**VRAM Monitoring:**
- Location: `packages/core/src/context/vramMonitor.ts`
- Polls GPU memory every 5 seconds
- Supports NVIDIA, AMD, Apple Silicon

**Context Pool:**
- Location: `packages/core/src/context/contextPool.ts`
- Dynamically sizes context based on VRAM
- Reserves buffer for safety

**Memory Guard:**
- Location: `packages/core/src/context/memoryGuard.ts`
- Prevents OOM errors
- Triggers compression/snapshots

### Ollama Behavior

**Memory Management:**
- Ollama manages its own memory
- Loads models into VRAM automatically
- Uses system RAM as fallback
- No API to query VRAM usage

**Context Memory:**
- KV cache stored in VRAM
- Size depends on context window
- Quantization affects memory usage

### Comparison

| Feature | OLLM | Ollama | Status |
|---------|------|--------|--------|
| VRAM monitoring | ✅ Yes (external) | ❌ No API | ✅ Advanced |
| Dynamic context sizing | ✅ Yes | ❌ No | ✅ Advanced |
| Memory safety | ✅ Yes | ⚠️ Basic | ✅ Better |
| OOM prevention | ✅ Yes | ❌ No | ✅ Advanced |

### Issues Found

⚠️ **VRAM monitoring is external**
- We monitor GPU directly (nvidia-smi, etc.)
- Ollama doesn't expose its memory usage
- Our estimates might not match Ollama's actual usage

⚠️ **No way to verify Ollama's memory state**
- Can't query how much VRAM Ollama is using
- Can't verify if model is loaded
- Can't check KV cache size

### Recommendation

**Add Ollama process monitoring:**
- Monitor Ollama process memory usage
- Correlate with our VRAM estimates
- Adjust calculations based on actual usage

---

## 7. Request/Response Flow

### Current Flow

```
User Input
    ↓
ChatContext.sendMessage()
    ↓
ModelContext.sendToLLM()
    ↓
LocalProvider.chatStream()
    ↓
fetch(ollama_url, { body: {...} })
    ↓
NDJSON stream parsing
    ↓
mapChunkToEvents()
    ↓
Event handlers (onText, onThinking, onToolCall, onComplete)
    ↓
UI Update
```

### Ollama API Flow

```
Client Request (POST /api/chat)
    ↓
Ollama receives request
    ↓
Load model (if not loaded)
    ↓
Process prompt
    ↓
Stream response (NDJSON)
    ↓
Client receives chunks
```

### Comparison

| Stage | OLLM | Ollama | Status |
|-------|------|--------|--------|
| Request format | ✅ Correct | ✅ Standard | ✅ Match |
| Streaming | ✅ NDJSON | ✅ NDJSON | ✅ Match |
| Error handling | ✅ Robust | ⚠️ Basic | ✅ Better |
| Timeout handling | ✅ Yes | ⚠️ Basic | ✅ Better |
| Retry logic | ✅ Yes | ❌ No | ✅ Advanced |

### Issues Found

✅ **Communication flow is correct**
- Request format matches Ollama API
- Response parsing is robust
- Error handling is comprehensive

❌ **Missing: Pass context size to Ollama**
- Need to add `num_ctx` to options
- Need to add `num_predict` for max tokens

---

## 8. Warmup Indicator Investigation

### Expected Behavior
- Spinner should show during model loading
- Status should show "Loading model..."
- Elapsed time should update

### Current Implementation

**State Tracking:**
```typescript
const [modelLoading, setModelLoading] = useState(false);
const [warmupStatus, setWarmupStatus] = useState<{
  active: boolean;
  attempt: number;
  elapsedMs: number;
} | null>(null);
```

**UI Component:**
- Need to find where warmup status is displayed
- Check if component is rendered
- Check if state is being passed correctly

### Action Required

1. **Find warmup indicator component:**
   - Search for "Loading" or "Warmup" in UI components
   - Check StatusBar component
   - Check if it's in ModelPicker or separate component

2. **Verify state propagation:**
   - Check if `modelLoading` is passed to UI
   - Check if `warmupStatus` is passed to UI
   - Check if component is conditionally rendered

---

## Critical Issues Summary

### 🔴 Critical
1. **Missing `num_ctx` parameter** - Ollama might use wrong context size
2. **Warmup spinner not visible** - User can't see loading progress

### 🟡 High Priority
1. **Temperature too high for coding** - Should be 0.0-0.1 for code generation
2. **VRAM monitoring is external** - Can't verify Ollama's actual usage

### 🟢 Medium Priority
1. **No Ollama process monitoring** - Can't track actual memory usage
2. **Warmup timeout might be too short** - Large models might need more time

---

## Recommendations

### Immediate Actions

1. **Add `num_ctx` to requests:**
```typescript
const stream = provider.chatStream({
  model: currentModel,
  messages: providerMessages,
  options: {
    num_ctx: contextSize,
    num_predict: maxTokens,
    temperature: temperature,
  },
  // ...
});
```

2. **Find and fix warmup spinner:**
   - Locate UI component
   - Verify state propagation
   - Test with slow model loading

3. **Lower default temperature:**
   - Change from 0.3 to 0.1 for coding
   - Add profile-based temperature settings

### Future Improvements

1. **Add Ollama process monitoring**
2. **Auto-detect model capabilities from Ollama**
3. **Add configurable warmup timeout per model**
4. **Add memory usage correlation with Ollama**

---

## Testing Plan

### Test 1: Context Size
```bash
# Verify num_ctx is sent to Ollama
# Monitor Ollama logs to see actual context size used
```

### Test 2: Warmup Indicator
```bash
# Switch to large model
# Verify spinner appears
# Verify elapsed time updates
# Verify spinner disappears when loaded
```

### Test 3: Temperature
```bash
# Generate code with temperature 0.0
# Generate code with temperature 0.3
# Compare determinism and quality
```

### Test 4: Memory Management
```bash
# Monitor VRAM during model loading
# Monitor VRAM during inference
# Verify context pool calculations
# Test OOM prevention
```

---

**Status**: Audit in progress - Critical issues identified  
**Next**: Fix num_ctx parameter and locate warmup spinner
