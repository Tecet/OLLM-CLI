# Hooks Panel UI - Design

**Feature:** Interactive UI for viewing and managing hooks  
**Status:** Design Review  
**Created:** 2026-01-17

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Navigate to Hooks Tab (Tab key)                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ HooksPanel Component (Two-Column Layout)                     │
│                                                              │
│ ┌──────────────┬─────────────────────────────────────────┐ │
│ │ Left (30%)   │ Right (70%)                             │ │
│ │              │                                         │ │
│ │ ← Exit       │ Hook Details:                           │ │
│ │              │ - Name (bold, yellow)                   │ │
│ │ 📝 File      │ - Version                               │ │
│ │  ● Hook 1    │ - Description                           │ │
│ │  ○ Hook 2    │ - Trigger: when.type + patterns         │ │
│ │              │ - Action: then.type + prompt/command    │ │
│ │ 💬 Prompt    │ - Source: builtin/user/workspace        │ │
│ │  ● Hook 3    │ - Status: ✓ Enabled / ✗ Disabled       │ │
│ │              │                                         │ │
│ │ 👤 User      │                                         │ │
│ │  ○ Hook 4    │                                         │ │
│ └──────────────┴─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Flow:**

```
Browse Mode (Tab cycling)
    ↓ Enter on Hooks tab
Active Mode (Hook list navigation)
    ↓ Esc/0
Browse Mode (Returns to nav-bar)
```

## Component Design

### 1. HooksPanel Component (Main Panel)

**File:** `packages/cli/src/ui/components/hooks/HooksPanel.tsx`

Main container implementing the two-column layout pattern from ToolsPanel.

