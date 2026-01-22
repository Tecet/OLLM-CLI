# UI Component Usage Examples

**Last Updated**: January 22, 2026  
**Version**: 1.0.0

## Overview

This document provides practical usage examples for all shared UI components and hooks. Use these examples as templates when building new features or refactoring existing code.

---

## Shared Hooks

### useTabNavigation

Standard keyboard navigation for tab components.

#### Basic Usage

```typescript
import { useTabNavigation } from '../../hooks/useTabNavigation.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';

export const MyTab: React.FC<MyTabProps> = () => {
  const { isFocused } = useFocusManager();
  const hasFocus = isFocused('my-tab');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = ['Item 1', 'Item 2', 'Item 3'];

  useTabNavigation({
    hasFocus,
    onUp: () => setSelectedIndex(prev => Math.max(0, prev - 1)),
    onDown: () => setSelectedIndex(prev => Math.min(items.length - 1, prev + 1)),
    onEscape: () => {
      // Custom escape handling
      console.log('Escaping from tab');
    },
  });

  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Text key={index} inverse={index === selectedIndex}>
          {item}
        </Text>
      ))}
    </Box>
  );
};
```

#### With Two-Column Navigation

```typescript
useTabNavigation({
  hasFocus,
  onUp: () => {
    if (activeColumn === 'left') {
      setLeftIndex(prev => Math.max(0, prev - 1));
    } else {
      setRightIndex(prev => Math.max(0, prev - 1));
    }
  },
  onDown: () => {
    if (activeColumn === 'left') {
      setLeftIndex(prev => Math.min(leftItems.length - 1, prev + 1));
    } else {
      setRightIndex(prev => Math.min(rightItems.length - 1, prev + 1));
    }
  },
  onLeft: () => setActiveColumn('left'),
  onRight: () => setActiveColumn('right'),
  onEnter: () => {
    if (activeColumn === 'left') {
      selectLeftItem(leftIndex);
    } else {
      selectRightItem(rightIndex);
    }
  },
});
```

#### With Expand/Collapse

```typescript
const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

useTabNavigation({
  hasFocus,
  onUp: () => setSelectedIndex(prev => Math.max(0, prev - 1)),
  onDown: () => setSelectedIndex(prev => Math.min(items.length - 1, prev + 1)),
  onLeft: () => {
    // Collapse current item
    const itemId = items[selectedIndex].id;
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  },
  onRight: () => {
    // Expand current item
    const itemId = items[selectedIndex].id;
    setExpandedItems(prev => new Set(prev).add(itemId));
  },
});
```

---

### useFocusedBorder

Focus-aware border styling.

#### Basic Usage

```typescript
import { useFocusedBorder } from '../../hooks/useFocusedBorder.js';

export const MyComponent: React.FC<MyComponentProps> = () => {
  const borderColor = useFocusedBorder('my-component');

  return (
    <Box borderStyle="single" borderColor={borderColor}>
      {content}
    </Box>
  );
};
```

#### With Focus State

```typescript
import { useFocusedState } from '../../hooks/useFocusedBorder.js';

export const MyComponent: React.FC<MyComponentProps> = () => {
  const { hasFocus, borderColor } = useFocusedState('my-component');

  return (
    <Box borderStyle="single" borderColor={borderColor}>
      <Text bold={hasFocus}>
        {hasFocus ? '● Active' : '○ Inactive'}
      </Text>
    </Box>
  );
};
```

---

### useScrollWindow

Scroll window management for large lists.

#### Basic Usage

```typescript
import { useScrollWindow } from '../../hooks/useScrollWindow.js';

export const MyList: React.FC<MyListProps> = ({ items, height }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const windowSize = height - 2; // Account for borders

  const { visibleItems, hasMore, hasMoreBelow } = useScrollWindow({
    items,
    selectedIndex,
    windowSize,
  });

  return (
    <Box flexDirection="column" height={height}>
      {hasMore && <Text color="gray">↑ More items above</Text>}
      {visibleItems.map((item, index) => (
        <Text key={index}>{item}</Text>
      ))}
      {hasMoreBelow && <Text color="gray">↓ More items below</Text>}
    </Box>
  );
};
```

