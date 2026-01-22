# UI Component Hierarchy

**Last Updated**: January 22, 2026  
**Version**: 1.0.0

## Overview

This document describes the complete UI component hierarchy for the OLLM CLI application. It serves as a reference for understanding how components are organized, their relationships, and their responsibilities.

## Component Architecture

The UI follows a hierarchical structure with three main levels:

```
Level 1: Application Shell
├── Level 2: Tab Content
│   └── Level 3: Modals/Dialogs
└── Supporting Components
```

---

## Level 1: Application Shell

The top-level components that form the main application structure.

### App.tsx

**Purpose**: Main application container  
**Location**: `packages/cli/src/ui/App.tsx`  
**Responsibilities**:
- Renders the complete application layout
- Manages window container (Chat, Terminal, Editor)
- Handles top-level keyboard shortcuts
- Coordinates focus management

**Children**:
- HeaderBar
- TabBar
- WindowContainer (Chat/Terminal/Editor)
- SidePanel
- StatusBar
- DialogManager

### HeaderBar

**Purpose**: Top application bar  
**Location**: `packages/cli/src/ui/components/layout/HeaderBar.tsx`  
**Responsibilities**:
- Displays application title
- Shows current mode
- Displays clock

### TabBar

**Purpose**: Navigation tabs  
**Location**: `packages/cli/src/ui/components/layout/TabBar.tsx`  
**Responsibilities**:
- Displays available tabs
- Highlights active tab
- Handles tab switching

**Available Tabs**:
- Chat
- Tools
- Hooks
- Files
- Search
- Docs
- GitHub
- MCP
- Settings

### StatusBar

**Purpose**: Bottom status bar  
**Location**: `packages/cli/src/ui/components/layout/StatusBar.tsx`  
**Responsibilities**:
- Shows connection status
- Displays Git status
- Shows GPU information
- Displays context usage

### SidePanel

**Purpose**: Right side panel  
**Location**: `packages/cli/src/ui/components/layout/SidePanel.tsx`  
**Responsibilities**:
- Displays context information
- Shows focused files
- Displays keybinds
- Manages sub-window switching

---

## Level 2: Tab Content

Tab components that render when their tab is active.

### ChatTab

**Purpose**: Main chat interface  
**Location**: `packages/cli/src/ui/components/tabs/ChatTab.tsx`  
**Complexity**: High  
**Key Features**:
- Message history display
- Streaming message rendering
- Tool call visualization
- Scroll management

**Child Components**:
- ChatHistory
- Message
- ToolCall
- StreamingIndicator
- ReasoningBox

### ToolsTab

**Purpose**: Tools configuration  
**Location**: `packages/cli/src/ui/components/tabs/ToolsTab.tsx`  
**Complexity**: Low  
**Key Features**:
- Tool list display
- Tool enable/disable
- Tool categories

**Child Components**:
- ToolsPanel
- CategorySection
- ToolItem

### HooksTab

**Purpose**: Hooks management  
**Location**: `packages/cli/src/ui/components/tabs/HooksTab.tsx`  
**Complexity**: Very High  
**Key Features**:
- Hook list display
- Hook details view
- Hook creation/editing
- Hook testing
- Two-column layout

**Child Components**:
- HookCategory
- HookItem
- AddHookDialog
- EditHookDialog
- TestHookDialog
- DeleteConfirmationDialog

### FilesTab

**Purpose**: File explorer  
**Location**: `packages/cli/src/ui/components/tabs/FilesTab.tsx`  
**Complexity**: Medium  
**Key Features**:
- File tree navigation
- File operations
- File search
- Syntax viewer

**Child Components**:
- FileExplorerComponent
- FileTreeView
- FileSearchDialog
- SyntaxViewer
- QuickActionsMenu

### MCPTab

**Purpose**: MCP server management  
**Location**: `packages/cli/src/ui/components/tabs/MCPTab.tsx`  
**Complexity**: Very High  
**Key Features**:
- Server list display
- Server details view
- Marketplace integration
- Server configuration
- Health monitoring
- Two-column layout

**Child Components**:
- InstalledServersSection
- ServerItem
- ServerDetails
- MarketplacePreview
- ServerConfigDialog
- HealthMonitorDialog
- ServerToolsViewer
- ServerLogsViewer

### SettingsTab

**Purpose**: Application settings  
**Location**: `packages/cli/src/ui/components/tabs/SettingsTab.tsx`  
**Complexity**: Low  
**Key Features**:
- Model selection
- Provider configuration
- Theme selection
- Session information

