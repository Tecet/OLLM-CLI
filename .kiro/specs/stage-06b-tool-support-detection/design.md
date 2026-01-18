# Tool Support Detection - Design

**Feature:** Robust tool support detection and filtering for model hot-swapping  
**Status:** Design Review  
**Created:** 2026-01-17

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Model Swap                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ ModelContext.setCurrentModel()                               │
│ - Load metadata from ProfileManager                          │
│ - Check tool_support flag                                    │
│ - Set proactive override if needed                           │
│ - Show system message with tool status                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Unknown Model? (not in user_models.json)                     │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    Yes  │               │  No
         ▼               ▼
┌──────────────┐  ┌──────────────────────────────────────────┐
│ Prompt User  │  │ Use Metadata                              │
│ y/n/auto     │  │ - tool_support from profile/user_models  │
└──────┬───────┘  └──────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ ChatContext.sendMessage()                                    │
│ - Check modelSupportsTools(currentModel)                     │
│ - Conditionally create ToolRegistry                          │
│ - Add system prompt note if tools disabled                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ ModelContext.sendToLLM()                                     │
│ - Filter tools based on modelSupportsTools()                 │
│ - Pass filtered tools to provider                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ LocalProvider.chatStream()                                   │
│ - Detect tool errors (400 + tool keywords)                   │
│ - Retry without tools if error detected                      │
│ - Return error event for runtime learning                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Runtime Learning (if error detected)                         │
│ - Prompt user: "Update metadata? (y/n)"                      │
│ - Save to user_models.json if confirmed                      │
│ - Set session override if declined                           │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. ModelContext Enhancements

**File:** `packages/cli/src/features/context/ModelContext.tsx`

#### New State
```typescript
// Enhanced override tracking
const toolSupportOverridesRef = useRef<Map<string, {
  supported: boolean;
  source: 'profile' | 'runtime_error' | 'user_confirmed' | 'auto_detected';
  timestamp: number;
}>>(new Map());

// Unknown model prompt state
const [unknownModelPrompt, setUnknownModelPrompt] = useState<{
  modelId: string;
  onComplete: (supported: boolean | 'auto') => void;
} | null>(null);
```

#### Enhanced setCurrentModel
```typescript
const setModelAndLoading = useCallback((model: string) => {
  const changed = currentModel !== model;
  if (changed) {
    // 1. Check if model is in database
    const userModels = profileManager.getUserModels();
    const userModel = userModels.find(m => m.id === model);
    const profile = profileManager.findProfile(model);
    
    // 2. Unknown model handling
    if (!userModel && !profile) {
      setUnknownModelPrompt({
        modelId: model,
        onComplete: async (supported) => {
          if (supported === 'auto') {
            await autoDetectToolSupport(model);
          } else {
            await saveToolSupport(model, supported);
          }
          setUnknownModelPrompt(null);
        }
      });
      return; // Wait for user input
    }
    
    // 3. Proactive override from metadata
    const toolSupport = userModel?.tool_support ?? profile?.tool_support ?? false;
    if (!toolSupport) {
      toolSupportOverridesRef.current.set(model, {
        supported: false,
        source: 'profile',
        timestamp: Date.now()
      });
    }
    
    // 4. Show system message
    addSystemMessage(
      `Switched to ${model}. Tools: ${toolSupport ? 'Enabled' : 'Disabled'}`
    );
    
    // 5. Proceed with model swap
    setCurrentModel(model);
    setModelLoading(true);
    // ... rest of existing code
  }
}, [currentModel, provider]);
```