#### With Navigation

```typescript
const [selectedIndex, setSelectedIndex] = useState(0);
const { visibleItems, scrollOffset } = useScrollWindow({
  items: allItems,
  selectedIndex,
  windowSize: 10,
});

useTabNavigation({
  hasFocus,
  onUp: () => setSelectedIndex(prev => Math.max(0, prev - 1)),
  onDown: () => setSelectedIndex(prev => Math.min(allItems.length - 1, prev + 1)),
});

return (
  <Box flexDirection="column">
    {visibleItems.map((item, index) => {
      const globalIndex = scrollOffset + index;
      const isSelected = globalIndex === selectedIndex;
      return (
        <Text key={index} inverse={isSelected}>
          {item.name}
        </Text>
      );
    })}
  </Box>
);
```

---

### useConfirmation

Confirmation dialog state management.

#### Basic Usage

```typescript
import { useConfirmation } from '../../hooks/useConfirmation.js';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog.js';

export const MyComponent: React.FC = () => {
  const confirmation = useConfirmation({
    onConfirm: async () => {
      await deleteItem(itemId);
    },
    onSuccess: () => {
      showNotification('Item deleted successfully');
    },
    onError: (error) => {
      showNotification(`Error: ${error.message}`);
    },
  });

  return (
    <>
      <Button onClick={confirmation.open}>Delete Item</Button>
      
      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        level="danger"
        status={confirmation.status}
        selection={confirmation.selection}
        onSelectionChange={confirmation.setSelection}
        onConfirm={confirmation.confirm}
        onCancel={confirmation.cancel}
        error={confirmation.error}
      />
    </>
  );
};
```

#### With Multiple Confirmations

```typescript
const deleteConfirmation = useConfirmation({
  onConfirm: async () => await deleteItem(itemId),
});

const archiveConfirmation = useConfirmation({
  onConfirm: async () => await archiveItem(itemId),
});

return (
  <>
    <Button onClick={deleteConfirmation.open}>Delete</Button>
    <Button onClick={archiveConfirmation.open}>Archive</Button>
    
    <ConfirmationDialog
      isOpen={deleteConfirmation.isOpen}
      title="Delete Item"
      level="danger"
      {...deleteConfirmation}
    />
    
    <ConfirmationDialog
      isOpen={archiveConfirmation.isOpen}
      title="Archive Item"
      level="warning"
      {...archiveConfirmation}
    />
  </>
);
```

---

## Layout Components

### TwoColumnLayout

Reusable two-column layout.

#### Basic Usage

```typescript
import { TwoColumnLayout } from '../layout/TwoColumnLayout.js';

export const MyTab: React.FC<MyTabProps> = ({ height, width, theme }) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  return (
    <TwoColumnLayout
      leftColumn={
        <ItemList
          items={items}
          selectedItem={selectedItem}
          onSelect={setSelectedItem}
        />
      }
      rightColumn={
        <ItemDetails item={selectedItem} />
      }
      leftWidth={30}
      height={height}
      width={width}
      theme={theme}
    />
  );
};
```

#### With Focus-Aware Borders

```typescript
import { useFocusedBorder } from '../../hooks/useFocusedBorder.js';

export const MyTab: React.FC<MyTabProps> = ({ height, width, theme }) => {
  const [activeColumn, setActiveColumn] = useState<'left' | 'right'>('left');
  
  const leftBorderColor = useFocusedBorder(
    activeColumn === 'left' ? 'my-tab-left' : 'my-tab'
  );
  const rightBorderColor = useFocusedBorder(
    activeColumn === 'right' ? 'my-tab-right' : 'my-tab'
  );

  return (
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
  );
};
```

#### With Custom Gap

