# Remaining Work - Backlog

**Last Updated:** January 27, 2026  
**Status:** 4 tasks remaining  

---

## High Priority Tasks 🔥

### Task 5: Fix Tool Integration with LLM
**Priority:** 🔥 CRITICAL  
**Effort:** 2-4h  
**Status:** ⏳ Not Started  

**Problem:** LLM provides advice instead of using tools

**ROOT CAUSE:** Tools not passed to provider (chatClient.ts line ~370)

**Fix:**
```typescript
// Get all registered tools
const tools = this.toolRegistry.getAllTools().map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema
}));

const turnOptions: ChatOptions = {
  ...options,
  systemPrompt: systemPromptWithContext,
  tools: tools,  // ✅ Add tools here
};
```

**Files to Modify:**
- `packages/core/src/core/chatClient.ts` (line ~370)

**Testing:**
- Verify tools are passed to provider
- Test tool calling with real LLM
- Verify LLM uses tools instead of giving advice

---

### Task 6: Ollama Settings Management
**Priority:** 🔥 CRITICAL  
**Effort:** 1 day  
**Status:** ⏳ Not Started  

**Problem:** Hardcoded `http://localhost:11434`, no user control over auto-start

**Goal:** Allow users to configure Ollama settings

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
  
  async load(): Promise<Settings>
  async save(settings: Settings): Promise<void>
  getOllamaConfig(): OllamaConfig
}
```

**B. Update Provider:**
```typescript
// packages/ollm-bridge/src/provider/localProvider.ts
constructor(settingsService: SettingsService) {
  const config = settingsService.getOllamaConfig();
  this.baseUrl = config.url; // From settings
}
```

**C. Add Settings Commands:**
```bash
/config ollama autostart on
/config ollama autostart off
/config ollama host localhost
/config ollama port 11434
/config ollama show
```

**Files to Create:**
- `packages/core/src/services/settingsService.ts`
- `packages/cli/src/ui/components/settings/OllamaSettings.tsx` (optional)

**Files to Modify:**
- `packages/ollm-bridge/src/provider/localProvider.ts`
- `packages/cli/src/commands/configCommands.ts`

**Testing:**
- Test settings load/save
- Test provider reads from settings
- Test config commands
- Test auto-start behavior

---

### Task 8: Restore Confidence/Reliability Display
**Priority:** 🔥 CRITICAL  
**Effort:** 1-2 weeks  
**Status:** ⏳ Not Started  

**Problem:** Users can't see context quality degradation after multiple compressions

**Goal:** Show reliability indicator next to context size

**UI Display:**
```
Context: 5,234/13,926 tokens  🟢 92%  (2 compressions)
```

**Reliability Calculation:**
```typescript
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

**Files to Create:**
- `packages/core/src/context/reliabilityCalculator.ts`
- `packages/core/src/context/modelSizeDetector.ts`

**Files to Modify:**
- `packages/core/src/context/contextManager.ts` (track compression count)
- `packages/cli/src/ui/components/layout/ContextSection.tsx` (add display)
- `packages/cli/src/ui/components/layout/ModeConfidenceDisplay.tsx` (restore)

**Testing:**
- Test reliability calculation
- Test model size detection
- Test compression count tracking
- Test UI display
- Test warning messages

---

## Low Priority Tasks 🟢

### Phase 7: UI Enhancements
**Priority:** 🟢 LOW (Optional)  
**Effort:** 2-3 days  
**Status:** ⏳ Not Started  

**Goal:** Improve user experience with better UI feedback

**Tasks:**
- [ ] Checkpoint creation progress indicator
- [ ] Emergency warning messages
- [ ] Rollover explanation UI
- [ ] "View History" link to snapshots
- [ ] Context quality indicator (reliability score)
- [ ] Compression count display

**Files to Modify:**
- `packages/cli/src/features/context/ChatContext.tsx`
- `packages/cli/src/ui/components/layout/ContextSection.tsx`
- `packages/cli/src/ui/components/layout/ModeConfidenceDisplay.tsx`

**Success Criteria:**
- ✅ Progress indicators shown
- ✅ Warning messages clear
- ✅ Rollover explained
- ✅ History accessible
- ✅ Quality visible

**Note:** This is optional and can be done based on user feedback after production deployment.

---

## Completed But Needs Verification ✅

### Task 7: Fix Session History Storage
**Status:** ✅ VERIFIED WORKING (Phase 4)  
**Priority:** N/A  

**Note:** Phase 4 verified the session storage system is working correctly:
- Auto-save enabled by default
- Atomic writes with fsync
- Full history preservation
- Graceful interruption handling
- 18 comprehensive tests passing

**Conclusion:** This task is NOT needed. System is working as designed.

---

## Priority Timeline

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| 🔥 CRITICAL | Task 5: Tool Integration | 2-4h | ⏳ Not Started |
| 🔥 CRITICAL | Task 6: Ollama Settings | 1 day | ⏳ Not Started |
| 🔥 CRITICAL | Task 8: Reliability Display | 1-2 weeks | ⏳ Not Started |
| 🟢 LOW | Phase 7: UI Enhancements | 2-3 days | ⏳ Not Started |

**Total Remaining Effort:** ~2-3 weeks

---

## Recommendations

### Immediate Action (Next Sprint)
1. **Task 5: Tool Integration** (2-4h) - Quick fix, high impact
2. **Task 6: Ollama Settings** (1 day) - User experience improvement

### Short-Term Action (Following Sprint)
3. **Task 8: Reliability Display** (1-2 weeks) - Important for user awareness

### Long-Term Action (Based on User Feedback)
4. **Phase 7: UI Enhancements** (2-3 days) - Nice-to-have, can be deferred

---

## Dependencies

**Task 5:** No dependencies, can start immediately  
**Task 6:** No dependencies, can start immediately  
**Task 8:** No dependencies, can start immediately  
**Phase 7:** Optional, depends on user feedback  

**Note:** Tasks 5 and 6 can be done in parallel (different files, no conflicts)

---

## Success Criteria

### Task 5 (Tool Integration)
- ✅ Tools passed to provider
- ✅ LLM uses tools instead of giving advice
- ✅ All tests passing

### Task 6 (Ollama Settings)
- ✅ Settings file created
- ✅ Provider reads from settings
- ✅ Config commands work
- ✅ Auto-start configurable
- ✅ All tests passing

### Task 8 (Reliability Display)
- ✅ Reliability calculator works
- ✅ Model size detection works
- ✅ Compression count tracked
- ✅ UI displays reliability
- ✅ Warning messages shown
- ✅ All tests passing

### Phase 7 (UI Enhancements)
- ✅ Progress indicators shown
- ✅ Warning messages clear
- ✅ Rollover explained
- ✅ History accessible
- ✅ Quality visible

---

## Risk Assessment

### High Risk
- **Task 5:** Core feature broken (tool calling)
- **Task 8:** Users unaware of quality degradation

### Medium Risk
- **Task 6:** User experience (hardcoded settings)

### Low Risk
- **Phase 7:** Nice-to-have features (can be deferred)

---

## Conclusion

**Critical Work:** 3 tasks (Tasks 5, 6, 8)  
**Optional Work:** 1 task (Phase 7)  
**Total Effort:** ~2-3 weeks  

**Recommendation:** Focus on Tasks 5 and 6 first (quick wins), then Task 8 (longer effort), and defer Phase 7 based on user feedback.
