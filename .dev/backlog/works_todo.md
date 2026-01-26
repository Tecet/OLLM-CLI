# ALPHA PRIORITY TASKS (7 Days)

**Last Updated:** January 26, 2026  
**Alpha Deadline:** 7 days  
**Focus:** Context/Prompt/Compression System + Ollama Settings

---

## ⚠️ CRITICAL RULES FOR CODING AGENTS

**BEFORE YOU START ANY TASK:**

1. **BACKUP & VERSION CONTROL:**
   - Create git branch: `git checkout -b task-{number}-{name}`
   - Commit original files BEFORE changes
   - Commit after each logical change

2. **UNDERSTAND BEFORE TOUCHING:**
   - Read ALL referenced documentation COMPLETELY
   - Scan repository for related code
   - Map out all affected files
   - Create implementation plan and get approval
   - DO NOT start coding until you understand full scope

3. **TESTING & VALIDATION:**
   - Run tests BEFORE changes: `npm test`
   - Run tests AFTER each change: `npm test`
   - DO NOT hide test failures
   - Fix broken tests immediately or revert
   - Run type check: `npx tsc --noEmit`
   - Run lint: `npm run lint`

4. **CODE QUALITY:**
   - Remove old/legacy code - don't leave it commented
   - If you find old code, ASK developer
   - Keep changes minimal and focused
   - Don't refactor unrelated code

5. **PRESERVE EXISTING FUNCTIONALITY:**
   - MCP system must keep working
   - Hook system must keep working
   - Tool system must keep working
   - If you break something, STOP and revert

6. **DOCUMENTATION:**
   - Update task progress in THIS file only
   - NO additional reports unless requested
   - Keep it simple: ✅ Done, ⏳ In Progress, ❌ Blocked

**FAILURE TO FOLLOW = TASK REJECTED**

---

## TASK 1: Simplify Tier Selection Logic

**Priority:** 🔥 CRITICAL | **Effort:** 6-8h | **Status:** ⏳ In Progress

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ContextManagement.md`
- `.dev/docs/devs/knowledgeDB/dev_PromptSystem.md`

**Problem:** 3 tier variables when we need 1

**Fix:** Remove hardwareCapabilityTier, actualContextTier, getEffectivePromptTier(). Add single selectedTier.

**Files:** `packages/core/src/context/contextManager.ts`, `promptOrchestrator.ts`, tests

**Progress:**
- [x] Docs read
- [x] Repo scanned
- [x] Plan created (see below)
- [ ] Plan approved
- [x] Backup created (git branch + baseline tests pass: 406/406)
- [ ] Code changed
- [ ] Tests pass
- [ ] Committed

**Implementation Plan:**

**Files to modify:**
1. `packages/core/src/context/contextManager.ts` - Remove 3 tier variables, add 1
2. `packages/core/src/context/__tests__/contextManager.test.ts` - Update tests

**Changes:**

**Step 1: Remove hardwareCapabilityTier (line 444)**
- Remove field declaration
- Remove from start() method (line 267)
- Remove from all emit() calls (lines 158, 302, 320, 337, 668, 672)
- Remove from console.log (line 268)

**Step 2: Remove getEffectivePromptTier() method (line 540)**
- Delete entire method
- Replace all calls with direct use of selectedTier

**Step 3: Rename actualContextTier to selectedTier (line 446)**
- Rename field declaration
- Update all references (52 occurrences)
- Update in emit() calls
- Update in console.log statements

**Step 4: Simplify tier logic**
- Remove "effective prompt tier" concept
- Prompt tier = selectedTier (always)
- Update comments to reflect simplified design

**Expected behavior after changes:**
- Single `selectedTier` variable tracks context tier
- Tier is determined by context size (user selection or auto-sizing)
- Prompt tier always equals selectedTier
- No hardware capability tier tracking
- Cleaner, simpler code

---

## TASK 2: Remove Runtime 85% Calculation

**Priority:** 🔥 CRITICAL | **Effort:** 4-6h | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ContextManagement.md` (Context Size Calculation section)
- `.dev/docs/devs/knowledgeDB/dev_ContextCompression.md`

