# UI Test Infrastructure Setup Guide

This document describes the UI test infrastructure for testing Ink components with React 19.

## Overview

The UI test infrastructure provides utilities for testing terminal UI components built with Ink 6 and React 19. It includes:

- **Custom Ink Testing Utilities**: Compatible with Ink 6 + React 19 (located in `packages/cli/src/test/ink-testing.tsx`)
- **UI Test Helpers**: Comprehensive helpers for assertions, input simulation, and state checking (located in `packages/test-utils/src/uiTestHelpers.ts`)
- **Test Fixtures**: Mock themes, keybinds, and context providers

## Installation

The required dependencies are already installed:

```json
{
  "devDependencies": {
    "ink-testing-library": "github:vadimdemedes/ink-testing-library",
    "vitest": "^1.6.1",
    "react": "^19.0.0",
    "ink": "^6.0.0"
  }
}
```

## Test Configuration

Vitest is configured in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
```

## Basic Usage

### 1. Import Test Utilities

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, stripAnsi } from '../../../test/ink-testing.js';
import {
  frameContains,
  typeText,
  KeyboardInput,
  mockTheme,
  mockKeybinds,
  UIAssertions,
} from '@ollm/test-utils';
```

### 2. Render a Component

```typescript
describe('MyComponent', () => {
  it('should render correctly', () => {
    const { lastFrame } = render(<MyComponent />);
    
    expect(lastFrame()).toBeDefined();
    expect(frameContains(lastFrame(), 'Hello')).toBe(true);
  });
});
```

### 3. Test with Context Providers

```typescript
import { ChatProvider } from '../../../contexts/ChatContext.js';
import { UIProvider } from '../../../contexts/UIContext.js';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UIProvider>
    <ChatProvider>
      {children}
    </ChatProvider>
  </UIProvider>
);

it('should work with context', () => {
  const { lastFrame } = render(
    <TestWrapper>
      <MyComponent />
    </TestWrapper>
  );
  
  expect(lastFrame()).toBeDefined();
});
```

### 4. Simulate User Input

```typescript
it('should handle keyboard input', () => {
  const { stdin, lastFrame } = render(<InputBox />);
  
  // Type text
  typeText(stdin, 'Hello world');
  
  // Press Enter
  stdin.write(KeyboardInput.ENTER);
  
  // Assert
  expect(frameContains(lastFrame(), 'Hello world')).toBe(true);
});
```

### 5. Test Async Updates

```typescript
import { waitForText } from '@ollm/test-utils';

it('should update after async operation', async () => {
  const { lastFrame } = render(<AsyncComponent />);
  
  // Wait for text to appear
  await waitForText(() => lastFrame(), 'Loaded', { timeout: 5000 });
  
  expect(frameContains(lastFrame(), 'Loaded')).toBe(true);
});
```

## Available Helpers

### Text Extraction and Assertions

```typescript
import {
  stripAnsi,
  getTextContent,
  frameContains,
  frameMatches,
  countOccurrences,
  getLines,
  getLine,
  isEmptyFrame,
  UIAssertions,
} from '@ollm/test-utils';

// Extract text without ANSI codes
const text = getTextContent(frame);

// Check if frame contains text
if (frameContains(frame, 'Hello')) { /* ... */ }

// Check with regex
if (frameMatches(frame, /Hello \w+/)) { /* ... */ }

// Count occurrences
const count = countOccurrences(frame, 'error');

// Get lines
const lines = getLines(frame);
const firstLine = getLine(frame, 0);

// Check if empty
if (isEmptyFrame(frame)) { /* ... */ }

// Assertions
UIAssertions.assertContains(frame, 'Hello');
UIAssertions.assertNotContains(frame, 'Error');
UIAssertions.assertMatches(frame, /\d+/);
UIAssertions.assertLineCount(frame, 5);
UIAssertions.assertLineContains(frame, 0, 'Title');
```

### Keyboard Input Simulation

```typescript
import { KeyboardInput, typeText, typeAndSubmit } from '@ollm/test-utils';

// Type text character by character
typeText(stdin, 'Hello world');

// Type and press Enter
typeAndSubmit(stdin, 'Hello world');

// Special keys
stdin.write(KeyboardInput.ENTER);
stdin.write(KeyboardInput.ARROW_UP);
stdin.write(KeyboardInput.ARROW_DOWN);
stdin.write(KeyboardInput.CTRL_C);
stdin.write(KeyboardInput.ESCAPE);
stdin.write(KeyboardInput.BACKSPACE);
stdin.write(KeyboardInput.TAB);
```

