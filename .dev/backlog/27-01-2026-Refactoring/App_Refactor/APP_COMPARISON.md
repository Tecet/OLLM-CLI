# App.tsx Refactoring Comparison

**Date:** January 27, 2026  
**Status:** IN PROGRESS

---

## File Sizes

| Version | Lines | Change |
|---------|-------|--------|
| Old | 1,186 | - |
| New | 550 | -636 lines (54% reduction) |

---

## What Was Removed

### 1. **Ollama Health Check & Auto-Start Logic** (Lines 250-310)
**Removed:**
- `checkOllamaHealth()` function
- `startOllamaServe()` function
- `normalizeOllamaHost()` function
- `useEffect` for Ollama initialization
- System messages about Ollama status

**Why:** This is infrastructure logic that should be in a service, not UI layer

**Impact:** Need to move to ServiceProvider or separate OllamaService

---

### 2. **Hardware Info Persistence** (Lines 312-335)
**Removed:**
- `useEffect` that persists GPU info to settings
- Logic to compare live vs saved hardware info
- Automatic hardware info updates

**Why:** Settings persistence should be in SettingsService, not UI

**Impact:** Need to ensure GPUProvider handles this

---

### 3. **Model Loading Tracking** (Lines 600-610)
**Removed:**
- `prevModelLoadingRef` tracking
- `useEffect` that shows welcome message when model finishes loading
- Automatic welcome message on model switch

**Why:** Simplified - welcome message only shown on launch screen dismiss

**Impact:** May need to restore if users expect welcome on model switch

---

### 4. **Complex Layout Calculations** (Lines 730-850)
**Removed:**
- 10/80/10 split for main content area
- Spacer boxes on left and right
- Complex width calculations for content

**Why:** Simplified to standard layout without spacers

**Impact:** Content now full-width in left column

---

### 5. **Debug Overlay** (Lines 1050-1065)
**Removed:**
- Debug mode overlay showing:
  - Active tab
  - Side panel visibility
  - GPU info
  - Message count
  - Last pressed key

**Why:** Debug functionality not essential for MVP

**Impact:** Can add back if needed for debugging

---

### 6. **Command Palette Placeholder** (Lines 1067-1075)
**Removed:**
- Command palette overlay
- "Coming Soon" message

**Why:** Not implemented yet

**Impact:** None - was just a placeholder

---

### 7. **Launch Screen Overlay** (Lines 1077-1095)
**Removed:**
- Absolute positioned launch screen overlay
- Model info display
- GPU info display
- Recent sessions

**Why:** Simplified - launch screen is full-screen, not overlay

**Impact:** Launch screen now takes over entire UI

---

### 8. **Complex Provider Setup** (Lines 1100-1180)
**Removed:**
- Dynamic LocalProvider loading with try/catch
- No-op provider fallback
- Model size extraction from name
- Context config mapping from CLI config
- Model info construction with context profiles

**Why:** Simplified - providers should be initialized outside App

**Impact:** Need to pass initialized provider as prop

---

### 9. **Theme Loading from SettingsService** (Lines 1145-1155)
**Removed:**
- Initial theme loading from settings
- Built-in themes lookup
- Theme fallback logic

**Why:** UIProvider should handle theme initialization

**Impact:** Need to ensure UIProvider loads theme from settings

---

### 10. **Workspace Path** (Line 1158)
**Removed:**
- `workspacePath` variable
- Passing to ServiceProvider

**Why:** ServiceProvider should determine workspace path internally

**Impact:** None if ServiceProvider uses process.cwd()

---

## What Was Simplified

### 1. **Welcome Message Building**
**Old:**
```typescript
const buildWelcomeMessage = useCallback(() => {
  const modelName = currentModel || 'Unknown Model';
  const profile = profileManager.findProfile(modelName);
  const settings = SettingsService.getInstance().getSettings();
  const persistedHW = settings.hardware;
  const effectiveGPUInfo = gpuInfo || { /* fallback */ };
  const currentContextSize = contextState.usage.maxTokens;
  return createWelcomeMessage(modelName, currentContextSize, profile, effectiveGPUInfo);
}, [currentModel, gpuInfo, contextState.usage.maxTokens]);
```