```typescript
<TwoColumnLayout
  leftColumn={<LeftContent />}
  rightColumn={<RightContent />}
  leftWidth={40}
  gap={1}
  height={height}
  width={width}
  theme={theme}
/>
```

---

### TabContainer

Standard tab wrapper with focus-aware styling.

#### Basic Usage

```typescript
import { TabContainer } from '../layout/TabContainer.js';

export const MyTab: React.FC<MyTabProps> = ({ height, width, theme }) => {
  return (
    <TabContainer
      focusId="my-tab"
      title="My Tab"
      helpText="Press ? for help"
      height={height}
      width={width}
      theme={theme}
    >
      <MyTabContent />
    </TabContainer>
  );
};
```

#### Without Title

```typescript
<TabContainer
  focusId="my-tab"
  height={height}
  width={width}
  theme={theme}
>
  <MyTabContent />
</TabContainer>
```

#### With Custom Border

```typescript
<TabContainer
  focusId="my-tab"
  height={height}
  width={width}
  theme={theme}
  borderColor={theme.border.accent}
  showBorder={true}
>
  <MyTabContent />
</TabContainer>
```

---

## Complete Tab Example

Here's a complete example of a tab component using all shared patterns:

```typescript
import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTabNavigation } from '../../hooks/useTabNavigation.js';
import { useFocusedState } from '../../hooks/useFocusedBorder.js';
import { useScrollWindow } from '../../hooks/useScrollWindow.js';
import { useConfirmation } from '../../hooks/useConfirmation.js';
import { TwoColumnLayout } from '../layout/TwoColumnLayout.js';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog.js';
import type { Theme } from '../../config/types.js';

interface Item {
  id: string;
  name: string;
  description: string;
}

interface MyTabProps {
  height: number;
  width: number;
  theme: Theme;
}

export const MyTab: React.FC<MyTabProps> = ({ height, width, theme }) => {
  // State
  const [items, setItems] = useState<Item[]>([
    { id: '1', name: 'Item 1', description: 'Description 1' },
    { id: '2', name: 'Item 2', description: 'Description 2' },
    { id: '3', name: 'Item 3', description: 'Description 3' },
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeColumn, setActiveColumn] = useState<'left' | 'right'>('left');

  // Focus management
  const { hasFocus } = useFocusedState('my-tab');
  const leftBorderColor = useFocusedBorder(
    activeColumn === 'left' ? 'my-tab-left' : 'my-tab'
  );
  const rightBorderColor = useFocusedBorder(
    activeColumn === 'right' ? 'my-tab-right' : 'my-tab'
  );

  // Scroll management
  const windowSize = height - 4; // Account for borders and padding
  const { visibleItems, scrollOffset, hasMore, hasMoreBelow } = useScrollWindow({
    items,
    selectedIndex,
    windowSize,
  });

  // Selected item
  const selectedItem = useMemo(
    () => items[selectedIndex] || null,
    [items, selectedIndex]
  );

  // Delete confirmation
  const deleteConfirmation = useConfirmation({
    onConfirm: async () => {
      setItems(prev => prev.filter((_, i) => i !== selectedIndex));
      setSelectedIndex(prev => Math.max(0, prev - 1));
    },
    onSuccess: () => {
      console.log('Item deleted');
    },
  });

  // Navigation
  useTabNavigation({
    hasFocus,
    onUp: () => {
      if (activeColumn === 'left') {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      }
    },
    onDown: () => {
      if (activeColumn === 'left') {
        setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
      }
    },
    onLeft: () => setActiveColumn('left'),
    onRight: () => setActiveColumn('right'),
    onEnter: () => {
      if (activeColumn === 'right') {
        deleteConfirmation.open();
      }
    },
  });

  // Left column: Item list
  const leftColumn = (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.text.primary}>
        Items ({items.length})
      </Text>
      
      {hasMore && (
        <Text color={theme.text.secondary}>↑ More items above</Text>
      )}
      
      {visibleItems.map((item, index) => {
        const globalIndex = scrollOffset + index;
        const isSelected = globalIndex === selectedIndex;
        return (
          <Text
            key={item.id}
            inverse={isSelected}
            color={isSelected ? theme.text.accent : theme.text.primary}
          >
            {isSelected ? '▶ ' : '  '}
            {item.name}
          </Text>
        );
      })}
      
      {hasMoreBelow && (
        <Text color={theme.text.secondary}>↓ More items below</Text>
      )}
    </Box>
  );

  // Right column: Item details
  const rightColumn = (
    <Box flexDirection="column" padding={1}>
      {selectedItem ? (
        <>
          <Text bold color={theme.text.primary}>
            {selectedItem.name}
          </Text>
          <Text color={theme.text.secondary}>
            {selectedItem.description}
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text.accent}>
              Press Enter to delete
            </Text>
          </Box>
        </>
      ) : (
        <Text color={theme.text.secondary}>
          Select an item to view details
        </Text>
      )}
    </Box>
  );

  return (
    <>
      <TwoColumnLayout
        leftColumn={leftColumn}
        rightColumn={rightColumn}
        leftWidth={30}
        height={height}
        width={width}
        theme={theme}
        leftBorderColor={leftBorderColor}
        rightBorderColor={rightBorderColor}
      />

      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        title="Delete Item"
        message={`Are you sure you want to delete "${selectedItem?.name}"?`}
        level="danger"
        status={deleteConfirmation.status}
        selection={deleteConfirmation.selection}
        onSelectionChange={deleteConfirmation.setSelection}
        onConfirm={deleteConfirmation.confirm}
        onCancel={deleteConfirmation.cancel}
        error={deleteConfirmation.error}
        theme={theme}
      />
    </>
  );
};
```

