# InputBox Component

## Overview

The `InputBox` component is a multi-line input field for the OLLM CLI terminal interface. It provides a rich text input experience with keyboard shortcuts for sending messages, inserting newlines, and editing previous messages.

## Features

### 1. Multi-line Input Support (Requirement 20.9)

- Automatically displays input across multiple lines
- Tracks cursor position within multi-line text
- Renders each line separately for proper display
- Handles line wrapping and navigation

### 2. Enter to Send (Requirement 20.10)

- Press Enter to send the current message
- Input is cleared after sending
- Message is added to chat history via ChatContext
- Disabled when component is in disabled state

### 3. Shift+Enter for Newline (Requirement 20.11)

- Press Shift+Enter to insert a newline character
- Cursor moves to the next line
- Message is not sent
- Allows composing multi-line messages

### 4. Up Arrow for Edit Previous (Requirement 20.11)

- Press Up arrow (when input is empty) to load previous user message
- Navigate through message history
- Shows history indicator with current position
- Exits history mode when typing new content

### 5. Additional Features

- Visual cursor indicator showing current position
- Disabled state for waiting periods
- Theme customization support
- Integration with ChatContext for state management
- Keyboard navigation (left/right arrows, backspace)

## Usage

```typescript
import { InputBox } from './ui/components/layout/InputBox';
import { useChat } from '../../features/context/ChatContext.js';

function MyApp() {
  return (
    <ChatProvider>
      <InputBox
        theme={{
          text: {
            primary: '#d4d4d4',
            secondary: '#858585',
            accent: '#4ec9b0',
          },
          bg: {
            primary: '#1e1e1e',
            secondary: '#252526',
          },
        }}
        keybinds={{
          send: 'return',
          newline: 'shift+return',
          editPrevious: 'up',
        }}
        disabled={false}
      />
    </ChatProvider>
  );
}
```

## Props

### `theme` (required)

Theme configuration for colors and styling.

```typescript
{
  text: {
    primary: string; // Main text color
    secondary: string; // Secondary text color (hints, labels)
    accent: string; // Accent color (prompt, border)
  }
  bg: {
    primary: string; // Primary background color
    secondary: string; // Secondary background color
  }
}
```

### `keybinds` (required)

Keyboard shortcut configuration.

```typescript
{
  send: string; // Key to send message (default: 'return')
  newline: string; // Key to insert newline (default: 'shift+return')
  editPrevious: string; // Key to edit previous message (default: 'up')
}
```

### `disabled` (optional)

Whether the input is disabled. When true:

- Shows "Waiting for response..." message
- Prevents all input
- Changes border color to secondary
- Displays pause icon (⏸)

Default: `false`

## Keyboard Shortcuts

| Key           | Action                                      |
| ------------- | ------------------------------------------- |
| Enter         | Send message                                |
| Shift+Enter   | Insert newline                              |
| Up Arrow      | Edit previous message (when input is empty) |
| Left Arrow    | Move cursor left                            |
| Right Arrow   | Move cursor right                           |
| Backspace     | Delete character before cursor              |
| Any character | Insert character at cursor position         |

## Integration with ChatContext

The InputBox component integrates with ChatContext for:

1. **Reading State**
   - `state.currentInput` - Current input text
   - `state.messages` - Message history for editing

2. **Updating State**
   - `setCurrentInput(input)` - Update input text
   - `sendMessage(content)` - Send message to chat

3. **Message History**
   - Filters user messages for history navigation
   - Loads previous messages when Up arrow is pressed
   - Tracks history position

## Visual Behavior

### Normal State

```
┌─────────────────────────────────────────────────────┐
│ > Type your message (Enter to send, Shift+Enter... │
│ Hello, this is a multi-line                         │
│ message that spans multiple█                        │
│ lines.                                              │
└─────────────────────────────────────────────────────┘
```

### Disabled State

```
┌─────────────────────────────────────────────────────┐
│ ⏸ Waiting for response...                          │
└─────────────────────────────────────────────────────┘
```

### History Mode

```
┌─────────────────────────────────────────────────────┐
│ > Type your message (Enter to send, Shift+Enter... │
│ Previous message content█                           │
│ [Editing message 1 of 3]                           │
└─────────────────────────────────────────────────────┘
```

## Implementation Details

### Cursor Rendering

The cursor is rendered as an inverse character at the current position:

- Shows the character under the cursor with inverted colors
- Displays a space if at the end of a line
- Updates position based on keyboard input

### Multi-line Display

Input is split into lines and rendered separately:

- Each line is a separate Box component
- Empty lines show a space to maintain height
- Cursor is shown on the current line only

### History Navigation

- Tracks history index (-1 when not in history mode)
- Filters messages to only include user messages
- Loads message content and sets cursor to end
- Exits history mode when user types new content

### State Management

- Local state for input and cursor position
- Syncs with ChatContext for persistence
- Updates context on every change
- Clears local state after sending

## Testing

The component includes comprehensive tests:

1. **Unit Tests** (`InputBox.test.tsx`)
   - Basic rendering
   - Disabled state
   - Multi-line display
   - Theme application
   - Context integration

2. **Integration Tests** (`InputBox.integration.test.tsx`)
   - Requirement validation
   - Message history
   - Keyboard shortcuts
   - State management

3. **Examples** (`InputBox.example.tsx`)
   - Usage demonstrations
   - Feature showcases
   - Integration patterns

Run tests:

```bash
npm test -- InputBox --run
```

## Requirements Validation

✅ **Requirement 20.9**: Multi-line input support

- Input displays across multiple lines
- Cursor tracks position in multi-line text
- Each line renders separately

✅ **Requirement 20.10**: Enter to send

- Enter key sends message
- Input clears after sending
- Message added to history

✅ **Requirement 20.11**: Shift+Enter for newline

- Shift+Enter inserts newline
- Cursor moves to next line
- Message not sent

✅ **Requirement 20.11**: Up arrow for edit previous

- Up arrow loads previous message
- History navigation supported
- History indicator shown

## Future Enhancements

Potential improvements for future versions:

1. **Auto-completion**
   - Suggest commands and file paths
   - Tab to complete suggestions

2. **Syntax Highlighting**
   - Highlight code blocks
   - Color slash commands

3. **Paste Support**
   - Handle multi-line paste
   - Preserve formatting

4. **Undo/Redo**
   - Track input history
   - Ctrl+Z to undo changes

5. **Search in History**
   - Ctrl+R to search history
   - Fuzzy matching

## Related Components

- `ChatContext` - State management for chat
- `ChatHistory` - Display messages
- `TabBar` - Navigation tabs
- `StatusBar` - Status information

## License

Part of the OLLM CLI project.