**Child Components**:
- SettingsPanel
- ModelPicker
- ProviderSelector
- ThemePicker
- SessionInfo

### SearchTab

**Purpose**: Semantic search (placeholder)  
**Location**: `packages/cli/src/ui/components/tabs/SearchTab.tsx`  
**Complexity**: Medium  
**Key Features**:
- Search input
- Results display
- Two-column layout

### DocsTab

**Purpose**: Documentation viewer  
**Location**: `packages/cli/src/ui/components/tabs/DocsTab.tsx`  
**Complexity**: Low  
**Key Features**:
- Documentation navigation
- Document viewer

**Child Components**:
- DocsPanel
- DocNav
- DocViewer

### GitHubTab

**Purpose**: GitHub integration  
**Location**: `packages/cli/src/ui/components/tabs/GitHubTab.tsx`  
**Complexity**: Low  
**Key Features**:
- Feature sections
- Planned features list

**Child Components**:
- FeatureSection
- PlannedFeaturesList

---

## Level 3: Modals/Dialogs

Dialog components that overlay the main content.

### Base Components

#### Dialog

**Purpose**: Base dialog component  
**Location**: `packages/cli/src/ui/components/dialogs/Dialog.tsx`  
**Responsibilities**:
- Provides consistent dialog styling
- Handles ESC key for closing
- Theme-aware rendering

#### DialogManager

**Purpose**: Centralized dialog rendering  
**Location**: `packages/cli/src/ui/components/dialogs/DialogManager.tsx`  
**Responsibilities**:
- Renders all active dialogs
- Manages dialog priority
- Routes keyboard input to active dialog

### Confirmation Dialogs

#### ConfirmationDialog

**Purpose**: Generic confirmation dialog  
**Location**: `packages/cli/src/ui/components/dialogs/ConfirmationDialog.tsx`  
**Features**:
- Yes/No selection
- Level system (info/warning/danger)
- Affected items display
- Loading states
- Error handling

#### DeleteConfirmationDialog

**Purpose**: Specialized delete confirmation  
**Location**: `packages/cli/src/ui/components/dialogs/DeleteConfirmationDialog.tsx`  
**Features**:
- Delete-specific messaging
- Danger level styling

#### UninstallConfirmDialog

**Purpose**: Specialized uninstall confirmation  
**Location**: `packages/cli/src/ui/components/dialogs/UninstallConfirmDialog.tsx`  
**Features**:
- Uninstall-specific messaging
- Warning level styling

### Hook Dialogs

#### AddHookDialog

**Purpose**: Create new hook  
**Location**: `packages/cli/src/ui/components/dialogs/AddHookDialog.tsx`  
**Features**:
- Hook name input
- Event type selection
- Action configuration

#### EditHookDialog

**Purpose**: Edit existing hook  
**Location**: `packages/cli/src/ui/components/dialogs/EditHookDialog.tsx`  
**Features**:
- Pre-filled form
- Hook configuration editing

#### TestHookDialog

**Purpose**: Test hook execution  
**Location**: `packages/cli/src/ui/components/dialogs/TestHookDialog.tsx`  
**Features**:
- Test execution
- Result display

#### HookApprovalDialog

**Purpose**: Approve hook execution  
**Location**: `packages/cli/src/ui/components/dialogs/HookApprovalDialog.tsx`  
**Features**:
- Hook details display
- Approve/Reject options

### MCP Dialogs

#### ServerConfigDialog

**Purpose**: Configure MCP server  
**Location**: `packages/cli/src/ui/components/dialogs/ServerConfigDialog.tsx`  
**Features**:
- Server configuration form
- Environment variables
- Arguments configuration

#### OAuthConfigDialog

**Purpose**: Configure OAuth for MCP server  
**Location**: `packages/cli/src/ui/components/dialogs/OAuthConfigDialog.tsx`  
**Features**:
- OAuth flow initiation
- Token management

#### ServerToolsViewer

**Purpose**: View server tools  
**Location**: `packages/cli/src/ui/components/dialogs/ServerToolsViewer.tsx`  
**Features**:
- Tool list display
- Tool details

#### HealthMonitorDialog

**Purpose**: Monitor server health  
**Location**: `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`  
**Features**:
- Health status display
- Metrics visualization

#### ServerLogsViewer

**Purpose**: View server logs  
**Location**: `packages/cli/src/ui/components/dialogs/ServerLogsViewer.tsx`  
**Features**:
- Log streaming
- Log filtering