### Async Waiting Helpers

```typescript
import {
  waitForCondition,
  waitForText,
  waitForPattern,
  waitForFrameUpdate,
} from '@ollm/test-utils';

// Wait for condition
await waitForCondition(
  () => someCondition === true,
  { timeout: 5000, interval: 100 }
);

// Wait for text to appear
await waitForText(() => lastFrame(), 'Success', { timeout: 3000 });

// Wait for pattern match
await waitForPattern(() => lastFrame(), /\d+ items/, { timeout: 3000 });

// Wait for frame to change
await waitForFrameUpdate(() => lastFrame(), { timeout: 2000 });
```

### Mock Data

```typescript
import { mockTheme, mockKeybinds } from '@ollm/test-utils';

// Use mock theme
const { lastFrame } = render(
  <MyComponent theme={mockTheme} keybinds={mockKeybinds} />
);
```

### State Checking

```typescript
import { UIState } from '@ollm/test-utils';

// Check component state
if (UIState.isLoading(frame)) { /* ... */ }
if (UIState.hasError(frame)) { /* ... */ }
if (UIState.hasSuccess(frame)) { /* ... */ }
if (UIState.hasWarning(frame)) { /* ... */ }
```

### Performance Testing

```typescript
import { UIPerformance } from '@ollm/test-utils';

// Measure render time
const { result, duration } = await UIPerformance.measureRenderTime(() => {
  return render(<MyComponent />);
});

// Assert render speed
UIPerformance.assertRenderSpeed(duration, 100, 'MyComponent');
```

### Snapshot Testing

```typescript
import { UISnapshot } from '@ollm/test-utils';

// Normalize frame for snapshot (removes timestamps, IDs, etc.)
const normalized = UISnapshot.normalizeFrame(lastFrame());
expect(normalized).toMatchSnapshot();

// Compare frames
const equal = UISnapshot.framesEqual(frame1, frame2);
```

## Testing Patterns

### Pattern 1: Basic Component Rendering

```typescript
describe('ChatHistory', () => {
  it('should render user messages', () => {
    const messages = [
      { role: 'user', content: 'Hello', timestamp: new Date() }
    ];
    
    const { lastFrame } = render(<ChatHistory messages={messages} />);
    
    UIAssertions.assertContains(lastFrame(), 'Hello');
    UIAssertions.assertContains(lastFrame(), 'user');
  });
});
```

### Pattern 2: Interactive Components

```typescript
describe('InputBox', () => {
  it('should accept and display input', () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <InputBox onSubmit={onSubmit} theme={mockTheme} keybinds={mockKeybinds} />
    );
    
    typeText(stdin, 'Test input');
    expect(frameContains(lastFrame(), 'Test input')).toBe(true);
    
    stdin.write(KeyboardInput.ENTER);
    expect(onSubmit).toHaveBeenCalledWith('Test input');
  });
});
```

### Pattern 3: Async State Updates

```typescript
describe('StreamingMessage', () => {
  it('should update progressively', async () => {
    const { lastFrame, rerender } = render(<StreamingMessage content="" />);
    
    rerender(<StreamingMessage content="Hello" />);
    await waitForText(() => lastFrame(), 'Hello');
    
    rerender(<StreamingMessage content="Hello world" />);
    await waitForText(() => lastFrame(), 'Hello world');
  });
});
```

### Pattern 4: Tool Confirmation Flow

```typescript
describe('ToolConfirmation', () => {
  it('should execute tool on approval', () => {
    const onApprove = vi.fn();
    const toolCall = { name: 'read_file', arguments: { path: 'test.txt' } };
    
    const { stdin } = render(
      <ToolConfirmation toolCall={toolCall} onApprove={onApprove} />
    );
    
    stdin.write('y'); // Approve
    expect(onApprove).toHaveBeenCalled();
  });
  
  it('should skip tool on rejection', () => {
    const onReject = vi.fn();
    const toolCall = { name: 'read_file', arguments: { path: 'test.txt' } };
    
    const { stdin } = render(
      <ToolConfirmation toolCall={toolCall} onReject={onReject} />
    );
    
    stdin.write('n'); // Reject
    expect(onReject).toHaveBeenCalled();
  });
});
```

### Pattern 5: Status Display

```typescript
describe('StatusBar', () => {
  it('should display model and status', () => {
    const { lastFrame } = render(
      <StatusBar model="llama3.1:8b" status="ready" />
    );
    
    UIAssertions.assertContains(lastFrame(), 'llama3.1:8b');
    UIAssertions.assertContains(lastFrame(), 'ready');
  });
});
```

