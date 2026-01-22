# Window Container Component - Design

## Architecture Overview

### Current Architecture (Problem)
```
App.tsx
├── renderActiveTab()
│   ├── if (activeWindow === 'terminal') → Render Terminal (OVERLAY)
│   ├── if (activeWindow === 'editor') → Render Editor (OVERLAY)
│   └── switch (activeTab) → Render Tab Content
│       └── case 'chat' → ChatTab (with WindowSwitcher inside)
```

**Issues:**
- Terminal/Editor bypass normal rendering
- Special cases create z-index issues
- WindowSwitcher duplicated in ChatTab
- Inconsistent component hierarchy

### Proposed Architecture (Solution)
```
App.tsx
├── Row 1: Navbar (always visible)
├── Row 2: WindowContainer
│   ├── WindowIndicator (dots)
│   ├── Active Window Content:
│   │   ├── Chat Window (ChatTab)
│   │   ├── Terminal Window (Terminal)
│   │   └── Editor Window (EditorMockup)
├── Row 3: SystemBar
└── Row 4: ChatInputArea
```

**Benefits:**
- Single rendering path for all windows
- No overlays or z-index issues
- Consistent component hierarchy
- Reusable for right panel

## Component Design

### 1. WindowContainer Component

**Location**: `packages/cli/src/ui/components/layout/WindowContainer.tsx`

**Purpose**: Container that manages multiple windows and handles switching

**Props**:
```typescript
interface WindowContainerProps {
  // Container identification
  containerId: string;
  
  // Window configuration
  windows: WindowConfig[];
  
  // Dimensions
  height: number;
  width: number;
  
  // State
  activeWindowId: string;
  onWindowChange: (windowId: string) => void;
  
  // Display options
  showIndicator?: boolean;
  indicatorPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  
  // Input routing indicator
  linkedIndicator?: boolean; // If true, shows green border indicating input is linked here
  
  // Focus
  hasFocus: boolean;
  
  // Theme
  theme: Theme;
}

interface WindowConfig {
  id: string;
  label: string;
  icon?: string;
  component: React.ComponentType<WindowContentProps>;
  enabled?: boolean; // Can be disabled dynamically
}

interface WindowContentProps {
  height: number;
  width: number;
  hasFocus: boolean;
  theme: Theme;
}
```

**Rendering Logic**:
```typescript
export function WindowContainer(props: WindowContainerProps) {
  const { windows, activeWindowId, height, width, showIndicator, hasFocus, linkedIndicator, theme } = props;
  
  // Find active window
  const activeWindow = windows.find(w => w.id === activeWindowId);
  const ActiveComponent = activeWindow?.component;
  
  // Calculate content height (subtract indicator if shown)
  const indicatorHeight = showIndicator ? 1 : 0;
  const contentHeight = height - indicatorHeight;
  
  // Determine border color based on linked state and focus
  const borderColor = linkedIndicator 
    ? theme.border.linked // Green border when input is linked here
    : (hasFocus ? theme.border.active : theme.border.primary);
  
  return (
    <Box 
      flexDirection="column" 
      height={height} 
      width={width}
      borderStyle={theme.border.style}
      borderColor={borderColor}
    >
      {/* Window Indicator */}
      {showIndicator && (
        <WindowIndicator
          windows={windows}
          activeWindowId={activeWindowId}
          position={props.indicatorPosition || 'top-right'}
          theme={theme}
        />
      )}
      
      {/* Active Window Content */}
      <Box flexGrow={1} height={contentHeight} width={width}>
        {ActiveComponent && (
          <ActiveComponent
            height={contentHeight}
            width={width}
            hasFocus={hasFocus}
            theme={theme}
          />
        )}
      </Box>
    </Box>
  );
}
```

### 2. WindowIndicator Component

**Location**: `packages/cli/src/ui/components/layout/WindowIndicator.tsx`

**Purpose**: Visual indicator showing available windows and active window

**Props**:
```typescript
interface WindowIndicatorProps {
  windows: WindowConfig[];
  activeWindowId: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  theme: Theme;
}
```