**Problem:** utilizationTarget in TIER_CONFIGS is dead code (85% pre-calculated in LLM_profiles.json)

**Fix:** Remove utilizationTarget field, remove runtime 85% calculations, keep only compression trigger (75%)

**Files:** `packages/core/src/context/types.ts`, `contextPool.ts`, `compressionCoordinator.ts`, tests

**Progress:**
- [ ] Docs read
- [ ] Repo scanned
- [ ] Plan approved
- [ ] Backup created
- [ ] Tests baseline
- [ ] Code changed
- [ ] Tests pass
- [ ] Committed

---

## TASK 3: Fix Auto-Sizing Warning

**Priority:** 🔥 CRITICAL | **Effort:** 2-4h | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ContextManagement.md` (Auto-Sizing section)

**Problem:** Dynamic resize on low memory (line 227-238 contextManager.ts)

**Fix:** Replace resize with warning message. Context size stays FIXED for session.

**Files:** `packages/core/src/context/contextManager.ts` (line 227-238), tests

**Progress:**
- [ ] Docs read
- [ ] Repo scanned
- [ ] Plan approved
- [ ] Backup created
- [ ] Tests baseline
- [ ] Code changed
- [ ] Warning tested
- [ ] Tests pass
- [ ] Committed

---

## TASK 4: Fix Compression System (Dynamic Budget)

**Priority:** 🔥 CRITICAL | **Effort:** 2-3 days | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ContextCompression.md` (COMPLETE - read all)
- `.dev/docs/devs/knowledgeDB/dev_ContextManagement.md` (Context budget section)

**Problem:** Compression doesn't account for checkpoint space in budget → rapid re-compression

**Fix:** 
1. Track checkpoints
2. Calculate available budget = ollama_size - system - checkpoints
3. Trigger at 80% of AVAILABLE (not total)
4. Implement checkpoint aging

**Files:** `contextManager.ts`, `compressionCoordinator.ts`, `compressionService.ts`, `checkpointManager.ts`, `types.ts`, tests

**Progress:**
- [ ] Docs read (both files)
- [ ] Repo scanned
- [ ] Current code understood
- [ ] Plan approved
- [ ] Backup created
- [ ] Tests baseline
- [ ] Checkpoint tracking added
- [ ] Tests pass
- [ ] Compression trigger updated
- [ ] Tests pass
- [ ] Checkpoint aging implemented
- [ ] Tests pass
- [ ] Integration test passed
- [ ] Committed

---

## TASK 5: Fix Tool Integration with LLM

**Priority:** 🔥 CRITICAL | **Effort:** 2-4h | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ToolExecution.md`

**Problem:** LLM provides advice instead of using tools

**ROOT CAUSE:** Tools not passed to provider (chatClient.ts line ~370)

**Fix:** Add tools to turnOptions

**Files:** `packages/core/src/core/chatClient.ts` (line ~370), tests

**Progress:**
- [ ] Docs read
- [ ] Repo scanned
- [ ] Plan approved
- [ ] Backup created
- [ ] Tool registration verified
- [ ] Code changed
- [ ] Manual test passed
- [ ] Tests pass
- [ ] Committed

---

## TASK 6: Ollama Settings Management

**Priority:** 🔥 CRITICAL | **Effort:** 1 day | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ProviderSystem.md` (Ollama Settings section)
- `.dev/docs/devs/knowledgeDB/dev_npm_package.md` (npm packaging strategy)

**Problem:** Hardcoded `http://localhost:11434`, no user control over auto-start

**Goal:** Allow users to configure Ollama settings and control auto-start behavior

**Settings Structure:**
```json
// ~/.ollm/settings.json
{
  "provider": {
    "ollama": {
      "autoStart": true,
      "host": "localhost",
      "port": 11434,
      "url": "http://localhost:11434"
    }
  }
}
```

**Implementation Steps:**