#### MarketplaceDialog

**Purpose**: Browse MCP marketplace  
**Location**: `packages/cli/src/ui/components/dialogs/MarketplaceDialog.tsx`  
**Features**:
- Server browsing
- Server installation

#### InstallServerDialog

**Purpose**: Install MCP server  
**Location**: `packages/cli/src/ui/components/dialogs/InstallServerDialog.tsx`  
**Features**:
- Installation progress
- Configuration options

### Other Dialogs

#### HelpOverlay

**Purpose**: Context-sensitive help  
**Location**: `packages/cli/src/ui/components/dialogs/HelpOverlay.tsx`  
**Features**:
- Context-aware help content
- Keyboard shortcuts reference

#### APIKeyInputDialog

**Purpose**: Input API key  
**Location**: `packages/cli/src/ui/components/dialogs/APIKeyInputDialog.tsx`  
**Features**:
- Secure input
- Validation

#### UserPromptDialog

**Purpose**: Prompt user for input  
**Location**: `packages/cli/src/ui/components/dialogs/UserPromptDialog.tsx`  
**Features**:
- Text input
- Validation

#### ModeSuggestionDialog

**Purpose**: Suggest mode change  
**Location**: `packages/cli/src/ui/components/dialogs/ModeSuggestionDialog.tsx`  
**Features**:
- Mode recommendation
- Accept/Reject options

---

## Supporting Components

Components used across multiple parts of the application.

### Layout Components

#### TwoColumnLayout

**Purpose**: Reusable two-column layout  
**Location**: `packages/cli/src/ui/components/layout/TwoColumnLayout.tsx`  
**Features**:
- Configurable column widths
- Focus-aware borders
- Theme integration

**Used By**: HooksTab, MCPTab, SearchTab, SettingsTab

#### TabContainer

**Purpose**: Standard tab wrapper  
**Location**: `packages/cli/src/ui/components/layout/TabContainer.tsx`  
**Features**:
- Focus-aware borders
- Optional title and help text
- Consistent padding

**Used By**: All tab components

#### WorkspacePanel

**Purpose**: Three-panel workspace view  
**Location**: `packages/cli/src/ui/components/layout/WorkspacePanel.tsx`  
**Features**:
- Focused files panel
- File tree panel
- Keybinds panel
- Panel switching

### Form Components

#### Button

**Purpose**: Reusable button  
**Location**: `packages/cli/src/ui/components/forms/Button.tsx`  
**Features**:
- Theme-aware styling
- Focus states
- Disabled states

#### TextInput

**Purpose**: Text input field  
**Location**: `packages/cli/src/ui/components/forms/TextInput.tsx`  
**Features**:
- Validation
- Placeholder text
- Error states

#### Checkbox

**Purpose**: Checkbox input  
**Location**: `packages/cli/src/ui/components/forms/Checkbox.tsx`  
**Features**:
- Checked/unchecked states
- Label support

#### FormField

**Purpose**: Form field wrapper  
**Location**: `packages/cli/src/ui/components/forms/FormField.tsx`  
**Features**:
- Label display
- Error message display
- Help text display

### Chat Components

#### ChatHistory

**Purpose**: Message history display  
**Location**: `packages/cli/src/ui/components/chat/ChatHistory.tsx`  
**Features**:
- Message rendering
- Scroll management
- Streaming support

#### Message

**Purpose**: Single message display  
**Location**: `packages/cli/src/ui/components/chat/Message.tsx`  
**Features**:
- User/Assistant styling
- Markdown rendering
- Code highlighting

#### ToolCall

**Purpose**: Tool call visualization  
**Location**: `packages/cli/src/ui/components/chat/ToolCall.tsx`  
**Features**:
- Tool name display
- Arguments display
- Result display

#### StreamingIndicator

**Purpose**: Streaming status indicator  
**Location**: `packages/cli/src/ui/components/chat/StreamingIndicator.tsx`  
**Features**:
- Animated indicator
- Status text

#### ReasoningBox

**Purpose**: Reasoning display  
**Location**: `packages/cli/src/ui/components/chat/ReasoningBox.tsx`  
**Features**:
- Reasoning text display
- Collapsible view

### MCP Components

#### ServerItem

**Purpose**: MCP server list item  
**Location**: `packages/cli/src/ui/components/mcp/ServerItem.tsx`  
**Features**:
- Server name display
- Status indicator
- Selection highlighting

#### HealthIndicator