**Rendering**:
```typescript
export function WindowIndicator(props: WindowIndicatorProps) {
  const { windows, activeWindowId, position, theme } = props;
  
  // Position mapping
  const justifyContent = position.includes('right') ? 'flex-end' : 'flex-start';
  
  return (
    <Box 
      width="100%" 
      height={1} 
      justifyContent={justifyContent}
      paddingX={1}
    >
      {windows.map((window, index) => {
        const isActive = window.id === activeWindowId;
        const dot = isActive ? '●' : '○';
        const color = isActive ? theme.text.accent : theme.text.secondary;
        
        return (
          <Text key={window.id} color={color}>
            {window.icon || dot} {window.label}
            {index < windows.length - 1 && ' | '}
          </Text>
        );
      })}
    </Box>
  );
}
```

### 3. Extended WindowContext

**Location**: `packages/cli/src/ui/contexts/WindowContext.tsx`

**Current State**:
```typescript
interface WindowState {
  activeWindow: 'chat' | 'terminal' | 'editor';
}
```

**Proposed State**:
```typescript
interface WindowState {
  // Global active window (for main container)
  activeWindow: 'chat' | 'terminal' | 'editor';
  
  // Container-specific state
  containers: Map<string, ContainerState>;
}

interface ContainerState {
  containerId: string;
  activeWindowId: string;
  windows: string[]; // Available window IDs
}
```

**New Methods**:
```typescript
interface WindowContextValue {
  // Existing
  activeWindow: 'chat' | 'terminal' | 'editor';
  switchWindow: () => void;
  
  // New - Container management
  registerContainer: (containerId: string, windows: string[], initialWindow: string) => void;
  unregisterContainer: (containerId: string) => void;
  getContainerState: (containerId: string) => ContainerState | undefined;
  switchContainerWindow: (containerId: string, direction: 'next' | 'prev') => void;
  setContainerWindow: (containerId: string, windowId: string) => void;
}
```

**Hook**:
```typescript
// Existing hook (backward compatible)
export function useWindow() {
  const context = useContext(WindowContext);
  return {
    activeWindow: context.activeWindow,
    switchWindow: context.switchWindow,
  };
}

// New hook for container-specific state
export function useWindowContainer(containerId: string) {
  const context = useContext(WindowContext);
  const containerState = context.getContainerState(containerId);
  
  return {
    activeWindowId: containerState?.activeWindowId || '',
    switchWindow: (direction: 'next' | 'prev') => {
      context.switchContainerWindow(containerId, direction);
    },
    setWindow: (windowId: string) => {
      context.setContainerWindow(containerId, windowId);
    },
  };
}
```

### 4. InputRoutingContext

**Location**: `packages/cli/src/ui/contexts/InputRoutingContext.tsx`

**Purpose**: Manages which window container receives user input

**State**:
```typescript
interface InputRoutingState {
  linkedContainer: 'main-window' | 'right-panel';
}
```

**Context Value**:
```typescript
interface InputRoutingContextValue {
  linkedContainer: 'main-window' | 'right-panel';
  setLinkedContainer: (container: 'main-window' | 'right-panel') => void;
  linkToMain: () => void;
  linkToRight: () => void;
  isMainLinked: boolean;
  isRightLinked: boolean;
}
```

**Implementation**:
```typescript
export function InputRoutingProvider({ children }: { children: React.ReactNode }) {
  const [linkedContainer, setLinkedContainer] = useState<'main-window' | 'right-panel'>('main-window');

  const linkToMain = useCallback(() => {
    setLinkedContainer('main-window');
  }, []);

  const linkToRight = useCallback(() => {
    setLinkedContainer('right-panel');
  }, []);

  const value: InputRoutingContextValue = {
    linkedContainer,
    setLinkedContainer,
    linkToMain,
    linkToRight,
    isMainLinked: linkedContainer === 'main-window',
    isRightLinked: linkedContainer === 'right-panel',
  };

  return (
    <InputRoutingContext.Provider value={value}>
      {children}
    </InputRoutingContext.Provider>
  );
}

export function useInputRouting() {
  const context = useContext(InputRoutingContext);
  if (!context) {
    throw new Error('useInputRouting must be used within InputRoutingProvider');
  }
  return context;
}
```