```typescript
export interface HooksPanelProps {
  windowSize?: number; // Default: 15
}

export function HooksPanel({ windowSize = 15 }: HooksPanelProps) {
  const { state: uiState } = useUI();
  const { isFocused, exitToNavBar } = useFocusManager();
  const { hooks, categories, enabledHooks, toggleHook } = useHooks();

  const hasFocus = isFocused('hooks-panel');

  // Navigation state
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedHookIndex, setSelectedHookIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isOnExitItem, setIsOnExitItem] = useState(false);

  // Windowed rendering
  const totalItems = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.hooks.length + 1, 0) + 1;
  }, [categories]);

  const visibleItems = useMemo(() => {
    // Calculate visible window (Exit + categories + hooks)
    // Filter to scrollOffset...scrollOffset+windowSize
  }, [categories, scrollOffset, windowSize]);

  // Navigation handlers
  const handleNavigateUp = () => {
    if (isOnExitItem) return; // Already at top

    if (selectedHookIndex > 0) {
      setSelectedHookIndex(prev => prev - 1);
    } else if (selectedCategoryIndex > 0) {
      // Move to previous category's last hook
      const prevCategory = categories[selectedCategoryIndex - 1];
      setSelectedCategoryIndex(prev => prev - 1);
      setSelectedHookIndex(prevCategory.hooks.length - 1);
    } else {
      // Move to Exit item
      setIsOnExitItem(true);
      setScrollOffset(0);
    }
  };

  const handleNavigateDown = () => {
    if (isOnExitItem) {
      // Move from Exit to first hook
      setIsOnExitItem(false);
      setSelectedCategoryIndex(0);
      setSelectedHookIndex(0);
      return;
    }

    const currentCategory = categories[selectedCategoryIndex];
    if (selectedHookIndex < currentCategory.hooks.length - 1) {
      setSelectedHookIndex(prev => prev + 1);
    } else if (selectedCategoryIndex < categories.length - 1) {
      // Move to next category
      setSelectedCategoryIndex(prev => prev + 1);
      setSelectedHookIndex(0);
    }
  };

  const handleToggleCurrent = () => {
    if (isOnExitItem) {
      exitToNavBar();
      return;
    }

    const currentCategory = categories[selectedCategoryIndex];
    const currentHook = currentCategory.hooks[selectedHookIndex];
    if (currentHook) {
      toggleHook(currentHook.id);
    }
  };

  // Keyboard input
  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.upArrow) handleNavigateUp();
    else if (key.downArrow) handleNavigateDown();
    else if (key.leftArrow || key.rightArrow || key.return) handleToggleCurrent();
    else if (key.escape || input === '0') exitToNavBar();
    else if (input === 'a' || input === 'A') openAddDialog();
    else if (input === 'e' || input === 'E') openEditDialog();
    else if (input === 'd' || input === 'D') openDeleteDialog();
    else if (input === 't' || input === 'T') openTestDialog();
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box flexDirection="column" paddingX={1} flexShrink={0}>
        <Box justifyContent="space-between">
          <Text bold color={hasFocus ? 'yellow' : uiState.theme.text.primary}>
            Hooks Configuration
          </Text>
          <Text color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
            ↑↓:Nav Enter:Toggle A:Add E:Edit D:Del T:Test 0/Esc:Exit
          </Text>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden">
        {/* Left column: Hook list (30%) */}
        <Box
          flexDirection="column"
          width="30%"
          borderStyle="single"
          borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
        >
          {/* Scroll indicator at top */}
          {scrollOffset > 0 && (
            <>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>
                  ▲ Scroll up for more
                </Text>
              </Box>
              <Text> </Text>
            </>
          )}

          {/* Scrollable content */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            {/* Exit item */}
            <Box>
              <Text
                bold={isOnExitItem && hasFocus}
                color={isOnExitItem && hasFocus ? 'yellow' : uiState.theme.text.primary}
              >
                ← Exit
              </Text>
            </Box>
            <Text> </Text>
            <Text> </Text>

            {/* Render visible items (categories + hooks) */}
            {visibleItems.map((item) => {
              if (item.type === 'category') {
                return (
                  <Box key={`cat-${item.categoryIndex}`} marginTop={item.categoryIndex > 0 ? 1 : 0}>
                    <Text bold color={uiState.theme.text.primary}>
                      {getCategoryIcon(item.category)} {item.category.name}
                    </Text>
                  </Box>
                );
              } else {
                // Hook item
                const hook = item.hook;
                const isSelected = hasFocus &&
                  item.categoryIndex === selectedCategoryIndex &&
                  item.hookIndex === selectedHookIndex;
                const isEnabled = enabledHooks.has(hook.id);

                return (
                  <Box key={`hook-${hook.id}`} paddingLeft={2}>
                    <Box gap={1}>
                      <Text color={isEnabled ? 'green' : 'gray'}>
                        {isEnabled ? '●' : '○'}
                      </Text>
                      <Text
                        bold={isSelected}
                        color={isSelected ? 'yellow' : uiState.theme.text.primary}
                        dimColor={!isEnabled}
                      >
                        {hook.name}
                      </Text>
                    </Box>
                  </Box>
                );
              }
            })}
          </Box>

          {/* Scroll indicator at bottom */}
          {scrollOffset + windowSize < totalItems && (
            <>
              <Text> </Text>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>
                  ▼ Scroll down for more
                </Text>
              </Box>
            </>
          )}
        </Box>

        {/* Right column: Hook details (70%) */}
        <Box
          flexDirection="column"
          width="70%"
          borderStyle="single"
          borderColor={uiState.theme.border.primary}
          paddingX={2}
          paddingY={2}
        >
          {selectedHook ? (
            <>
              <Text bold color="yellow">{selectedHook.name}</Text>
              <Box marginTop={1}>
                <Text color={uiState.theme.text.secondary}>
                  Version: {selectedHook.version}
                </Text>
              </Box>
              <Box marginTop={2}>
                <Text color={uiState.theme.text.primary}>
                  {selectedHook.description}
                </Text>
              </Box>
              <Box marginTop={2}>
                <Text color={uiState.theme.text.secondary}>
                  Trigger: {selectedHook.when.type}
                  {selectedHook.when.patterns && ` (${selectedHook.when.patterns.join(', ')})`}
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text color={uiState.theme.text.secondary}>
                  Action: {selectedHook.then.type} - {selectedHook.then.prompt || selectedHook.then.command}
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text color={uiState.theme.text.secondary}>
                  Source: {selectedHook.source}
                </Text>
              </Box>
              <Box marginTop={2}>
                <Text color={selectedHook.enabled ? uiState.theme.status.success : uiState.theme.status.error}>
                  Status: {selectedHook.enabled ? '✓ Enabled' : '✗ Disabled'}
                </Text>
              </Box>
            </>
          ) : (
            <Text color={uiState.theme.text.secondary}>
              Select a hook to view details
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
```