**A. Create SettingsService:**
```typescript
// packages/core/src/services/settingsService.ts
class SettingsService {
  private settingsPath = '~/.ollm/settings.json';
  
  async load(): Promise<Settings> {
    // Read from ~/.ollm/settings.json
    // Return default if not exists
  }
  
  async save(settings: Settings): Promise<void> {
    // Write to ~/.ollm/settings.json
    // Atomic write
  }
  
  getOllamaConfig(): OllamaConfig {
    // Return ollama settings
  }
}
```

**B. Update Provider to Read Settings:**
```typescript
// packages/ollm-bridge/src/provider/localProvider.ts
constructor(settingsService: SettingsService) {
  const config = settingsService.getOllamaConfig();
  this.baseUrl = config.url; // From settings, not hardcoded
}
```

**C. Update Auto-Start Logic:**
```typescript
// App startup
const settings = await settingsService.load();
if (settings.provider.ollama.autoStart) {
  await startOllamaServe();
}
```

**D. Add Settings Commands:**
```bash
/config ollama autostart on
/config ollama autostart off
/config ollama host localhost
/config ollama port 11434
/config ollama show
```

**Files to Create/Modify:**
- `packages/core/src/services/settingsService.ts` - NEW: Settings management
- `packages/ollm-bridge/src/provider/localProvider.ts` - Read from settings
- `packages/cli/src/commands/configCommands.ts` - Add ollama config commands
- `packages/cli/src/ui/components/settings/OllamaSettings.tsx` - NEW: Settings UI (optional)
- `~/.ollm/settings.json` - User settings file (created on first run)

**Default Settings (on first run):**
```json
{
  "provider": {
    "ollama": {
      "autoStart": true,
      "host": "localhost",
      "port": 11434,
      "url": "http://localhost:11434"
    }
  }
}
```

**Progress:**
- [ ] Docs read
- [ ] Repo scanned
- [ ] Plan approved
- [ ] Backup created
- [ ] Tests baseline
- [ ] SettingsService created
- [ ] Tests pass
- [ ] Provider updated
- [ ] Tests pass
- [ ] Auto-start logic updated
- [ ] Tests pass
- [ ] Config commands added
- [ ] Manual test passed
- [ ] Committed

---

## TASK 7: Fix Session History Storage (BROKEN)

**Priority:** 🔥 CRITICAL | **Effort:** 1-2 days | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ContextCompression.md` (Session storage section)

**Problem:** Session files created but EMPTY - full history not being saved

**Goal:** Maintain two separate storage systems:
1. **Active Context** (compressed, sent to LLM) - in memory
2. **Full History** (uncompressed, for user) - on disk

**Architecture:**
```
User Message
  ↓
├─ Active Context (Memory)
│  ├─ System Prompt
│  ├─ Checkpoints (compressed)
│  ├─ User Messages (never compressed)
│  └─ Recent Messages
│  └─ Sent to LLM
│
└─ Full History (Disk)
   ├─ ALL messages (uncompressed)
   ├─ ALL tool calls
   ├─ Metadata (tokens, compressions)
   └─ Saved to ~/.ollm/sessions/{sessionId}.json
```

**Key Principle:**
- Active context gets compressed for LLM efficiency
- Full history NEVER compressed - always complete record
- User can review full conversation anytime

**Investigation Steps:**

**A. Debug Session Recording:**
```typescript
// Add logging to chatRecordingService.ts
console.log('[ChatRecording] createSession:', sessionId);
console.log('[ChatRecording] recordMessage:', message);
console.log('[ChatRecording] saveSession called, autoSave:', this.autoSave);
console.log('[ChatRecording] Writing to:', filePath);
```

**B. Check Integration:**
```typescript
// Verify in chatClient.ts
// Line 204-207: Session creation
// Line 472-475: Message recording
// Line 627: Session save
```

**C. Test File Write:**
```bash
# Check if session files exist
ls -la ~/.ollm/sessions/

# Check file contents
cat ~/.ollm/sessions/<sessionId>.json