#### Auto-Detect Tool Support
```typescript
const autoDetectToolSupport = useCallback(async (model: string) => {
  addSystemMessage(`Auto-detecting tool support for ${model}...`);
  
  const testTools: ToolSchema[] = [{
    name: 'test_tool',
    description: 'Test tool for capability detection',
    parameters: { type: 'object', properties: {} }
  }];
  
  try {
    const stream = provider.chatStream({
      model,
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'test' }] }],
      tools: testTools,
      abortSignal: AbortSignal.timeout(5000)
    });
    
    let hasError = false;
    for await (const event of stream) {
      if (event.type === 'error') {
        hasError = isToolUnsupportedError(event.error.message || '');
        break;
      }
    }
    
    const supported = !hasError;
    await saveToolSupport(model, supported, 'auto_detected');
    addSystemMessage(
      `Tool support detected: ${supported ? 'Enabled' : 'Disabled'}`
    );
  } catch (error) {
    addSystemMessage('Auto-detect failed. Defaulting to tools disabled.');
    await saveToolSupport(model, false, 'auto_detected');
  }
}, [provider]);
```

#### Save Tool Support
```typescript
const saveToolSupport = useCallback(async (
  model: string,
  supported: boolean,
  source: 'user_confirmed' | 'auto_detected' = 'user_confirmed'
) => {
  // Update runtime override
  toolSupportOverridesRef.current.set(model, {
    supported,
    source,
    timestamp: Date.now()
  });
  
  // Update user_models.json
  const userModels = profileManager.getUserModels();
  const existing = userModels.find(m => m.id === model);
  
  if (existing) {
    existing.tool_support = supported;
    existing.tool_support_source = source;
    existing.tool_support_confirmed_at = new Date().toISOString();
  } else {
    userModels.push({
      id: model,
      name: model,
      source: 'ollama',
      last_seen: new Date().toISOString(),
      tool_support: supported,
      tool_support_source: source,
      tool_support_confirmed_at: new Date().toISOString(),
      description: 'Custom model',
      abilities: [],
      context_profiles: [], // Will be filled by /model list
      default_context: 4096
    });
  }
  
  profileManager.setUserModels(userModels);
}, []);
```

#### Runtime Learning Handler
```typescript
const handleToolError = useCallback(async (model: string, error: string) => {
  if (!isToolUnsupportedError(error)) return;
  
  const override = toolSupportOverridesRef.current.get(model);
  if (override?.source === 'user_confirmed') return; // Don't override user choice
  
  // Prompt user for confirmation
  const confirmed = await promptUser(
    `This model appears to not support tools. Update metadata? (y/n)`,
    ['y', 'n']
  );
  
  if (confirmed === 'y') {
    await saveToolSupport(model, false, 'user_confirmed');
    addSystemMessage('Tool support disabled and saved.');
  } else {
    // Session-only override
    toolSupportOverridesRef.current.set(model, {
      supported: false,
      source: 'runtime_error',
      timestamp: Date.now()
    });
    addSystemMessage('Tool support disabled for this session.');
  }
}, []);
```

### 2. ChatContext Enhancements

**File:** `packages/cli/src/features/context/ChatContext.tsx`

#### Conditional Tool Registry
```typescript
const sendMessage = useCallback(async (content: string) => {
  // ... existing command handling ...
  
  setWaitingForResponse(true);
  setStreaming(true);

  // Check tool support BEFORE creating registry
  const supportsTools = modelSupportsTools(currentModel);
  
  let toolRegistry: ToolRegistry | undefined;
  let toolSchemas: ToolSchema[] | undefined;
  
  if (supportsTools) {
    toolRegistry = new ToolRegistry();
    const promptRegistry = new PromptRegistry();
    
    const manager = contextActions.getManager();
    if (manager && provider) {
      toolRegistry.register(new HotSwapTool(manager, promptRegistry, provider, currentModel));
      toolRegistry.register(new MemoryDumpTool());
      const toolNames = toolRegistry.list().map(t => t.name);
      manager.emit('active-tools-updated', toolNames);
    }
    
    toolSchemas = toolRegistry.list().map(t => t.schema);
  }
  
  // Get system prompt with tool note if needed
  let systemPrompt = contextActions.getSystemPrompt();
  if (!supportsTools) {
    systemPrompt += '\n\nNote: This model does not support function calling. ' +
                    'Do not attempt to use tools or make tool calls.';
  }
  
  // ... rest of agent loop with toolSchemas and toolRegistry ...
}, [/* deps */]);
```