**New:**
```typescript
const buildWelcomeMessage = useCallback(() => {
  if (uiState.sidePanelVisible) {
    return createWelcomeMessage(currentModel || 'No model selected');
  } else {
    return createCompactWelcomeMessage(currentModel || 'No model selected');
  }
}, [currentModel, uiState.sidePanelVisible]);
```

**Issue:** New version doesn't pass required parameters (currentContextSize, profile, gpuInfo)

---

### 2. **Context Menu**
**Old:** 600+ lines of menu logic with VRAM calculations, safety checks, model switching
**New:** 200+ lines with simplified logic, delegates VRAM to core

**Good:** Removed duplicate VRAM calculations
**Issue:** Still too much logic in UI layer - should be in separate component

---

### 3. **Mouse Handling**
**Old:** Complex hit testing with tab detection, spacer calculations
**New:** Simplified hit testing without spacers

**Good:** Cleaner code
**Issue:** May have lost some click targets

---

### 4. **Tab Rendering**
**Old:** `renderActiveTab()` function with switch statement, complex props
**New:** Inline switch in JSX with simplified props

**Good:** More React-idiomatic
**Issue:** Missing some props that components expect

---

## Type Errors to Fix

### Critical Errors (Must Fix)

1. **createWelcomeMessage signature** - Missing 3 required parameters
2. **SidePanel props** - Missing `visible`, `connection`, `model`, `gpu`
3. **ChatTab props** - Missing `height`
4. **GPUContext** - `gpuInfo` should be `info`
5. **ReviewContext** - No `state` property
6. **Config** - No `theme` or `defaultModel` properties
7. **ModelProvider** - Missing `provider` prop
8. **ServiceProvider** - Missing `provider` and `config` props
9. **ContextManagerProvider** - `id` should be `modelId` in modelInfo
10. **AllCallbacksBridge** - Missing `children` and `onOpenModelMenu` props

### Component Prop Errors (Must Fix)

11. **LaunchScreen** - Missing `theme` prop
12. **TabBar** - Wrong props interface
13. **Clock** - Wrong props interface
14. **SystemBar** - Wrong props interface
15. **ChatInputArea** - Wrong props interface
16. **All Tab components** - Wrong props interfaces

### Focus Manager Errors (Must Fix)

17. **setFocus()** - Invalid focus IDs: 'chat', 'input', 'side-panel'
18. **Mouse actions** - 'wheelUp' and 'wheelDown' not valid MouseAction types

### Hook Errors (Must Fix)

19. **useGlobalKeyboardShortcuts** - Invalid options

---

## What Needs to Be Done

### Phase 1: Fix Type Errors (CURRENT)

1. ✅ Read old App.tsx to understand correct interfaces
2. ✅ Read component files to understand prop requirements
3. ⏳ Fix all type errors in new App.tsx
4. ⏳ Ensure build passes

### Phase 2: Restore Missing Functionality

1. Ollama health check (move to service)
2. Hardware info persistence (move to GPUProvider)
3. Model loading tracking (if needed)
4. Debug overlay (if needed)

### Phase 3: Extract Context Menu

1. Create ContextMenu component
2. Move menu logic from App.tsx
3. Update App.tsx to use component

### Phase 4: Testing

1. Test `/model` command
2. Test `/test prompt` command
3. Test context menu
4. Test all tabs
5. Test side panel
6. Test keyboard shortcuts

---

## Architecture Goals

### What App.tsx SHOULD Do:
- Wire up context providers
- Handle layout and dimensions
- Route keyboard shortcuts
- Manage UI state (tabs, panels)
- Integrate components

### What App.tsx SHOULD NOT Do:
- Calculate context sizes (core does this)
- Manage VRAM (core does this)
- Build prompts (core does this)
- Persist settings (SettingsService does this)
- Health check services (ServiceProvider does this)
- Complex business logic (belongs in contexts/services)

---

## Next Steps

1. Fix all type errors in new App.tsx
2. Test build
3. Create comparison document
4. Update PROGRESS.md
5. Test functionality
6. Extract context menu (Phase 4)

---

**Status:** Type errors identified, ready to fix
**Blocker:** None
**Risk:** Medium - many type errors to fix