**Usage in WindowContainer**:
```typescript
export function WindowContainer(props: WindowContainerProps) {
  const { linkedIndicator } = props;
  const borderColor = linkedIndicator 
    ? theme.border.linked // Green border
    : (hasFocus ? theme.border.active : theme.border.primary);
  
  return (
    <Box 
      borderStyle={theme.border.style}
      borderColor={borderColor}
      ...
    >
      {/* Window content */}
    </Box>
  );
}
```

## Integration Plan

### Step 1: Create WindowIndicator Component

**File**: `packages/cli/src/ui/components/layout/WindowIndicator.tsx`

**Implementation**:
- Simple component that renders dots/labels
- No state management
- Pure presentation component

**Testing**:
- Renders correct number of indicators
- Highlights active window
- Positions correctly

### Step 2: Create WindowContainer Component

**File**: `packages/cli/src/ui/components/layout/WindowContainer.tsx`

**Implementation**:
- Accepts window configurations
- Renders active window only
- Includes WindowIndicator
- Handles height calculations

**Testing**:
- Renders active window correctly
- Switches windows when activeWindowId changes
- Respects height/width props
- Shows/hides indicator based on prop

### Step 3: Extend WindowContext

**File**: `packages/cli/src/ui/contexts/WindowContext.tsx`

**Changes**:
- Add container state management
- Add new methods for container operations
- Keep existing API for backward compatibility
- Add useWindowContainer hook

**Testing**:
- Multiple containers can coexist
- Each container maintains independent state
- Window switching works per container
- Existing useWindow hook still works

### Step 4: Create Window Content Wrappers

**Files**:
- `packages/cli/src/ui/components/windows/ChatWindow.tsx`
- `packages/cli/src/ui/components/windows/TerminalWindow.tsx`
- `packages/cli/src/ui/components/windows/EditorWindow.tsx`
- `packages/cli/src/ui/components/windows/ToolsWindow.tsx` (for right panel)
- `packages/cli/src/ui/components/windows/WorkspaceWindow.tsx` (for right panel)
- `packages/cli/src/ui/components/windows/RightTerminalWindow.tsx` (for right panel)
- `packages/cli/src/ui/components/windows/RightChatWindow.tsx` (for right panel)

**Purpose**: Wrap existing components to match WindowContentProps interface

**Example (ChatWindow)**:
```typescript
export function ChatWindow({ height, width, hasFocus, theme }: WindowContentProps) {
  return (
    <ChatTab
      height={height}
      showBorder={true}
      showWindowSwitcher={false} // Indicator replaces this
      columnWidth={width}
      metricsConfig={...}
      reasoningConfig={...}
    />
  );
}
```

**Example (RightChatWindow)**:
```typescript
export function RightChatWindow({ height, width, hasFocus, theme }: WindowContentProps) {
  // Independent chat instance for right panel
  return (
    <ChatTab
      height={height}
      showBorder={false} // Container provides border
      showWindowSwitcher={false}
      columnWidth={width}
      metricsConfig={...}
      reasoningConfig={...}
    />
  );
}
```

### Step 5: Create InputRoutingContext

**File**: `packages/cli/src/ui/contexts/InputRoutingContext.tsx`

**Implementation**:
- Create context with linkedContainer state
- Provide linkToMain and linkToRight methods
- Export useInputRouting hook

**Testing**:
- Context provides correct initial state
- Methods update state correctly
- Hook throws error outside provider

### Step 6: Update Theme System

**File**: `packages/cli/src/config/styles.ts`

**Changes**:
Add `linked` color to border theme:
```typescript
interface BorderTheme {
  style: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
  primary: string;
  secondary: string;
  active: string;
  linked: string; // NEW: Green border for linked input
}
```

**Update all themes**:
```typescript
export const defaultDarkTheme: Theme = {
  border: {
    style: 'round',
    primary: '#4a5568',
    secondary: '#2d3748',
    active: '#3b82f6',
    linked: '#10b981', // Green for linked indicator
  },
  // ... rest of theme
};
```