# Check file permissions
ls -l ~/.ollm/sessions/
```

**Possible Causes:**
1. `autoSave` disabled (should be `true`)
2. Session cache not updating
3. File write failing silently
4. Session ID mismatch

**Implementation Steps:**

**Step 1: Add Debug Logging**
- Add console.log to track execution
- Verify autoSave is enabled
- Track file write operations

**Step 2: Test and Identify Root Cause**
- Run CLI and send message
- Check console output
- Verify file is created and has data

**Step 3: Fix Root Cause**
- If autoSave disabled → enable it
- If cache not updating → fix cache logic
- If file write failing → add error handling
- If session ID mismatch → fix ID passing

**Step 4: Verify Full History Preservation**
- Ensure records ALL messages before compression
- Ensure compression only affects active context
- Add tests

**Files to Debug/Modify:**
- `packages/core/src/services/chatRecordingService.ts` - Add logging, verify autoSave
- `packages/core/src/core/chatClient.ts` - Verify session ID passing
- `packages/core/src/context/compressionCoordinator.ts` - Ensure doesn't affect disk storage
- `packages/core/src/services/__tests__/chatRecordingService.test.ts` - Tests

**Progress:**
- [ ] Docs read
- [ ] Repo scanned
- [ ] Plan approved
- [ ] Backup created
- [ ] Debug logging added
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tests pass
- [ ] Manual test passed (file has data)
- [ ] Committed

---

## TASK 8: Restore Confidence/Reliability Display

**Priority:** 🔥 CRITICAL | **Effort:** 1-2 weeks | **Status:** ⏳ Not Started

**Documentation (READ FIRST):**
- `.dev/docs/devs/knowledgeDB/dev_ContextCompression.md` (Reliability section)
- `.dev/docs/devs/knowledgeDB/dev_ModelManagement.md` (Model size detection)

**Problem:** Users can't see context quality degradation after multiple compressions

**Goal:** Show reliability indicator next to context size based on:
- Model size (3B, 7B, 13B, 30B, 70B+)
- Compression count (each compression reduces reliability)
- Context confidence (from ContextAnalyzer)

**UI Display:**
```
Context: 5,234/13,926 tokens  🟢 92%  (2 compressions)
```

**Reliability Calculation:**
```typescript
// packages/core/src/context/reliabilityCalculator.ts
interface ReliabilityFactors {
  modelSize: number;        // 3, 7, 13, 30, 70+ (billions)
  compressionCount: number; // Number of compressions
  contextConfidence: number; // From ContextAnalyzer (0.0-1.0)
}

function calculateReliability(factors: ReliabilityFactors): {
  score: number;      // 0.0-1.0
  level: 'high' | 'medium' | 'low' | 'critical';
  icon: string;       // 🟢🟡🟠🔴
  message: string;    // User-friendly message
}
```

**Model Size Factor:**
- 70B+ models: 95% base reliability
- 30B models: 85% base reliability
- 13B models: 70% base reliability
- 7B models: 50% base reliability
- 3B models: 30% base reliability

**Compression Penalty:**
- Each compression: -15% reliability
- Minimum: 30% (never go below)

**Implementation Steps:**

**A. Create Reliability Calculator:**
```typescript
// packages/core/src/context/reliabilityCalculator.ts
export function calculateReliability(factors: ReliabilityFactors) {
  const modelFactor = getModelFactor(factors.modelSize);
  const compressionPenalty = Math.max(
    1.0 - (factors.compressionCount * 0.15),
    0.30
  );
  
  const score = modelFactor * compressionPenalty * factors.contextConfidence;
  
  return {
    score,
    level: getLevel(score),
    icon: getIcon(score),
    message: getMessage(score, factors)
  };
}
```

**B. Add Model Size Detection:**
```typescript
// packages/core/src/context/modelSizeDetector.ts
export function detectModelSize(modelName: string): number {
  // Extract from name: "llama3:7b" -> 7
  const match = modelName.match(/(\d+)b/i);
  if (match) return parseInt(match[1]);
  
  // Fallback: 7B default
  return 7;
}
```

**C. Track Compression Count:**
```typescript
// In contextManager.ts
private compressionCount: number = 0;