**Category Icons:**

```typescript
const getCategoryIcon = (category: HookCategory): string => {
  const icons: Record<string, string> = {
    'File Events': '📝',
    'Prompt Events': '💬',
    'User Triggered': '👤',
  };
  return icons[category.name] || '📦';
};
```

### 6. Dialog Components

**File:** `packages/cli/src/ui/components/dialogs/HookDialogs.tsx`

#### AddHookDialog

```typescript
export const AddHookDialog: React.FC<{
  onSave: (hook: Omit<Hook, 'id'>) => Promise<void>;
  onCancel: () => void;
}> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState<HookFormData>({
    name: '',
    description: '',
    eventType: 'fileEdited',
    patterns: [],
    actionType: 'askAgent',
    promptOrCommand: ''
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleSave = async () => {
    const validationErrors = validateHookForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    await onSave(formDataToHook(formData));
    onCancel();
  };

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Text bold>Add New Hook</Text>
      <FormField label="Name" value={formData.name} onChange={/* ... */} error={errors.name} />
      <FormField label="Description" value={formData.description} onChange={/* ... */} />
      <SelectField label="Event Type" value={formData.eventType} options={eventTypeOptions} onChange={/* ... */} />
      {needsPatterns(formData.eventType) && (
        <FormField label="File Patterns" value={formData.patterns.join(', ')} onChange={/* ... */} />
      )}
      <SelectField label="Action Type" value={formData.actionType} options={actionTypeOptions} onChange={/* ... */} />
      <FormField label={formData.actionType === 'askAgent' ? 'Prompt' : 'Command'} value={formData.promptOrCommand} onChange={/* ... */} />
      <Box marginTop={1}>
        <Button label="Save" onPress={handleSave} />
        <Button label="Cancel" onPress={onCancel} />
      </Box>
    </Box>
  );
};
```

#### EditHookDialog

Similar to AddHookDialog but pre-populated with existing hook data.

#### DeleteConfirmationDialog

```typescript
export const DeleteConfirmationDialog: React.FC<{
  hook: Hook;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}> = ({ hook, onConfirm, onCancel }) => {
  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Text bold>Delete Hook?</Text>
      <Text>Are you sure you want to delete "{hook.name}"?</Text>
      <Text dimColor>This action cannot be undone.</Text>
      <Box marginTop={1}>
        <Button label="Delete" onPress={onConfirm} color="red" />
        <Button label="Cancel" onPress={onCancel} />
      </Box>
    </Box>
  );
};
```

#### TestHookDialog

```typescript
export const TestHookDialog: React.FC<{
  hook: Hook;
  onClose: () => void;
}> = ({ hook, onClose }) => {
  const [result, setResult] = useState<HookTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const runTest = async () => {
      setTesting(true);
      const testResult = await testHook(hook);
      setResult(testResult);
      setTesting(false);
    };
    runTest();
  }, [hook]);

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Text bold>Test Hook: {hook.name}</Text>
      {testing ? (
        <LoadingSpinner text="Testing hook..." />
      ) : result ? (
        <>
          <Text>Simulating: {hook.when.type} event</Text>
          {hook.when.patterns && <Text>Pattern: {hook.when.patterns.join(', ')}</Text>}
          <Text color={result.success ? 'green' : 'red'}>
            {result.success ? '✓' : '✗'} {result.message}
          </Text>
          {result.details && <Text dimColor>{result.details}</Text>}
        </>
      ) : null}
      <Box marginTop={1}>
        <Button label="Close" onPress={onClose} />
      </Box>
    </Box>
  );
};
```

### 7. Navigation Hook

**File:** `packages/cli/src/ui/hooks/useHookNavigation.ts`

Manages keyboard navigation and focus state.