#### Graceful Agent Loop Transition
```typescript
// In agent loop
while (turnCount < maxTurns && !stopLoop) {
  turnCount++;
  
  // Check if model changed mid-loop
  if (currentModel !== initialModel) {
    addSystemMessage(
      'Model changed during conversation. Completing current turn...'
    );
    stopLoop = true; // Complete this turn, stop after
  }
  
  // ... rest of turn logic ...
}
```

### 3. ProfileManager Enhancements

**File:** `packages/cli/src/features/profiles/ProfileManager.ts`

#### Startup Metadata Refresh
```typescript
export class ProfileManager {
  constructor() {
    // ... existing initialization ...
    
    // Auto-refresh on startup (async, non-blocking)
    this.refreshMetadataAsync().catch(err => {
      console.warn('Failed to refresh model metadata:', err);
    });
  }
  
  private async refreshMetadataAsync(): Promise<void> {
    try {
      // Check if Ollama is available
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const models = data.models.map((m: any) => ({
        name: m.name,
        sizeBytes: m.size
      }));
      
      // Update user models (preserves user overrides)
      this.updateUserModelsFromList(models);
    } catch (error) {
      // Silent fail - not critical
    }
  }
}
```

### 4. User Prompt Component

**File:** `packages/cli/src/features/context/UserPromptContext.tsx` (new)

```typescript
export interface UserPromptContextValue {
  promptUser: (message: string, options: string[]) => Promise<string>;
}

export function UserPromptProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<{
    message: string;
    options: string[];
    resolve: (value: string) => void;
  } | null>(null);
  
  const promptUser = useCallback((message: string, options: string[]) => {
    return new Promise<string>((resolve) => {
      setPrompt({ message, options, resolve });
    });
  }, []);
  
  const handleResponse = useCallback((value: string) => {
    if (prompt) {
      prompt.resolve(value);
      setPrompt(null);
    }
  }, [prompt]);
  
  return (
    <UserPromptContext.Provider value={{ promptUser }}>
      {children}
      {prompt && (
        <UserPromptDialog
          message={prompt.message}
          options={prompt.options}
          onResponse={handleResponse}
        />
      )}
    </UserPromptContext.Provider>
  );
}
```

## Data Flow

### Model Swap Flow
```
User: /model use gemma3:1b
  ↓
ModelContext.setCurrentModel('gemma3:1b')
  ↓
ProfileManager.findProfile('gemma3:1b')
  ↓
Found: tool_support = false
  ↓
Set proactive override
  ↓
Show system message: "Switched to gemma3:1b. Tools: Disabled"
  ↓
Next message: ChatContext checks modelSupportsTools()
  ↓
Returns false → Don't create ToolRegistry
  ↓
Add note to system prompt
  ↓
Send to LLM without tools
```

### Unknown Model Flow
```
User: /model use custom-model:latest
  ↓
ModelContext.setCurrentModel('custom-model:latest')
  ↓
ProfileManager.findProfile('custom-model:latest')
  ↓
Not found → Unknown model
  ↓
Show prompt: "Does this model support tools? (y/n/auto-detect)"
  ↓
User selects: auto-detect
  ↓
Send test request with tools (5s timeout)
  ↓
Detect error or success
  ↓
Save to user_models.json with source='auto_detected'
  ↓
Proceed with model swap
```

### Runtime Learning Flow
```
User sends message
  ↓
Tools sent to LLM
  ↓
Provider returns 400 error with "unknown field: tools"
  ↓
Provider retries without tools (existing behavior)
  ↓
ModelContext.handleToolError() triggered
  ↓
Check if already user_confirmed → Skip if yes
  ↓
Prompt: "This model appears to not support tools. Update metadata? (y/n)"
  ↓
User: y
  ↓
Save to user_models.json with source='user_confirmed'
  ↓
Future sessions use saved metadata
```

## Error Handling