**Purpose**: Server health indicator  
**Location**: `packages/cli/src/ui/components/mcp/HealthIndicator.tsx`  
**Features**:
- Color-coded status
- Status text

#### LoadingSpinner

**Purpose**: Loading indicator  
**Location**: `packages/cli/src/ui/components/mcp/LoadingSpinner.tsx`  
**Features**:
- Animated spinner
- Optional text

### File Explorer Components

#### FileTreeView

**Purpose**: File tree display  
**Location**: `packages/cli/src/ui/components/file-explorer/FileTreeView.tsx`  
**Features**:
- Tree rendering
- Expand/collapse
- Selection highlighting

#### FileSearchDialog

**Purpose**: File search  
**Location**: `packages/cli/src/ui/components/file-explorer/FileSearchDialog.tsx`  
**Features**:
- Search input
- Results display
- Quick navigation

#### SyntaxViewer

**Purpose**: Syntax-highlighted file viewer  
**Location**: `packages/cli/src/ui/components/file-explorer/SyntaxViewer.tsx`  
**Features**:
- Syntax highlighting
- Line numbers
- Scroll support

---

## Shared Hooks

Reusable hooks for common UI patterns.

### useTabNavigation

**Purpose**: Standard tab navigation  
**Location**: `packages/cli/src/ui/hooks/useTabNavigation.ts`  
**Features**:
- Up/Down arrow navigation
- Left/Right arrow navigation
- ESC key handling
- Enter key handling

**Used By**: All tab components

### useFocusedBorder

**Purpose**: Focus-aware border styling  
**Location**: `packages/cli/src/ui/hooks/useFocusedBorder.ts`  
**Features**:
- Returns border color based on focus
- Theme integration

**Used By**: All components with borders

### useScrollWindow

**Purpose**: Scroll window management  
**Location**: `packages/cli/src/ui/hooks/useScrollWindow.ts`  
**Features**:
- Automatic scroll adjustment
- Visible items calculation
- Scroll indicators

**Used By**: ChatTab, HooksTab, MCPTab, WorkspacePanel

### useConfirmation

**Purpose**: Confirmation dialog state  
**Location**: `packages/cli/src/ui/hooks/useConfirmation.ts`  
**Features**:
- Confirmation flow management
- Loading states
- Error handling
- Auto-close on success

**Used By**: HooksTab, MCPTab, various dialogs

---

## Component Relationships

### Parent-Child Relationships

```
App
├── HeaderBar
├── TabBar
├── WindowContainer
│   ├── ChatTab
│   │   ├── ChatHistory
│   │   │   ├── Message
│   │   │   ├── ToolCall
│   │   │   └── StreamingIndicator
│   │   └── ReasoningBox
│   ├── Terminal
│   └── EditorMockup
├── SidePanel
│   ├── ContextSection
│   └── WorkspacePanel
│       ├── FocusedFilesPanel
│       ├── FileTreeView
│       └── KeybindsPanel
├── StatusBar
└── DialogManager
    ├── ConfirmationDialog
    ├── HelpOverlay
    ├── AddHookDialog
    ├── EditHookDialog
    ├── ServerConfigDialog
    └── [Other Dialogs]
```

### Component Dependencies

```
TabContainer
└── useFocusedBorder

TwoColumnLayout
└── Theme

ChatTab
├── useFocusedBorder
├── useScrollWindow
└── useTabNavigation

HooksTab
├── TwoColumnLayout
├── useTabNavigation
├── useScrollWindow
├── useConfirmation
└── useFocusedBorder

MCPTab
├── TwoColumnLayout
├── useTabNavigation
├── useScrollWindow
├── useConfirmation
└── useFocusedBorder
```

---

## Component Patterns

### Standard Tab Pattern

All tab components follow this pattern:

```typescript
export const MyTab: React.FC<MyTabProps> = ({ height, width, theme }) => {
  const { hasFocus, borderColor } = useFocusedState('my-tab');

  useTabNavigation({
    hasFocus,
    onUp: () => { /* navigate up */ },
    onDown: () => { /* navigate down */ },
    onEscape: () => { /* exit level */ },
  });

  return (
    <Box
      flexDirection="column"
      height={height}
      width={width}
      borderStyle="single"
      borderColor={borderColor}
    >
      {/* Tab content */}
    </Box>
  );
};
```

### Two-Column Layout Pattern

Components with two-column layouts use:

```typescript
<TwoColumnLayout
  leftColumn={<LeftContent />}
  rightColumn={<RightContent />}
  leftWidth={30}
  height={height}
  width={width}
  theme={theme}
  leftBorderColor={leftBorderColor}
  rightBorderColor={rightBorderColor}
/>
```

