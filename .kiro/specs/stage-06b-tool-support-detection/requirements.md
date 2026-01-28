# Tool Support Detection - Requirements

**Feature:** Robust tool support detection and filtering for model hot-swapping  
**Priority:** Medium  
**Status:** Requirements Review  
**Created:** 2026-01-17

## Problem Statement

When users switch between models during a chat session (hot-swap), tools may be sent to models that don't support function calling, causing:

- Confusing error messages
- Retry overhead and latency
- Wasted agent loop turns
- Poor user experience

Users can upload custom models not in our database, so we need robust multi-layer detection.

## User Stories

### US-1: Model Swap with Tool Filtering

**As a** user  
**I want** tools to be automatically disabled when I switch to a model that doesn't support them  
**So that** I don't see confusing errors or wasted attempts

**Acceptance Criteria:**

- 1.1: When switching from tool-capable to non-capable model, tools are filtered before sending to LLM
- 1.2: No tool-related errors appear in chat
- 1.3: Agent loop doesn't attempt impossible tool calls
- 1.4: System message confirms tool support status on model swap

### US-2: Unknown Model Handling

**As a** user who uploads custom models  
**I want** the system to ask me about tool support for unknown models  
**So that** I can configure capabilities correctly

**Acceptance Criteria:**

- 2.1: When switching to unknown model, system prompts: "Does this model support tools? (y/n/auto-detect)"
- 2.2: User can choose manual yes/no or auto-detect
- 2.3: Auto-detect sends test request and learns from response
- 2.4: Choice is saved to user_models.json for future sessions

### US-3: Runtime Learning with Confirmation

**As a** user  
**I want** the system to learn tool capabilities from actual usage  
**So that** metadata stays accurate even if profiles are wrong

**Acceptance Criteria:**

- 3.1: When runtime detects tool support mismatch, system asks for confirmation
- 3.2: Prompt: "This model appears to [support/not support] tools. Update metadata? (y/n)"
- 3.3: User approval required before persisting to user_models.json
- 3.4: Session-only override if user declines

### US-4: Graceful Agent Loop Handling

**As a** user  
**I want** in-flight tool calls to complete when I swap models  
**So that** I don't lose partial work

**Acceptance Criteria:**

- 4.1: Current turn completes with existing tool calls
- 4.2: Next turn uses new model's tool support settings
- 4.3: No abrupt cancellation of pending operations
- 4.4: Clear transition in chat history

### US-5: Startup Metadata Refresh

**As a** user  
**I want** model metadata to update automatically on startup  
**So that** I always have current information

**Acceptance Criteria:**

- 5.1: On CLI startup, check for new/changed models
- 5.2: Update user_models.json with latest metadata
- 5.3: Preserve user overrides (manual_context, etc.)
- 5.4: Fast startup (< 2 seconds for metadata check)

### US-6: Multi-Layer Defense

**As a** developer  
**I want** tool filtering at multiple layers  
**So that** custom/unknown models are handled safely

**Acceptance Criteria:**

- 6.1: Chat loop checks tool support before creating ToolRegistry
- 6.2: ModelContext filters tools before sending to provider
- 6.3: Provider retries without tools on 400 errors (existing)
- 6.4: System prompt includes note when tools disabled

## Non-Functional Requirements

### Performance

- NFR-1: Model swap should complete in < 500ms
- NFR-2: Auto-detect probe should timeout after 5 seconds
- NFR-3: Startup metadata refresh should not delay CLI launch

### Reliability

- NFR-4: Unknown models default to safe settings (tool_support: false)
- NFR-5: Runtime detection errors don't crash the session
- NFR-6: User confirmations have sensible defaults (no = safe)

### Usability

- NFR-7: System messages are clear and actionable
- NFR-8: User prompts have obvious choices (y/n/auto)
- NFR-9: Tool support status visible in model swap confirmation

### Maintainability

- NFR-10: Tool support logic centralized in ModelContext
- NFR-11: Detection strategy configurable via settings
- NFR-12: Logging for debugging tool support issues

## Data Model

### user_models.json Enhancement

```json
{
  "user_models": [
    {
      "id": "custom-model:latest",
      "name": "Custom Model",
      "tool_support": true,
      "tool_support_source": "user_confirmed", // NEW: track how we learned
      "tool_support_confirmed_at": "2026-01-17T10:30:00Z", // NEW: when confirmed
      "last_seen": "2026-01-17T10:00:00Z"
      // ... other fields
    }
  ]
}
```

### Runtime Override State

```typescript
// In ModelContext
toolSupportOverridesRef: Map<
  string,
  {
    supported: boolean;
    source: 'profile' | 'runtime_error' | 'user_confirmed' | 'auto_detected';
    timestamp: number;
  }
>;
```

## Dependencies

- ProfileManager (existing) - model metadata lookup
- ModelContext (existing) - model management and tool filtering
- ChatContext (existing) - chat loop and tool invocation
- LocalProvider (existing) - provider-level retry logic

## Out of Scope

- Automatic tool capability probing for all models (too slow)
- UI for bulk editing tool support in user_models.json
- Tool support detection for non-Ollama providers (future)
- Per-tool capability detection (all-or-nothing for now)

## Success Metrics

- Zero tool-related errors after model swap
- < 1% of users report tool support issues
- 95% of unknown models correctly configured within first use
- No performance regression on model swap

## Open Questions

1. Should auto-detect be the default for unknown models? (Adds latency)
2. How long should we cache runtime detection results? (Session vs persistent)
3. Should we show tool support in model selection menu? (UI change)
4. What happens if user_models.json is corrupted? (Fallback strategy)

## References

- Investigation: `.dev/debuging/tool-hotswap-investigation.md`
- Model DB docs: `.dev/docs/Models/development/models_db.md`
- Bugtracker: `.dev/bugtracker.md` (Medium priority issue)