### Unknown Model Timeout
```typescript
// If user doesn't respond to prompt within 30s
setTimeout(() => {
  if (unknownModelPrompt) {
    addSystemMessage('No response. Defaulting to tools disabled.');
    saveToolSupport(unknownModelPrompt.modelId, false, 'auto_detected');
    setUnknownModelPrompt(null);
  }
}, 30000);
```

### Auto-Detect Failure
```typescript
// If auto-detect times out or errors
catch (error) {
  addSystemMessage('Auto-detect failed. Defaulting to tools disabled.');
  await saveToolSupport(model, false, 'auto_detected');
}
```

### Corrupted user_models.json
```typescript
// In ProfileManager.loadUserModels()
try {
  const data = JSON.parse(content);
  if (!Array.isArray(data.user_models)) {
    throw new Error('Invalid format');
  }
  this.userModels = data.user_models;
} catch (error) {
  console.error('Corrupted user_models.json, resetting:', error);
  this.userModels = [];
  this.saveUserModels([]);
}
```

## Testing Strategy

### Unit Tests
- ModelContext.modelSupportsTools() with various scenarios
- ProfileManager.findProfile() fuzzy matching
- Tool support override logic
- System prompt modification

### Integration Tests
- Model swap from tool-capable to non-capable
- Model swap from non-capable to tool-capable
- Unknown model prompt flow
- Auto-detect flow
- Runtime learning flow

### Property-Based Tests
- Tool filtering consistency across layers
- Metadata persistence correctness
- Override precedence rules

## Performance Considerations

- **Startup refresh:** Async, non-blocking, 2s timeout
- **Auto-detect:** 5s timeout, user can skip
- **Metadata lookup:** O(n) but n is small (< 100 models)
- **Override map:** O(1) lookup

## Security Considerations

- **Safe defaults:** Unknown models default to no tools
- **User confirmation:** Required before persisting metadata
- **Timeout limits:** Prevent hanging on unresponsive models
- **Error isolation:** Tool errors don't crash session

## Correctness Properties

**Validates: Requirements 1.1, 1.2, 1.3**
```typescript
// Property: Tools never sent to non-supporting models
fc.property(
  fc.record({
    model: fc.string(),
    toolSupport: fc.boolean(),
    hasTools: fc.boolean()
  }),
  ({ model, toolSupport, hasTools }) => {
    // Setup
    setToolSupport(model, toolSupport);
    const tools = hasTools ? [testTool] : undefined;
    
    // Act
    const filtered = filterTools(model, tools);
    
    // Assert
    if (!toolSupport) {
      expect(filtered).toBeUndefined();
    }
  }
);
```

**Validates: Requirements 2.1, 2.2, 2.3**
```typescript
// Property: Unknown models always prompt or use safe default
fc.property(
  fc.string(),
  (unknownModel) => {
    // Setup: Model not in database
    
    // Act
    const result = handleUnknownModel(unknownModel);
    
    // Assert: Either prompts user or defaults to false
    expect(
      result.prompted || result.toolSupport === false
    ).toBe(true);
  }
);
```

## Migration Plan

1. **Phase 1:** Add new fields to user_models.json (backward compatible)
2. **Phase 2:** Implement ModelContext enhancements
3. **Phase 3:** Implement ChatContext conditional registry
4. **Phase 4:** Add user prompt UI
5. **Phase 5:** Enable startup refresh
6. **Phase 6:** Deploy and monitor

## Rollback Plan

If issues arise:
1. Disable startup refresh (config flag)
2. Disable runtime learning (config flag)
3. Revert to provider-level filtering only
4. User can manually edit user_models.json

## Open Design Questions

1. Should we cache auto-detect results across restarts? (Currently yes via user_models.json)
2. Should we show tool support in model selection menu? (UI change required)
3. Should we allow per-tool capability detection? (Future enhancement)
4. Should we support tool support detection for non-Ollama providers? (Future)

## References

- Requirements: `.kiro/specs/tool-support-detection/requirements.md`
- Investigation: `.dev/debuging/tool-hotswap-investigation.md`
- Model DB: `.dev/docs/Models/development/models_db.md`