### Confirmation Dialog Pattern

Components with confirmation flows use:

```typescript
const confirmation = useConfirmation({
  onConfirm: async () => {
    await performAction();
  },
  onSuccess: () => {
    showNotification('Success');
  },
});

// In render:
<ConfirmationDialog
  isOpen={confirmation.isOpen}
  status={confirmation.status}
  selection={confirmation.selection}
  onSelectionChange={confirmation.setSelection}
  onConfirm={confirmation.confirm}
  onCancel={confirmation.cancel}
/>
```

---

## Navigation Flow

### Level 1 Navigation (Tab Key)

```
User Input → Chat Window → Nav Bar → Side Panel → User Input
```

### Level 2 Navigation (Tab Content)

Each tab has its own navigation:
- Up/Down: Navigate items
- Left/Right: Navigate columns or expand/collapse
- Enter: Activate item
- ESC: Exit to Level 1

### Level 3 Navigation (Dialogs)

Dialogs capture all input:
- Tab: Navigate dialog elements
- Enter: Confirm
- ESC: Close dialog

---

## Focus IDs

Standard focus IDs used across the application:

### Level 1 Focus IDs
- `chat-input` - User input area
- `chat-history` - Main chat/window area
- `nav-bar` - Top navigation bar
- `context-panel` - Right side panel
- `side-file-tree` - File tree in side panel

### Level 2 Focus IDs (Tab-Specific)
- `file-tree` - File explorer tree view
- `file-search` - File search dialog
- `tools-list` - Tools tab list
- `hooks-list` - Hooks tab list
- `mcp-servers` - MCP servers list
- `search-input` - Search tab input
- `docs-viewer` - Docs tab viewer
- `github-repos` - GitHub tab repos
- `settings-form` - Settings tab form

### Level 3 Focus IDs (Modals)
- `confirmation-dialog` - Confirmation dialogs
- `input-dialog` - Input dialogs
- `menu-overlay` - Menu overlays

---

## Styling Patterns

### Theme Colors

All components use theme colors:

```typescript
theme.text.primary      // Primary text
theme.text.secondary    // Secondary text
theme.text.accent       // Accent text
theme.border.primary    // Primary border
theme.border.active     // Active border
theme.background.primary // Primary background
```

### Border Styling

Focus-aware borders:

```typescript
const borderColor = useFocusedBorder('component-id');

<Box borderStyle="single" borderColor={borderColor}>
  {content}
</Box>
```

### Layout Patterns

Consistent spacing:

```typescript
<Box padding={1}>        // Standard padding
<Box marginBottom={1}>   // Standard margin
<Box gap={1}>            // Standard gap
```

---

## Testing Strategy

### Unit Tests

Each component should have unit tests:
- Props validation
- Rendering logic
- Event handlers
- State management

### Integration Tests

Complex components need integration tests:
- User interactions
- Navigation flows
- Dialog flows
- Error handling

### Visual Regression Tests

Critical components need visual tests:
- Layout consistency
- Theme application
- Focus states
- Loading states

---

## Performance Considerations

### Memoization

Use React.memo for expensive components:

```typescript
export const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});
```

### Virtualization

Large lists should use virtualization:
- File tree (WorkspacePanel)
- Hook list (HooksTab)
- Server list (MCPTab)
- Message history (ChatTab)

### Lazy Loading

Heavy components should be lazy loaded:

```typescript
const CodeEditor = lazy(() => import('./CodeEditor'));
```

---

## Maintenance Guidelines

### Adding New Components

1. Follow the standard patterns
2. Use shared hooks where applicable
3. Add JSDoc comments
4. Add to this hierarchy document
5. Add tests
6. Update index files

### Modifying Existing Components

1. Check for breaking changes
2. Update tests
3. Update documentation
4. Verify focus management
5. Test keyboard navigation

### Deprecating Components

1. Mark as deprecated in JSDoc
2. Add migration guide
3. Update dependent components
4. Remove after migration period

---

## References

- [Design Document](../../../.kiro/specs/v0.1.0 Debugging and Polishing/design.md)
- [Navigation Spec](../../../.dev/FINAL-NAVIGATION-SPEC.md)
- [Focus Hierarchy](../../../.dev/HIERARCHICAL-FOCUS-IMPLEMENTATION.md)
- [UI Components Audit](../../../.dev/audits/ui-components-audit.md)

---

**End of Component Hierarchy Documentation**