### Step 7: Update App.tsx

**Changes**:
1. Remove special cases in `renderActiveTab`
2. Replace ChatTab rendering with WindowContainer
3. Wire up window switching to WindowContext
4. Remove WindowSwitcher from ChatTab
5. Add InputRoutingProvider
6. Wire up input routing keyboard shortcuts
7. Pass linkedIndicator prop to WindowContainer

**Before**:
```typescript
const renderActiveTab = (height: number, width: number) => {
  if (activeWindow === 'terminal') {
    return <Terminal ... />;
  }
  if (activeWindow === 'editor') {
    return <EditorMockup ... />;
  }
  switch (uiState.activeTab) {
    case 'chat':
      return <ChatTab showWindowSwitcher={true} ... />;
    ...
  }
};
```

**After**:
```typescript
const renderActiveTab = (height: number, width: number) => {
  const { isMainLinked } = useInputRouting();
  
  switch (uiState.activeTab) {
    case 'chat':
      return (
        <WindowContainer
          containerId="main-window"
          windows={[
            { id: 'chat', label: 'Chat', component: ChatWindow },
            { id: 'terminal', label: 'Terminal', component: TerminalWindow },
            { id: 'editor', label: 'Editor', component: EditorWindow },
          ]}
          activeWindowId={activeWindow}
          onWindowChange={setActiveWindow}
          height={height}
          width={width}
          showIndicator={true}
          indicatorPosition="top-right"
          linkedIndicator={isMainLinked}
          hasFocus={focusManager.isFocused('chat-history')}
          theme={uiState.theme}
        />
      );
    case 'tools':
      return <ToolsTab ... />;
    ...
  }
};
```

**Add InputRoutingProvider to App component**:
```typescript
export function App({ config }: AppProps) {
  return (
    <ErrorBoundary>
      <UIProvider>
        <InputRoutingProvider>
          <WindowProvider>
            {/* ... rest of providers */}
          </WindowProvider>
        </InputRoutingProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
```

### Step 8: Update Window Switching Logic

**File**: `packages/cli/src/ui/App.tsx` (global keyboard handler)

**Changes**:
1. Update main window switching (Ctrl+Left/Right)
2. Add right panel window switching (Ctrl+Shift+Left/Right)
3. Add input routing shortcuts (Ctrl+Up/Down)

**Before**:
```typescript
if (isKey(input, key, activeKeybinds.layout.switchWindowLeft)) {
  switchWindow(); // Global function
}
```

**After**:
```typescript
const { linkToMain, linkToRight } = useInputRouting();

// Main window switching (Ctrl+Left/Right)
if (isKey(input, key, activeKeybinds.layout.switchWindowLeft)) {
  if (uiState.activeTab === 'chat') {
    const { switchWindow } = useWindowContainer('main-window');
    switchWindow('prev');
  }
}
else if (isKey(input, key, activeKeybinds.layout.switchWindowRight)) {
  if (uiState.activeTab === 'chat') {
    const { switchWindow } = useWindowContainer('main-window');
    switchWindow('next');
  }
}

// Right panel window switching (Ctrl+Shift+Left/Right)
else if (isKey(input, key, 'ctrl+shift+left')) {
  if (uiState.sidePanelVisible) {
    const { switchWindow } = useWindowContainer('right-panel');
    switchWindow('prev');
  }
}
else if (isKey(input, key, 'ctrl+shift+right')) {
  if (uiState.sidePanelVisible) {
    const { switchWindow } = useWindowContainer('right-panel');
    switchWindow('next');
  }
}

// Input routing (Ctrl+Up/Down)
else if (isKey(input, key, 'ctrl+up')) {
  linkToMain();
}
else if (isKey(input, key, 'ctrl+down')) {
  linkToRight();
}
```

### Step 9: Update SidePanel.tsx for Right Panel Windows

**File**: `packages/cli/src/ui/components/layout/SidePanel.tsx`

**Changes**:
Replace current side panel content with WindowContainer

**Before**:
```typescript
<Box flexDirection="column">
  <ToolsTab ... />
  <WorkspacePanel ... />
</Box>
```

