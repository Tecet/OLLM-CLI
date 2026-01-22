# UI Hooks

This directory contains reusable React hooks for common UI patterns in the OLLM CLI application.

## Available Hooks

### useTabNavigation

Standard keyboard navigation for tab components.

**Purpose**: Eliminates duplicate navigation logic across tab components.

**Features**:
- Up/Down arrow navigation
- Left/Right arrow navigation  
- ESC key handling
- Enter key handling
- Focus-aware activation

**Usage**:
```typescript
import { useTabNavigation } from './hooks/useTabNavigation.js';

useTabNavigation({
  hasFocus,
  onUp: () => setSelectedIndex(prev => Math.max(0, prev - 1)),
  onDown: () => setSelectedIndex(prev => Math.min(items.length - 1, prev + 1)),
});
```

**See**: [Usage Examples](../components/USAGE_EXAMPLES.md#usetabnavigation)

---

### useFocusedBorder

Focus-aware border styling.

**Purpose**: Provides consistent border colors based on focus state.

**Features**:
- Returns appropriate border color based on focus
- Theme integration
- Companion `useFocusedState` hook

**Usage**:
```typescript
import { useFocusedBorder } from './hooks/useFocusedBorder.js';

const borderColor = useFocusedBorder('component-id');

<Box borderStyle="single" borderColor={borderColor}>
  {content}
</Box>
```

**See**: [Usage Examples](../components/USAGE_EXAMPLES.md#usefocusedborder)

---

### useScrollWindow

Scroll window management for large lists.

**Purpose**: Manages scrollable windows with automatic scroll adjustment.

**Features**:
- Automatic scroll offset adjustment
- Visible items calculation
- Scroll indicators
- Performance optimized

**Usage**:
```typescript
import { useScrollWindow } from './hooks/useScrollWindow.js';

const { visibleItems, hasMore, hasMoreBelow } = useScrollWindow({
  items: allItems,
  selectedIndex,
  windowSize: 10,
});
```

**See**: [Usage Examples](../components/USAGE_EXAMPLES.md#usescrollwindow)

---

### useConfirmation

Confirmation dialog state management.

**Purpose**: Manages confirmation dialog state and flow.

**Features**:
- Complete confirmation flow
- Loading, success, and error states
- Auto-close on success
- Error handling with callbacks

**Usage**:
```typescript
import { useConfirmation } from './hooks/useConfirmation.js';

const confirmation = useConfirmation({
  onConfirm: async () => await deleteItem(itemId),
  onSuccess: () => showNotification('Deleted'),
});
```

**See**: [Usage Examples](../components/USAGE_EXAMPLES.md#useconfirmation)

---

## When to Use These Hooks

### Use `useTabNavigation` when:
- Building a tab component with keyboard navigation
- Need consistent Up/Down/Left/Right/ESC/Enter handling
- Want to avoid duplicating navigation logic

### Use `useFocusedBorder` when:
- Need border color that changes based on focus
- Want consistent focus styling across components
- Building a component with focus-aware UI

### Use `useScrollWindow` when:
- Rendering a large list that doesn't fit in the viewport
- Need automatic scroll adjustment to keep selected item visible
- Want scroll indicators (more above/below)

### Use `useConfirmation` when:
- Need a confirmation dialog with yes/no selection
- Want loading, success, and error states
- Need auto-close after successful confirmation

---

## Best Practices

1. **Always use shared hooks** instead of duplicating logic
2. **Check existing hooks** before creating new ones
3. **Add JSDoc comments** to all hooks
4. **Provide usage examples** in documentation
5. **Write tests** for all hooks

---

## Adding New Hooks

When adding a new hook:

1. Create the hook file in this directory
2. Add comprehensive JSDoc comments
3. Export from `index.ts`
4. Add usage examples to `USAGE_EXAMPLES.md`
5. Update this README
6. Write unit tests

---

## References

- [Component Hierarchy](../components/COMPONENT_HIERARCHY.md)
- [Usage Examples](../components/USAGE_EXAMPLES.md)
- [Design Document](../../../../.kiro/specs/v0.1.0 Debugging and Polishing/design.md)

---

## Migration Guide

If you have existing components with duplicate logic, see the [Migration Guide](../components/USAGE_EXAMPLES.md#migration-guide) for step-by-step instructions on how to migrate to these shared hooks.