### Pattern 6: Loading States

```typescript
describe('LoadingSpinner', () => {
  it('should display spinner', () => {
    const { lastFrame } = render(<LoadingSpinner />);
    
    expect(UIState.isLoading(lastFrame())).toBe(true);
    expect(frameMatches(lastFrame(), /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/)).toBe(true);
  });
});
```

## Best Practices

### 1. Use Test Wrappers for Context

Always wrap components that need context providers:

```typescript
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UIProvider>
    <ChatProvider>
      {children}
    </ChatProvider>
  </UIProvider>
);
```

### 2. Clean Up After Tests

```typescript
import { cleanup } from '../../../test/ink-testing.js';

afterEach(() => {
  cleanup();
});
```

### 3. Use Descriptive Test Names

```typescript
// Good
it('should display error message when validation fails')

// Bad
it('should work')
```

### 4. Test User Interactions

Always test how users will interact with components:

```typescript
it('should submit on Enter key', () => {
  const onSubmit = vi.fn();
  const { stdin } = render(<InputBox onSubmit={onSubmit} />);
  
  typeAndSubmit(stdin, 'Hello');
  expect(onSubmit).toHaveBeenCalledWith('Hello');
});
```

### 5. Test Edge Cases

```typescript
it('should handle empty input gracefully', () => {
  const { lastFrame } = render(<InputBox />);
  expect(lastFrame()).toBeDefined();
});

it('should handle very long input', () => {
  const longText = 'x'.repeat(1000);
  const { stdin, lastFrame } = render(<InputBox />);
  
  typeText(stdin, longText);
  expect(frameContains(lastFrame(), longText)).toBe(true);
});
```

### 6. Use Async Helpers for Dynamic Content

```typescript
it('should load data asynchronously', async () => {
  const { lastFrame } = render(<AsyncComponent />);
  
  // Wait for loading to complete
  await waitForText(() => lastFrame(), 'Loaded');
  
  UIAssertions.assertNotContains(lastFrame(), 'Loading');
});
```

### 7. Test Accessibility

```typescript
it('should have accessible labels', () => {
  const { lastFrame } = render(<InputBox />);
  
  UIAssertions.assertContains(lastFrame(), 'Input:');
  UIAssertions.assertContains(lastFrame(), 'Press Enter to submit');
});
```

## Common Issues and Solutions

### Issue 1: Frame is undefined

**Problem**: `lastFrame()` returns `undefined`

**Solution**: Component may not have rendered yet. Use `waitForFrameUpdate`:

```typescript
await waitForFrameUpdate(() => lastFrame());
expect(lastFrame()).toBeDefined();
```

### Issue 2: ANSI codes in assertions

**Problem**: Assertions fail due to ANSI escape codes

**Solution**: Use `getTextContent` or `stripAnsi`:

```typescript
const text = getTextContent(lastFrame());
expect(text).toContain('Hello');
```

### Issue 3: Async updates not reflected

**Problem**: Component updates but test doesn't see changes

**Solution**: Use async waiting helpers:

```typescript
await waitForText(() => lastFrame(), 'Updated');
```

### Issue 4: Context not available

**Problem**: Component throws error about missing context

**Solution**: Wrap in appropriate providers:

```typescript
const { lastFrame } = render(
  <TestWrapper>
    <MyComponent />
  </TestWrapper>
);
```

### Issue 5: Input not working

**Problem**: Keyboard input doesn't trigger expected behavior

**Solution**: Ensure you're using the correct key codes:

```typescript
stdin.write(KeyboardInput.ENTER); // Not '\n'
```

## Running Tests

```bash
# Run all tests
npm test

# Run UI tests only
npm test -- --grep "UI|Component"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test packages/cli/src/ui/components/chat/__tests__/ChatHistory.test.tsx
```

## Coverage Requirements

UI tests should maintain:
- **Line coverage**: 80%+
- **Branch coverage**: 80%+
- **Function coverage**: 80%+

## Additional Resources

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Best Practices](https://react.dev/learn/testing)
- [Custom Ink Testing Utilities](../cli/src/test/ink-testing.tsx)

## Examples

See existing tests for examples:
- `packages/cli/src/ui/components/layout/__tests__/InputBox.test.tsx`
- `packages/cli/src/ui/components/chat/__tests__/ChatHistory.*.test.tsx`
- `packages/cli/src/ui/components/layout/__tests__/StatusBar.*.test.tsx`