**After**:
```typescript
const { isRightLinked } = useInputRouting();
const { activeWindowId } = useWindowContainer('right-panel');

<WindowContainer
  containerId="right-panel"
  windows={[
    { id: 'tools', label: 'Tools', component: ToolsWindow },
    { id: 'workspace', label: 'Workspace', component: WorkspaceWindow },
    { id: 'terminal', label: 'Terminal', component: RightTerminalWindow },
    { id: 'chat', label: 'Chat', component: RightChatWindow },
  ]}
  activeWindowId={activeWindowId}
  onWindowChange={(id) => {
    const { setWindow } = useWindowContainer('right-panel');
    setWindow(id);
  }}
  height={panelHeight}
  width={panelWidth}
  showIndicator={true}
  indicatorPosition="top-right"
  linkedIndicator={isRightLinked}
  hasFocus={focusManager.isFocused('context-panel')}
  theme={theme}
/>
```

## Data Flow

### Window Switching Flow
```
User presses Ctrl+Right
  ↓
App.tsx global handler catches key
  ↓
Checks if on chat tab (main window active)
  ↓
Calls WindowContext.switchContainerWindow('main-window', 'next')
  ↓
WindowContext updates container state
  ↓
WindowContainer re-renders with new activeWindowId
  ↓
New window content is displayed
  ↓
WindowIndicator updates to show new active window
```

### Focus Management Flow
```
User tabs to chat-history
  ↓
FocusContext updates activeId to 'chat-history'
  ↓
WindowContainer receives hasFocus={true}
  ↓
Active window component receives hasFocus={true}
  ↓
Window content updates border/styling
```

## Migration Strategy

### Phase 1: Parallel Implementation
- Create new components alongside existing code
- Don't modify App.tsx yet
- Test components in isolation

### Phase 2: Feature Flag
- Add feature flag: `USE_WINDOW_CONTAINER`
- If enabled, use WindowContainer
- If disabled, use old renderActiveTab logic
- Allows easy rollback

### Phase 3: Gradual Rollout
- Enable for chat tab only
- Test thoroughly
- Enable for all tabs
- Remove old code

### Phase 4: Cleanup
- Remove old renderActiveTab special cases
- Remove WindowSwitcher from ChatTab
- Remove feature flag
- Update documentation

## Testing Strategy

### Unit Tests
- WindowIndicator renders correctly
- WindowContainer switches windows
- WindowContext manages multiple containers
- Window wrappers pass props correctly

### Integration Tests
- Window switching works end-to-end
- Focus management works with WindowContainer
- Navigation (Tab, ESC) works correctly
- Keyboard shortcuts work

### Visual Tests
- Navbar always visible
- No z-index issues
- Indicator shows correct state
- Smooth transitions

### Regression Tests
- Existing functionality still works
- No breaking changes
- Performance is maintained

## Performance Considerations

### Optimization 1: Lazy Loading
Only render active window content:
```typescript
{ActiveComponent && (
  <ActiveComponent ... />
)}
```

### Optimization 2: Memoization
Memoize window configurations:
```typescript
const windows = useMemo(() => [
  { id: 'chat', label: 'Chat', component: ChatWindow },
  { id: 'terminal', label: 'Terminal', component: TerminalWindow },
  { id: 'editor', label: 'Editor', component: EditorWindow },
], []);
```

### Optimization 3: Prevent Re-renders
Use React.memo for window components:
```typescript
export const ChatWindow = React.memo(function ChatWindow(props) {
  // ...
});
```

## Right Panel Windows

### Architecture
The right panel (side panel) will also use WindowContainer to support multiple windows:
- **Tools Window**: Shows tools tab content
- **Workspace Window**: Shows workspace/file explorer
- **Terminal Window**: Independent terminal instance
- **Chat Window**: Independent chat instance

### Purpose
Allow users to have multiple views open simultaneously. For example:
- Main window: Editor
- Right panel: Terminal or Chat

This enables workflows like:
- Editing code while viewing terminal output
- Chatting with LLM while browsing files
- Running tools while editing