async compress() {
  // ... compression logic
  this.compressionCount++;
  this.updateReliability();
}
```

**D. Update UI Display:**
```tsx
// packages/cli/src/ui/components/layout/ContextSection.tsx
<Box flexDirection="row" gap={2}>
  <Text>Context: {currentTokens}/{maxTokens}</Text>
  <Text>{reliabilityIcon} {Math.round(reliabilityScore * 100)}%</Text>
  {compressionCount > 0 && (
    <Text dimColor>({compressionCount} compressions)</Text>
  )}
</Box>

{reliabilityLevel === 'low' && (
  <Box marginTop={1}>
    <Text color="yellow">⚠️ {reliabilityMessage}</Text>
  </Box>
)}
```

**E. Goal Preservation (CRITICAL):**
```typescript
// Goals NEVER compressed
context.messages = [
  systemPrompt,           // Never compressed
  activeGoal,             // Never compressed ✅
  goalCheckpoints,        // Never compressed ✅
  ...checkpoints,         // Compressed history
  ...userMessages,        // Never compressed
  ...recentMessages       // Not yet compressed
];
```

**F. Goal-Aware Summarization:**
```typescript
// Include active goal in compression prompt
const summaryPrompt = `Active Goal: ${activeGoal.description}

Summarize the following conversation, focusing on progress toward the goal:
${messagesToCompress.join('\n')}

Preserve: decisions, milestones, blockers, key insights.`;
```

**Warning Messages:**
```
🟢 High reliability (85%+)
No warning

🟡 Medium reliability (60-85%)
"Context has been compressed 2 times. Quality may degrade with more compressions."

🟠 Low reliability (40-60%)
"⚠️ Context compressed 4 times with 7B model. Consider starting new conversation."

🔴 Critical reliability (<40%)
"⚠️ Context quality critically degraded. Start new conversation recommended."
```

**Files to Create/Modify:**
- `packages/core/src/context/reliabilityCalculator.ts` - NEW: Reliability calculation
- `packages/core/src/context/modelSizeDetector.ts` - NEW: Model size detection
- `packages/core/src/context/contextManager.ts` - Track compression count, calculate reliability
- `packages/core/src/context/compressionCoordinator.ts` - Goal preservation
- `packages/core/src/context/compressionService.ts` - Goal-aware summarization
- `packages/core/src/context/goalManager.ts` - Integration with compression
- `packages/cli/src/ui/components/layout/ContextSection.tsx` - Add reliability display
- `packages/cli/src/ui/components/layout/ModeConfidenceDisplay.tsx` - Restore (was disabled)
- `packages/core/src/context/__tests__/*.test.ts` - Tests

**Progress:**
- [ ] Docs read
- [ ] Repo scanned
- [ ] Plan approved
- [ ] Backup created
- [ ] Tests baseline
- [ ] Reliability calculator created
- [ ] Tests pass
- [ ] Model size detector created
- [ ] Tests pass
- [ ] Compression count tracking added
- [ ] Tests pass
- [ ] UI display updated
- [ ] Tests pass
- [ ] Goal preservation implemented
- [ ] Tests pass
- [ ] Goal-aware summarization added
- [ ] Tests pass
- [ ] Manual test passed
- [ ] Committed

---

## 🔒 PRESERVE (DO NOT TOUCH)

- MCP system (marketplace, connections, OAuth, health monitoring)
- Hook system (registration, events, whitelist)
- Tool system UI (rendering, execution)

---

## Priority Timeline

| Day | Task |
|-----|------|
| 1-2 | Task 1: Simplify Tier Selection |
| 2   | Task 2: Remove Runtime 85% Calc |
| 2   | Task 3: Fix Auto-Sizing Warning |
| 3-5 | Task 4: Fix Compression System |
| 5-6 | Task 7: Fix Session History Storage |
| 6-7 | Task 8: Restore Confidence/Reliability Display |
| 7   | Task 5: Fix Tool Integration |
| 7   | Task 6: Ollama Settings Management |
| 7   | Final Testing & Bug Fixes |

**Note:** Tasks 5 & 6 are quick (2-4h each), can be done in parallel on Day 7
