# Hooks Components

This directory contains UI components for the Hooks Panel feature.

## Components

### HookCategory

A collapsible category header component that displays hook categories with icons, hook counts, and expand/collapse indicators.

**Features:**

- Displays category name with appropriate icon
- Shows hook count (e.g., "2 hooks" or "1 hook")
- Expand/collapse indicator (▼ when expanded, ▶ when collapsed)
- Focus state styling (yellow highlight when selected and focused)
- Themed borders and colors

**Usage:**

```typescript
import { HookCategory } from './components/hooks';

const category = {
  name: 'File Events',
  eventTypes: ['fileEdited', 'fileCreated', 'fileDeleted'],
  hooks: [
    {
      id: 'lint-on-save',
      name: 'Lint on Save',
      command: 'npm',
      args: ['run', 'lint'],
      source: 'builtin',
    },
  ],
  expanded: true,
};

<HookCategory
  category={category}
  isSelected={true}
  hasFocus={true}
  theme={theme}
  onToggleExpand={() => console.log('Toggle expand')}
/>
```

**Props:**

- `category`: HookCategory object containing name, eventTypes, hooks, and expanded state
- `isSelected`: Boolean indicating if this category is currently selected
- `hasFocus`: Boolean indicating if the hooks panel has focus
- `theme`: Theme object for styling
- `onToggleExpand`: Optional callback for expand/collapse action

**Category Icons:**

The component automatically maps category names to icons:

- Session Events: 🔄
- Agent Events: 🤖
- Model Events: 🧠
- Tool Events: 🔧
- Compression Events: 📦
- Notifications: 🔔
- File Events: 📝
- Prompt Events: 💬
- User Triggered: 👤
- Default: 📦

**Requirements:**

This component satisfies requirements 1.4 and 1.5 from the Hooks Panel UI specification:

- 1.4: Category headers are visual-only (not selectable)
- 1.5: Right column shows detailed information for selected hook

## Testing

Run tests for this component:

```bash
npm test -- packages/cli/src/ui/components/hooks/__tests__/HookCategory.test.tsx
```

## Integration

The HookCategory component is designed to be used within the HooksTab component. It will be integrated once the HookItem component (task 2.3) is complete.