### Window Switching
- **Main Window**: Ctrl+Left/Right (existing)
- **Right Panel**: Ctrl+Shift+Left/Right (new)

### Implementation
```typescript
// In SidePanel.tsx
<WindowContainer
  containerId="right-panel"
  windows={[
    { id: 'tools', label: 'Tools', component: ToolsWindow },
    { id: 'workspace', label: 'Workspace', component: WorkspaceWindow },
    { id: 'terminal', label: 'Terminal', component: RightTerminalWindow },
    { id: 'chat', label: 'Chat', component: RightChatWindow },
  ]}
  activeWindowId={rightPanelWindow}
  onWindowChange={setRightPanelWindow}
  height={panelHeight}
  width={panelWidth}
  showIndicator={true}
  indicatorPosition="top-right"
  hasFocus={focusManager.isFocused('context-panel')}
  theme={theme}
/>
```

## Input Routing System

### Problem
With multiple chat/terminal windows (main + right panel), we need to control which window receives user input.

### Solution: Manual Input Linking
- **Ctrl+Up**: Link input to main window (left side)
- **Ctrl+Down**: Link input to right panel window (right side)
- **Visual Indicator**: Linked window has distinct border (e.g., green)
- **Default**: Input linked to main window

### Architecture

#### InputRoutingContext
```typescript
interface InputRoutingContextValue {
  linkedContainer: 'main-window' | 'right-panel';
  setLinkedContainer: (container: 'main-window' | 'right-panel') => void;
  linkToMain: () => void;
  linkToRight: () => void;
}
```

#### Visual Indicator
The linked window container will have a distinct border color:
```typescript
<WindowContainer
  containerId="main-window"
  linkedIndicator={linkedContainer === 'main-window'}
  ...
/>
```

#### Input Handling
ChatInputArea will send input to the linked container's active window:
```typescript
const handleSubmit = (input: string) => {
  if (linkedContainer === 'main-window') {
    // Send to main window's active chat/terminal
    sendToMainWindow(input);
  } else {
    // Send to right panel's active chat/terminal
    sendToRightPanel(input);
  }
};
```

### Keyboard Shortcuts
- **Ctrl+Up**: Link input to main window
- **Ctrl+Down**: Link input to right panel window
- **Visual feedback**: Border color changes immediately

### User Experience
1. User opens Editor in main window
2. User opens Terminal in right panel (Ctrl+Shift+Right)
3. User presses Ctrl+Down to link input to right panel
4. Right panel border turns green
5. User types commands → sent to right panel terminal
6. User presses Ctrl+Up to link back to main window
7. Main window border turns green

## Future Enhancements

### Enhancement 1: Window State Persistence
Save active window per container to settings:
```typescript
SettingsService.getInstance().setContainerWindow('main-window', 'terminal');
SettingsService.getInstance().setContainerWindow('right-panel', 'chat');
```

### Enhancement 2: Dynamic Window Registration
Allow plugins to register new windows:
```typescript
WindowRegistry.register('main-window', {
  id: 'debugger',
  label: 'Debugger',
  component: DebuggerWindow,
});
```

### Enhancement 3: Window-Specific Keybinds
Different keybinds per window:
```typescript
{
  id: 'terminal',
  label: 'Terminal',
  component: TerminalWindow,
  keybinds: {
    'ctrl+c': 'interrupt',
    'ctrl+d': 'exit',
  },
}
```

### Enhancement 4: Smart Input Routing
Automatically route input based on window type:
- If active window is terminal → route to that terminal
- If active window is chat → route to that chat
- Requires more complex logic, manual linking is simpler for MVP

## Success Criteria

✅ **Navbar Always Visible**
- Terminal doesn't cover navbar
- Editor doesn't cover navbar
- Chat doesn't cover navbar

✅ **Consistent Architecture**
- Single rendering path for all windows
- No special cases in renderActiveTab
- Reusable component

✅ **Working Window Switching**
- Ctrl+Left/Right works
- Visual indicator updates
- Focus management works

✅ **No Regressions**
- Navigation still works
- Focus management still works
- All existing features work

✅ **Maintainable Code**
- Clear component boundaries
- Well-documented API
- Easy to add new windows