```typescript
export function useHookNavigation() {
  const { categories } = useHooks();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const flattenedItems = useMemo(() => {
    const items: NavigationItem[] = [];
    categories.forEach((category) => {
      items.push({ type: 'category', id: category.name, category });
      if (expandedCategories.has(category.name)) {
        category.hooks.forEach((hook) => {
          items.push({ type: 'hook', id: hook.id, hook });
        });
      }
    });
    return items;
  }, [categories, expandedCategories]);

  const handleKeyPress = useCallback(
    (key: string) => {
      switch (key) {
        case 'up':
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'down':
          setFocusedIndex((prev) => Math.min(flattenedItems.length - 1, prev + 1));
          break;
        case 'return':
          const item = flattenedItems[focusedIndex];
          if (item.type === 'category') {
            toggleCategory(item.id);
          }
          break;
        case 'left':
        case 'right':
          const hookItem = flattenedItems[focusedIndex];
          if (hookItem.type === 'hook') {
            toggleHook(hookItem.id);
          }
          break;
      }
    },
    [focusedIndex, flattenedItems]
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  return {
    focusedIndex,
    expandedCategories,
    handleKeyPress,
    toggleCategory,
    getFocusedItem: () => flattenedItems[focusedIndex],
  };
}
```

## Data Flow

### Hook Loading Flow

```
App Startup
  ↓
HooksContext.init()
  ↓
HookRegistry.getAllHooks()
  ↓
Load from:
  - Built-in hooks (packages/core/src/hooks/builtin/)
  - User hooks (~/.ollm/hooks/)
  - Workspace hooks (.ollm/hooks/)
  ↓
SettingsService.getHookSettings()
  ↓
Load enabled state from ~/.ollm/settings.json
  ↓
Organize hooks by category
  ↓
Render HooksTab
```

### Toggle Hook Flow

```
User: Press Left/Right on hook
  ↓
HookItem.onToggle()
  ↓
HooksContext.toggleHook(hookId)
  ↓
Update enabledHooks Set
  ↓
SettingsService.setHookEnabled(hookId, enabled)
  ↓
Save to ~/.ollm/settings.json
  ↓
Re-render with new state
  ↓
Show system message: "Hook enabled/disabled"
```

### Add Hook Flow

```
User: Press 'A' key
  ↓
Show AddHookDialog
  ↓
User fills form
  ↓
User clicks Save
  ↓
Validate form data
  ↓
HooksContext.addHook(hookData)
  ↓
Generate unique hook ID
  ↓
HookFileService.saveHook(hook)
  ↓
Write to ~/.ollm/hooks/{hook-id}.json
  ↓
HookRegistry.register(hook)
  ↓
SettingsService.setHookEnabled(hookId, true)
  ↓
Refresh hooks list
  ↓
Close dialog
  ↓
Show system message: "Hook created"
```

### Edit Hook Flow

```
User: Press 'E' key on hook
  ↓
Check if hook is user-editable
  ↓
If built-in: Show error message
  ↓
If user hook: Show EditHookDialog
  ↓
Pre-populate form with current values
  ↓
User modifies fields
  ↓
User clicks Save
  ↓
Validate form data
  ↓
HooksContext.editHook(hookId, updates)
  ↓
HookFileService.updateHook(hookId, updates)
  ↓
Update hook file on disk
  ↓
HookRegistry.update(hook)
  ↓
Refresh hooks list
  ↓
Close dialog
  ↓
Show system message: "Hook updated"
```

### Delete Hook Flow

```
User: Press 'D' key on hook
  ↓
Check if hook is deletable
  ↓
If built-in: Show error message
  ↓
If user hook: Show DeleteConfirmationDialog
  ↓
User clicks Delete
  ↓
HooksContext.deleteHook(hookId)
  ↓
HookFileService.deleteHook(hookId)
  ↓
Remove hook file from disk
  ↓
HookRegistry.unregister(hookId)
  ↓
SettingsService.removeHookSetting(hookId)
  ↓
Refresh hooks list
  ↓
Close dialog
  ↓
Show system message: "Hook deleted"
```

### Test Hook Flow