---

## Dialog Examples

### Basic Confirmation Dialog

```typescript
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog.js';

<ConfirmationDialog
  isOpen={true}
  title="Confirm Action"
  message="Are you sure you want to proceed?"
  level="warning"
  status="confirm"
  selection="no"
  onSelectionChange={(selection) => setSelection(selection)}
  onConfirm={async () => {
    await performAction();
  }}
  onCancel={() => setIsOpen(false)}
  theme={theme}
/>
```

### Confirmation with Affected Items

```typescript
<ConfirmationDialog
  isOpen={true}
  title="Delete Multiple Items"
  message="The following items will be deleted:"
  affectedItems={[
    'Item 1',
    'Item 2',
    'Item 3',
  ]}
  level="danger"
  status="confirm"
  selection="no"
  onSelectionChange={setSelection}
  onConfirm={handleDelete}
  onCancel={handleCancel}
  theme={theme}
/>
```

### Confirmation with Warning

```typescript
<ConfirmationDialog
  isOpen={true}
  title="Dangerous Operation"
  message="This action cannot be undone."
  warning="All data will be permanently deleted."
  level="danger"
  status="confirm"
  selection="no"
  onSelectionChange={setSelection}
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  theme={theme}
/>
```

---

## Form Examples

### Basic Form

```typescript
import { FormField, TextInput, Button } from '../forms/index.js';

const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [errors, setErrors] = useState<Record<string, string>>({});

return (
  <Box flexDirection="column" gap={1}>
    <FormField
      label="Name"
      error={errors.name}
      helpText="Enter your full name"
    >
      <TextInput
        value={name}
        onChange={setName}
        placeholder="John Doe"
      />
    </FormField>

    <FormField
      label="Email"
      error={errors.email}
    >
      <TextInput
        value={email}
        onChange={setEmail}
        placeholder="john@example.com"
      />
    </FormField>

    <Button onClick={handleSubmit}>
      Submit
    </Button>
  </Box>
);
```

---

## Best Practices

### 1. Always Use Shared Hooks

❌ **Don't** duplicate navigation logic:

```typescript
useInput((input, key) => {
  if (key.upArrow) {
    setSelectedIndex(prev => Math.max(0, prev - 1));
  }
  if (key.downArrow) {
    setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
  }
}, { isActive: hasFocus });
```

✅ **Do** use `useTabNavigation`:

```typescript
useTabNavigation({
  hasFocus,
  onUp: () => setSelectedIndex(prev => Math.max(0, prev - 1)),
  onDown: () => setSelectedIndex(prev => Math.min(items.length - 1, prev + 1)),
});
```

### 2. Always Use Focus-Aware Borders

❌ **Don't** manually check focus:

```typescript
const { isFocused } = useFocusManager();
const hasFocus = isFocused('my-component');
const borderColor = hasFocus ? theme.border.active : theme.border.primary;
```

✅ **Do** use `useFocusedBorder`:

```typescript
const borderColor = useFocusedBorder('my-component');
```

### 3. Use TwoColumnLayout for Consistent Layouts

❌ **Don't** manually create two-column layouts:

```typescript
<Box flexDirection="row">
  <Box width="30%" borderStyle="single">
    {leftContent}
  </Box>
  <Box width="70%" borderStyle="single">
    {rightContent}
  </Box>
</Box>
```

✅ **Do** use `TwoColumnLayout`:

```typescript
<TwoColumnLayout
  leftColumn={leftContent}
  rightColumn={rightContent}
  leftWidth={30}
  theme={theme}
/>
```

### 4. Use useScrollWindow for Large Lists

❌ **Don't** render all items:

```typescript
{items.map((item, index) => (
  <Text key={index}>{item}</Text>
))}
```

✅ **Do** use `useScrollWindow`:

```typescript
const { visibleItems } = useScrollWindow({
  items,
  selectedIndex,
  windowSize: 10,
});

{visibleItems.map((item, index) => (
  <Text key={index}>{item}</Text>
))}
```

### 5. Use useConfirmation for Confirmation Flows

❌ **Don't** manually manage confirmation state:

```typescript
const [confirmState, setConfirmState] = useState({
  status: 'idle',
  selection: 'no',
  error: undefined,
});
```

✅ **Do** use `useConfirmation`:

```typescript
const confirmation = useConfirmation({
  onConfirm: async () => await performAction(),
});
```

---

## Migration Guide

### Migrating Existing Components

#### Step 1: Replace Navigation Logic

**Before**:
```typescript
useInput((input, key) => {
  if (!hasFocus) return;
  if (key.upArrow) { /* ... */ }
  if (key.downArrow) { /* ... */ }
  if (key.escape) { /* ... */ }
}, { isActive: hasFocus });
```

**After**:
```typescript
useTabNavigation({
  hasFocus,
  onUp: () => { /* ... */ },
  onDown: () => { /* ... */ },
});
```

#### Step 2: Replace Border Logic

**Before**:
```typescript
const { isFocused } = useFocusManager();
const hasFocus = isFocused('component-id');
const borderColor = hasFocus ? theme.border.active : theme.border.primary;
```

**After**:
```typescript
const borderColor = useFocusedBorder('component-id');
```

#### Step 3: Replace Two-Column Layout

**Before**:
```typescript
<Box flexDirection="row">
  <Box width={Math.floor(width * 0.3)} borderStyle="single">
    {leftContent}
  </Box>
  <Box width={Math.floor(width * 0.7)} borderStyle="single">
    {rightContent}
  </Box>
</Box>
```

**After**:
```typescript
<TwoColumnLayout
  leftColumn={leftContent}
  rightColumn={rightContent}
  leftWidth={30}
  width={width}
  theme={theme}
/>
```

---

## References

- [Component Hierarchy](./COMPONENT_HIERARCHY.md)
- [Design Document](../../../.kiro/specs/v0.1.0 Debugging and Polishing/design.md)
- [UI Components Audit](../../../.dev/audits/ui-components-audit.md)

---

**End of Usage Examples**
