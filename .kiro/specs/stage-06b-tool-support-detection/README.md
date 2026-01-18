# Tool Support Detection - Spec Summary

**Feature:** Robust tool support detection and filtering for model hot-swapping  
**Priority:** Medium  
**Status:** Ready for Implementation  
**Created:** 2026-01-17

## Quick Links

- [Requirements](./requirements.md) - User stories and acceptance criteria
- [Design](./design.md) - Architecture and implementation details
- [Tasks](./tasks.md) - Implementation task breakdown
- Investigation (./../../../.dev/debuging/tool-hotswap-investigation.md) - Root cause analysis

## Problem

When users switch between models during a chat session, tools may be sent to models that don't support function calling, causing errors, retry overhead, and poor UX. Users can upload custom models not in our database, requiring robust multi-layer detection.

## Solution

Implement a **defense-in-depth** approach with three layers:

1. **Proactive Detection** - Check metadata on model swap
2. **Chat Loop Filtering** - Conditionally create tool registry
3. **Provider Retry** - Fallback safety net (existing)

Plus intelligent handling for unknown models with user confirmation.

## Key Design Decisions

Based on discussion with user:

1. ✅ **Filter Location:** Both chat loop and provider (defense in depth)
2. ✅ **Tool Registry:** Conditional creation (only if model supports tools)
3. ✅ **System Prompt:** Add explicit note when tools disabled
4. ✅ **UI Feedback:** Warning message on model swap
5. ✅ **Detection:** Hybrid (proactive + reactive fallback)
6. ✅ **Unknown Models:** Ask user with auto-detect option
7. ✅ **Agent Loop:** Complete current turn gracefully
8. ✅ **Metadata Updates:** Auto-update on startup
9. ✅ **Runtime Learning:** Learn with user confirmation

## Architecture

```
User Swaps Model
    ↓
ModelContext checks metadata
    ↓
Unknown? → Prompt user (y/n/auto-detect)
    ↓
ChatContext checks tool support
    ↓
Conditionally create ToolRegistry
    ↓
Add system prompt note if needed
    ↓
ModelContext filters tools
    ↓
Provider retries on error (safety net)
    ↓
Runtime learning with user confirmation
```

## Data Model Changes

### user_models.json Enhancement
```json
{
  "id": "custom-model:latest",
  "tool_support": true,
  "tool_support_source": "user_confirmed",  // NEW
  "tool_support_confirmed_at": "2026-01-17T10:30:00Z"  // NEW
}
```

### Runtime Override State
```typescript
toolSupportOverridesRef: Map<string, {
  supported: boolean;
  source: 'profile' | 'runtime_error' | 'user_confirmed' | 'auto_detected';
  timestamp: number;
}>
```

## User Flows

### Known Model Swap
```
User: /model use gemma3:1b
System: Switched to gemma3:1b. Tools: Disabled
[Next message sent without tools]
```

### Unknown Model Swap
```
User: /model use custom-model:latest
System: Does this model support tools? (y/n/auto-detect)
User: auto-detect
System: Auto-detecting tool support...
System: Tool support detected: Enabled
System: Switched to custom-model:latest. Tools: Enabled
```

### Runtime Learning
```
[User sends message with tools to model]
[Provider returns tool error]
System: This model appears to not support tools. Update metadata? (y/n)
User: y
System: Tool support disabled and saved.
```

## Implementation Phases

1. **Phase 1:** Data Model & Infrastructure (2h)
2. **Phase 2:** ModelContext Enhancements (4h)
3. **Phase 3:** ChatContext Enhancements (2h)
4. **Phase 4:** ProfileManager Enhancements (2h)
5. **Phase 5:** Provider Integration (1h)
6. **Phase 6:** UI Components (2h)
7. **Phase 7:** Testing (4h)
8. **Phase 8:** Documentation & Cleanup (2h)

**Total Effort:** ~19 hours (2-3 days)

## Success Metrics

- ✅ Zero tool-related errors after model swap
- ✅ Unknown models prompt user or use safe default
- ✅ Runtime learning saves metadata with user confirmation
- ✅ All tests pass (unit, integration, property-based)
- ✅ No performance regression on model swap

## Testing Strategy

### Unit Tests
- modelSupportsTools() with various scenarios
- Override precedence logic
- Metadata persistence
- System prompt modification

### Integration Tests
- Model swap scenarios (tool → no-tool, no-tool → tool)
- Unknown model prompt flow
- Auto-detect flow
- Runtime learning flow

### Property-Based Tests
- Tools never sent to non-supporting models
- Unknown models always prompt or use safe default
- Metadata persistence consistency
- Override precedence correctness

## Risk Mitigation

- **Backward Compatibility:** New fields optional in user_models.json
- **Safe Defaults:** Unknown models default to tool_support: false
- **User Control:** Confirmation required before persisting metadata
- **Graceful Degradation:** Provider retry as safety net
- **Performance:** Async startup refresh, timeouts on auto-detect

## Related Issues

- Bugtracker: `.dev/bugtracker.md` (Medium priority)
- Investigation: `.dev/debuging/tool-hotswap-investigation.md`
- Model DB: `.dev/docs/Models/development/models_db.md`

## Next Steps

1. Review requirements and design with team
2. Begin Phase 1 implementation (data model)
3. Implement phases sequentially with testing
4. Update documentation and bugtracker
5. Deploy and monitor

---

**Status:** ✅ Spec Complete - Ready for Implementation  
**Estimated Completion:** 2-3 days  
**Risk Level:** Low-Medium