```
User: Press 'T' key on hook
  ↓
Show TestHookDialog
  ↓
Simulate hook trigger event
  ↓
For fileEdited: Create mock file event
For promptSubmit: Create mock prompt event
For userTriggered: Trigger directly
  ↓
Execute hook action (dry-run mode)
  ↓
Capture result (success/failure)
  ↓
Display result in dialog
  ↓
User clicks Close
  ↓
Close dialog
```

## Service Layer

### HookFileService

**File:** `packages/cli/src/services/hookFileService.ts`

Handles hook file I/O operations.

```typescript
export class HookFileService {
  private userHooksDir: string;
  private workspaceHooksDir: string;

  constructor() {
    this.userHooksDir = path.join(os.homedir(), '.ollm', 'hooks');
    this.workspaceHooksDir = path.join(process.cwd(), '.ollm', 'hooks');
  }

  async loadUserHooks(): Promise<Hook[]> {
    const hooks: Hook[] = [];

    // Load from user directory
    if (fs.existsSync(this.userHooksDir)) {
      const files = fs.readdirSync(this.userHooksDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const hookPath = path.join(this.userHooksDir, file);
          const hook = await this.loadHookFile(hookPath);
          if (hook) hooks.push(hook);
        }
      }
    }

    // Load from workspace directory
    if (fs.existsSync(this.workspaceHooksDir)) {
      const files = fs.readdirSync(this.workspaceHooksDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const hookPath = path.join(this.workspaceHooksDir, file);
          const hook = await this.loadHookFile(hookPath);
          if (hook) hooks.push(hook);
        }
      }
    }

    return hooks;
  }

  private async loadHookFile(filePath: string): Promise<Hook | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const validation = this.validateHook(data);
      if (!validation.valid) {
        console.warn(`Invalid hook file ${filePath}:`, validation.errors);
        return null;
      }
      return {
        ...data,
        id: path.basename(filePath, '.json'),
        source: filePath.includes('.ollm/hooks') ? 'user' : 'builtin',
        enabled: true, // Will be overridden by settings
        trusted: false, // Will be set by HookRegistry
      };
    } catch (error) {
      console.error(`Failed to load hook file ${filePath}:`, error);
      return null;
    }
  }

  async saveHook(hook: Hook): Promise<void> {
    const fileName = `${hook.id}.json`;
    const filePath = path.join(this.userHooksDir, fileName);

    // Ensure directory exists
    if (!fs.existsSync(this.userHooksDir)) {
      fs.mkdirSync(this.userHooksDir, { recursive: true });
    }

    const hookData = {
      name: hook.name,
      version: hook.version,
      description: hook.description,
      when: hook.when,
      then: hook.then,
    };

    fs.writeFileSync(filePath, JSON.stringify(hookData, null, 2), 'utf-8');
  }

  async updateHook(hookId: string, updates: Partial<Hook>): Promise<void> {
    const fileName = `${hookId}.json`;
    const filePath = path.join(this.userHooksDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Hook file not found: ${hookId}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    const updated = {
      ...data,
      ...updates,
      // Don't allow changing id, source, enabled, trusted via file
      id: undefined,
      source: undefined,
      enabled: undefined,
      trusted: undefined,
    };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  async deleteHook(hookId: string): Promise<void> {
    const fileName = `${hookId}.json`;
    const filePath = path.join(this.userHooksDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Hook file not found: ${hookId}`);
    }

    fs.unlinkSync(filePath);
  }

  validateHook(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name) errors.push('Missing required field: name');
    if (!data.version) errors.push('Missing required field: version');
    if (!data.when?.type) errors.push('Missing required field: when.type');
    if (!data.then?.type) errors.push('Missing required field: then.type');

    const validEventTypes = [
      'fileEdited',
      'fileCreated',
      'fileDeleted',
      'userTriggered',
      'promptSubmit',
      'agentStop',
    ];
    if (data.when?.type && !validEventTypes.includes(data.when.type)) {
      errors.push(`Invalid event type: ${data.when.type}`);
    }

    const validActionTypes = ['askAgent', 'runCommand'];
    if (data.then?.type && !validActionTypes.includes(data.then.type)) {
      errors.push(`Invalid action type: ${data.then.type}`);
    }

    if (data.then?.type === 'askAgent' && !data.then.prompt) {
      errors.push('askAgent action requires prompt field');
    }

    if (data.then?.type === 'runCommand' && !data.then.command) {
      errors.push('runCommand action requires command field');
    }

    const fileEventTypes = ['fileEdited', 'fileCreated', 'fileDeleted'];
    if (fileEventTypes.includes(data.when?.type) && !data.when.patterns?.length) {
      errors.push('File event types require patterns field');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

## Integration Points

### 1. HookRegistry Integration

**File:** `packages/core/src/hooks/hookRegistry.ts`

Add methods for UI integration:

```typescript
export class HookRegistry {
  // Existing methods...

  getHooksByCategory(): Map<HookEventType, Hook[]> {
    const categories = new Map<HookEventType, Hook[]>();

    for (const hook of this.hooks.values()) {
      const eventType = hook.when.type;
      if (!categories.has(eventType)) {
        categories.set(eventType, []);
      }
      categories.get(eventType)!.push(hook);
    }

    return categories;
  }

  getUserHooks(): Hook[] {
    return Array.from(this.hooks.values()).filter((h) => h.source === 'user');
  }

  getBuiltinHooks(): Hook[] {
    return Array.from(this.hooks.values()).filter((h) => h.source === 'builtin');
  }

  isEditable(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    return hook?.source === 'user';
  }

  isDeletable(hookId: string): boolean {
    return this.isEditable(hookId);
  }
}
```

### 2. SettingsService Integration

**File:** `packages/cli/src/config/settingsService.ts`

Add hook-specific methods:

```typescript
export class SettingsService {
  // Existing methods...

  getHookSettings(): { enabled: Record<string, boolean> } {
    return this.settings.hooks || { enabled: {} };
  }

  setHookEnabled(hookId: string, enabled: boolean): void {
    if (!this.settings.hooks) {
      this.settings.hooks = { enabled: {} };
    }
    this.settings.hooks.enabled[hookId] = enabled;
    this.saveSettings();
  }

  removeHookSetting(hookId: string): void {
    if (this.settings.hooks?.enabled) {
      delete this.settings.hooks.enabled[hookId];
      this.saveSettings();
    }
  }

  private saveSettings(): void {
    const settingsPath = path.join(os.homedir(), '.ollm', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
  }
}
```

### 3. TabBar Integration

**File:** `packages/cli/src/ui/components/layout/TabBar.tsx`

Add Hooks tab to navigation:

```typescript
const tabs = [
  { id: 'chat', label: 'Chat', component: ChatTab },
  { id: 'tools', label: 'Tools', component: ToolsTab },
  { id: 'hooks', label: 'Hooks', component: HooksTab }, // NEW
  { id: 'settings', label: 'Settings', component: SettingsTab },
];
```

## Error Handling

### Corrupted Hook Files

```typescript
// In HookFileService.loadHookFile()
try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const validation = this.validateHook(data);
  if (!validation.valid) {
    console.warn(`Invalid hook file ${filePath}:`, validation.errors);
    // Show in UI as warning, don't crash
    return null;
  }
  return data;
} catch (error) {
  console.error(`Failed to load hook file ${filePath}:`, error);
  // Continue loading other hooks
  return null;
}
```

### File Write Errors

```typescript
// In HooksContext.addHook()
try {
  await hookFileService.saveHook(hook);
  await refreshHooks();
  showSystemMessage('Hook created successfully');
} catch (error) {
  showErrorMessage(`Failed to create hook: ${error.message}`);
  // Don't add to registry if file write failed
}
```

### Settings Persistence Errors

```typescript
// In HooksContext.toggleHook()
try {
  settingsService.setHookEnabled(hookId, !enabled);
  setEnabledHooks((prev) => {
    const next = new Set(prev);
    if (enabled) next.delete(hookId);
    else next.add(hookId);
    return next;
  });
} catch (error) {
  showErrorMessage(`Failed to save settings: ${error.message}`);
  // Revert UI state
}
```

### Hook Test Errors

```typescript
// In TestHookDialog
try {
  const result = await testHook(hook);
  setResult(result);
} catch (error) {
  setResult({
    success: false,
    message: 'Test failed',
    details: error.message,
  });
}
```

## Performance Optimizations

### Windowed Rendering

For large hook lists (> 20 hooks), use windowed rendering:

```typescript
// In HooksTab
const visibleHooks = useMemo(() => {
  const start = Math.max(0, focusedIndex - 10);
  const end = Math.min(flattenedItems.length, focusedIndex + 10);
  return flattenedItems.slice(start, end);
}, [flattenedItems, focusedIndex]);
```

### Debounced File Operations

```typescript
// In HooksContext
const debouncedSave = useMemo(
  () =>
    debounce((hook: Hook) => {
      hookFileService.saveHook(hook);
    }, 500),
  []
);
```

### Memoized Category Computation

```typescript
// In HooksContext
const categories = useMemo(() => {
  const categoryMap = new Map<string, HookCategory>();

  // Group by event type
  const fileEvents: Hook[] = [];
  const promptEvents: Hook[] = [];
  const userTriggered: Hook[] = [];

  for (const hook of hooks) {
    switch (hook.when.type) {
      case 'fileEdited':
      case 'fileCreated':
      case 'fileDeleted':
        fileEvents.push(hook);
        break;
      case 'promptSubmit':
      case 'agentStop':
        promptEvents.push(hook);
        break;
      case 'userTriggered':
        userTriggered.push(hook);
        break;
    }
  }

  return [
    {
      name: 'File Events',
      eventTypes: ['fileEdited', 'fileCreated', 'fileDeleted'],
      hooks: fileEvents,
      expanded: true,
    },
    {
      name: 'Prompt Events',
      eventTypes: ['promptSubmit', 'agentStop'],
      hooks: promptEvents,
      expanded: true,
    },
    { name: 'User Triggered', eventTypes: ['userTriggered'], hooks: userTriggered, expanded: true },
  ];
}, [hooks]);
```

## Testing Strategy

### Unit Tests

**File:** `packages/cli/src/ui/components/tabs/__tests__/HooksTab.test.tsx`

```typescript
describe('HooksTab', () => {
  it('should render hook categories', () => {
    const { getByText } = render(<HooksTab />);
    expect(getByText('File Events')).toBeDefined();
    expect(getByText('Prompt Events')).toBeDefined();
    expect(getByText('User Triggered')).toBeDefined();
  });

  it('should toggle hook enabled state', async () => {
    const { getByText } = render(<HooksTab />);
    const hook = getByText('lint-on-save');

    // Simulate left/right arrow key
    fireEvent.keyPress(hook, { key: 'right' });

    await waitFor(() => {
      expect(settingsService.setHookEnabled).toHaveBeenCalledWith('lint-on-save', true);
    });
  });

  it('should open add hook dialog', () => {
    const { getByText } = render(<HooksTab />);

    fireEvent.keyPress(document, { key: 'a' });

    expect(getByText('Add New Hook')).toBeDefined();
  });

  it('should validate hook form', async () => {
    const { getByText, getByLabelText } = render(<AddHookDialog />);

    // Leave name empty
    fireEvent.change(getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(getByText('Save'));

    await waitFor(() => {
      expect(getByText('Name is required')).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
describe('Hooks Panel Integration', () => {
  it('should create and enable new hook', async () => {
    const { getByText, getByLabelText } = render(<App />);

    // Navigate to Hooks tab
    fireEvent.keyPress(document, { key: 'tab' });
    fireEvent.keyPress(document, { key: 'tab' });

    // Open add dialog
    fireEvent.keyPress(document, { key: 'a' });

    // Fill form
    fireEvent.change(getByLabelText('Name'), { target: { value: 'test-hook' } });
    fireEvent.change(getByLabelText('Event Type'), { target: { value: 'fileEdited' } });
    fireEvent.change(getByLabelText('File Patterns'), { target: { value: '*.ts' } });
    fireEvent.change(getByLabelText('Action Type'), { target: { value: 'askAgent' } });
    fireEvent.change(getByLabelText('Prompt'), { target: { value: 'Test prompt' } });

    // Save
    fireEvent.click(getByText('Save'));

    // Verify hook appears in list
    await waitFor(() => {
      expect(getByText('test-hook')).toBeDefined();
      expect(getByText('[●] Enabled')).toBeDefined();
    });

    // Verify file was created
    const hookPath = path.join(os.homedir(), '.ollm', 'hooks', 'test-hook.json');
    expect(fs.existsSync(hookPath)).toBe(true);
  });
});
```

### Property-Based Tests

**Validates: Requirements 2.1, 2.2, 2.3**

```typescript
// Property: Toggle operations are idempotent
fc.property(
  fc.record({
    hookId: fc.string(),
    initialState: fc.boolean(),
  }),
  async ({ hookId, initialState }) => {
    // Setup
    settingsService.setHookEnabled(hookId, initialState);

    // Act: Toggle twice
    await toggleHook(hookId);
    await toggleHook(hookId);

    // Assert: Back to initial state
    const finalState = settingsService.getHookSettings().enabled[hookId];
    expect(finalState).toBe(initialState);
  }
);
```

**Validates: Requirements 3.3, 3.4**

```typescript
// Property: Valid hooks always save successfully
fc.property(
  fc.record({
    name: fc.string({ minLength: 1 }),
    eventType: fc.constantFrom('fileEdited', 'promptSubmit', 'userTriggered'),
    actionType: fc.constantFrom('askAgent', 'runCommand'),
    prompt: fc.string({ minLength: 1 }),
  }),
  async (hookData) => {
    // Act
    const hook = createHookFromFormData(hookData);
    await hookFileService.saveHook(hook);

    // Assert: File exists and is valid
    const hookPath = path.join(os.homedir(), '.ollm', 'hooks', `${hook.id}.json`);
    expect(fs.existsSync(hookPath)).toBe(true);

    const loaded = await hookFileService.loadHookFile(hookPath);
    expect(loaded).toBeDefined();
    expect(loaded.name).toBe(hookData.name);
  }
);
```

## Security Considerations

### Built-in Hook Protection

```typescript
// In HooksContext.editHook()
if (hook.source === 'builtin') {
  throw new Error('Cannot edit built-in hooks');
}

// In HooksContext.deleteHook()
if (hook.source === 'builtin') {
  throw new Error('Cannot delete built-in hooks');
}
```

### Hook Validation

```typescript
// Prevent code injection in hook commands
const validateCommand = (command: string): boolean => {
  // Disallow dangerous patterns
  const dangerous = [';', '&&', '||', '|', '>', '<', '`', '$'];
  return !dangerous.some((char) => command.includes(char));
};
```

### File Path Validation

```typescript
// Prevent directory traversal
const validateHookId = (hookId: string): boolean => {
  return !hookId.includes('..') && !hookId.includes('/') && !hookId.includes('\\');
};
```

## Migration Plan

1. **Phase 1:** Create HooksContext and HookFileService
2. **Phase 2:** Implement HooksTab and basic rendering
3. **Phase 3:** Add keyboard navigation
4. **Phase 4:** Implement toggle functionality
5. **Phase 5:** Add dialog components (Add/Edit/Delete/Test)
6. **Phase 6:** Integrate with TabBar
7. **Phase 7:** Add tests and polish

## Rollback Plan

If issues arise:

1. Remove Hooks tab from TabBar
2. Users can still manage hooks via JSON files
3. Hook system continues to work (stage-05)
4. Fix issues and re-enable in next release

## Open Design Questions

1. Should we show hook execution history? (Adds complexity, useful for debugging)
2. Should we support hook templates? (Pre-built hooks for common use cases)
3. Should we allow inline editing? (vs dialog-based, more complex)
4. Should we show hook conflicts? (Multiple hooks on same event)
5. Should we support hook search/filtering? (Useful with many hooks)

## References

- Requirements: `.kiro/specs/stage-08c-hooks-panel-ui/requirements.md`
- Design Plan: `.dev/docs/Ui/hooks-panel-interactive-plan.md`
- Hook System: `docs/MCP/hooks/`
- Stage-05: `.kiro/specs/stage-05-hooks-extensions-mcp/`
- Tools Panel: `.kiro/specs/stage-08b-tool-support-detection/`
