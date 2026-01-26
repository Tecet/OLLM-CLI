# Terminal System

**Last Updated:** January 26, 2026  
**Status:** Active  
**Related Documents:**
- [dev_UI_Front.md](./dev_UI_Front.md) - Main UI layout
- [dev_Keybinds.md](./dev_Keybinds.md) - Terminal keybinds
- [dev_ToolExecution.md](./dev_ToolExecution.md) - Shell tool integration

---

## Overview

OLLM CLI includes an integrated terminal system that provides two independent terminal sessions within the UI. The terminal system uses PTY (pseudo-terminal) for shell process management and xterm.js headless for ANSI parsing and rendering.

---

## Architecture

### Components

**Terminal Context Providers:**
- `TerminalContext` - Manages first terminal session
- `Terminal2Context` - Manages second terminal session

**UI Components:**
- `Terminal2.tsx` - Terminal display component with ANSI rendering
- Terminal tab in right panel

**Utilities:**
- `terminalSerializer.ts` - Converts xterm.js buffer to structured ANSI tokens

---

## Terminal Sessions

### Dual Terminal Design

OLLM CLI provides two independent terminal sessions:

1. **Terminal 1** - Primary terminal (implementation TBD)
2. **Terminal 2** - Secondary terminal (fully implemented)

Each terminal:
- Runs in its own PTY process
- Has independent shell session
- Maintains separate scrollback buffer
- Can be focused and controlled independently

---

## PTY Integration

### Process Spawning

**Platform-Specific Shells:**
```typescript
const isWindows = os.platform() === 'win32';
const shell = isWindows ? 'powershell.exe' : 'bash';
const shellArgs = isWindows
  ? ['-NoProfile', '-NoLogo', '-NoExit', '-Command', 
     'Set-PSReadLineOption -PredictionSource None']
  : [];
```

**PTY Configuration:**
```typescript
pty.spawn(shell, shellArgs, {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env,
});
```

### Data Flow

```
User Input → Terminal Component → PTY Process → Shell
                                       ↓
Shell Output → PTY Data Event → xterm.js Parser → ANSI Tokens → React Render
```

---

## ANSI Rendering

### Terminal Serializer

The `terminalSerializer.ts` utility converts xterm.js buffer content into structured tokens for Ink rendering.

**Token Structure:**
```typescript
interface AnsiToken {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  dim: boolean;
  inverse: boolean;
  fg: string;  // Hex color
  bg: string;  // Hex color
}

type AnsiLine = AnsiToken[];
type AnsiOutput = AnsiLine[];
```

**Serialization Process:**
1. Read xterm.js buffer cells
2. Extract cell attributes (bold, italic, colors, etc.)
3. Group consecutive cells with same attributes
4. Convert to structured tokens
5. Emit as array of lines

**Color Modes:**
- `DEFAULT` - Terminal default colors
- `PALETTE` - 256-color ANSI palette
- `RGB` - True color (24-bit)

**Color Conversion:**
```typescript
// RGB mode: Extract RGB components
const r = (color >> 16) & 255;
const g = (color >> 8) & 255;
const b = color & 255;
return `#${r.toString(16).padStart(2, '0')}...`;

// PALETTE mode: Use ANSI color table
return ANSI_COLORS[color] || defaultColor;

// DEFAULT mode: Use terminal defaults
return defaultColor;
```

---

## Terminal Context API

### TerminalContext / Terminal2Context

Both contexts provide the same API:

```typescript
interface TerminalContextValue {
  output: AnsiLine[];           // Structured terminal output
  isRunning: boolean;           // PTY process status
  sendCommand: (cmd: string) => void;    // Send command + Enter
  sendRawInput: (char: string) => void;  // Send raw characters
  clear: () => void;            // Clear terminal
  interrupt: () => void;        // Send Ctrl+C
  resize: (cols: number, rows: number) => void;  // Resize terminal
}
```

**Usage:**
```typescript
const { output, isRunning, sendCommand, clear } = useTerminal();
```

**Methods:**

1. **sendCommand(command: string)**
   - Sends command with carriage return (`\r`)
   - Use for complete commands
   - Example: `sendCommand('ls -la')`

2. **sendRawInput(char: string)**
   - Sends raw characters without modification
   - Use for interactive input
   - Example: `sendRawInput('y')` for yes/no prompts

3. **clear()**
   - Clears xterm buffer
   - Sends `clear` command to shell
   - Resets output state

4. **interrupt()**
   - Sends Ctrl+C (`\x03`) to PTY
   - Interrupts running process
   - Does not clear terminal

5. **resize(cols: number, rows: number)**
   - Resizes both xterm and PTY
   - Minimum: 1 col × 1 row
   - Silently fails on error

---

## Terminal Component

### Terminal2.tsx

**Props:**
```typescript
interface Terminal2Props {
  height: number;  // Available height in rows
}
```

**Features:**
- ANSI token rendering with full color support
- Scrollback buffer with keyboard navigation
- Auto-scroll to bottom on new output
- Focus management integration
- Responsive width calculation

**Rendering:**
```typescript
const renderLine = (line: AnsiLine, index: number) => {
  return (
    <Box key={index}>
      {line.map((token, i) => (
        <Text
          key={i}
          color={token.fg}
          backgroundColor={token.bg}
          bold={token.bold}
          italic={token.italic}
          underline={token.underline}
          dimColor={token.dim}
          inverse={token.inverse}
        >
          {token.text}
        </Text>
      ))}
    </Box>
  );
};
```

**Layout:**
```typescript
<Box
  flexDirection="column"
  height="100%"
  width="100%"
  paddingX={1}
  paddingTop={1}
  paddingBottom={0}
  flexGrow={1}
  flexShrink={1}
  overflow="hidden"
>
  {/* Terminal output */}
</Box>
```

---

## Scrollback Buffer

### Buffer Management

**Configuration:**
```typescript
new Terminal({
  cols: 80,
  rows: 30,
  scrollback: 1000,  // Lines to keep in buffer
  allowProposedApi: true,
});
```

**Scroll Controls:**
- `Ctrl+Shift+Up` - Scroll up
- `Ctrl+Shift+Down` - Scroll down
- Auto-scroll to bottom on new output

**Implementation:**
```typescript
const [scrollOffset, setScrollOffset] = useState(0);
const maxScroll = Math.max(0, allLines.length - visibleHeight);

// Visible lines calculation
const start = Math.max(0, allLines.length - visibleHeight - scrollOffset);
const end = allLines.length - scrollOffset;
const visibleLines = allLines.slice(start, end);
```

**Auto-Scroll Behavior:**
- New output resets scroll to bottom
- User scroll disables auto-scroll
- Scroll offset tracked per terminal

---

## Command History

### Shell-Level History

Command history is managed by the shell itself (bash/PowerShell), not by the terminal component.

**Bash:**
- `~/.bash_history`
- Up/Down arrows for navigation
- `Ctrl+R` for reverse search

**PowerShell:**
- PSReadLine module
- Up/Down arrows for navigation
- `Ctrl+R` for reverse search
- Prediction disabled via `-PredictionSource None`

---

## Integration with Shell Tool

### Tool Execution Flow

When the LLM uses the shell tool:

1. Tool receives command from LLM
2. Command sent to terminal via `sendCommand()`
3. PTY executes command in shell
4. Output captured and displayed in terminal
5. Exit code returned to LLM

**Shell Tool → Terminal:**
```typescript
// In shell tool
const terminal = useTerminal();
terminal.sendCommand(command);
```

**Reference:** See [dev_ToolExecution.md](./dev_ToolExecution.md) for shell tool details.

---

## Terminal State Management

### Context State

**TerminalContext State:**
```typescript
const [output, setOutput] = useState<AnsiLine[]>([]);
const [isRunning, setIsRunning] = useState(false);
const ptyProcessRef = useRef<pty.IPty | null>(null);
const xtermRef = useRef<any>(null);
```

**Lifecycle:**
1. **Mount:** Spawn PTY process, create xterm instance
2. **Data:** PTY output → xterm parser → state update
3. **Unmount:** Dispose event listeners → dispose xterm → kill PTY

**Cleanup Order (Critical):**
```typescript
// 1. Dispose event listeners first
dataDisposable.dispose();
exitDisposable.dispose();

// 2. Dispose xterm
xtermRef.current.dispose();

// 3. Kill PTY process
ptyProcessRef.current.kill();
```

### Data Processing

**PTY Data Handler:**
```typescript
ptyProcess.onData((data) => {
  xterm.write(data, () => {
    const buffer = xterm.buffer.active;
    const viewportY = buffer.viewportY ?? 0;
    const serialized = serializeTerminalRange(xterm, viewportY, xterm.rows);
    setOutput(serialized);
  });
});
```

**Process:**
1. PTY emits data event
2. Write data to xterm (ANSI parsing)
3. Serialize xterm buffer to tokens
4. Update React state
5. Trigger re-render

---

## Keybinds

### Terminal-Specific Keybinds

See [dev_Keybinds.md](./dev_Keybinds.md) for complete list.

**Key Bindings:**
- `Ctrl+Shift+Up` - Scroll up
- `Ctrl+Shift+Down` - Scroll down
- `Ctrl+C` - Interrupt (when terminal focused)
- `Ctrl+L` - Clear terminal

**Focus Requirements:**
- Terminal must be focused for keybinds to work
- Focus managed by `FocusManager`
- Input routing via `InputRoutingContext`

**Implementation:**
```typescript
useInput((input, key) => {
  if (!hasFocus && !isTerminalInput) return;

  if (isKey(input, key, activeKeybinds.terminal.scrollUp)) {
    setScrollOffset(prev => Math.min(prev + 1, maxScroll));
  } else if (isKey(input, key, activeKeybinds.terminal.scrollDown)) {
    setScrollOffset(prev => Math.max(prev - 1, 0));
  }
}, { isActive: activeRightPanel === 'terminal2' || isTerminalInput });
```

---

## Responsive Behavior

### Width Calculation

Terminal width adapts to UI layout:

```typescript
const width = useMemo(() => {
  if (!stdout) return 40;
  const effectiveColumns = stdout.columns - 6;  // Account for padding
  const widthFactor = uiState.sidePanelVisible ? 0.3 : 1.0;
  return Math.max(10, Math.floor(effectiveColumns * widthFactor));
}, [stdout, uiState.sidePanelVisible]);
```

**Factors:**
- Available terminal columns
- Side panel visibility
- Minimum width: 10 columns
- Padding: 6 columns reserved

### Height Calculation

```typescript
const chromeRows = 1;  // Header row
const visibleHeight = Math.max(1, height - chromeRows);
```

### Dynamic Resize

Terminal automatically resizes when:
- Window size changes
- Side panel opens/closes
- Layout changes

```typescript
useEffect(() => {
  resize(width, visibleHeight);
}, [width, visibleHeight, resize]);
```

**Resize Safety:**
- Minimum dimensions enforced
- Errors silently caught
- Both xterm and PTY resized together

---

## Performance Considerations

### Buffer Optimization

**Viewport-Based Rendering:**
- Only serialize visible lines
- Use `viewportY` to determine start position
- Avoid re-rendering entire buffer

**Serialization Range:**
```typescript
const buffer = xterm.buffer.active;
const viewportY = buffer.viewportY ?? 0;
const startIndex = Math.max(0, viewportY);
const serialized = serializeTerminalRange(xterm, startIndex, xterm.rows);
```

### Memory Management

**Scrollback Limit:**
- Default: 1000 lines
- Prevents unbounded memory growth
- Configurable per terminal instance

**Token Grouping:**
- Consecutive cells with same attributes grouped
- Reduces number of React components
- Improves rendering performance

**Cell Comparison:**
```typescript
cell.equals(other) {
  return (
    this.attributes === other.attributes &&
    this.fg === other.fg &&
    this.bg === other.bg &&
    this.fgColorMode === other.fgColorMode &&
    this.bgColorMode === other.bgColorMode
  );
}
```

---

## Debugging

### Logging

**Terminal Context Logging:**
```typescript
import { createLogger } from '../../../../core/src/utils/logger.js';
const logger = createLogger('TerminalContext');

logger.debug('PTY data len=%d, cols=%d, viewportY=%d, cursor=(%d,%d)', 
  data.length, xterm.cols, viewportY, cursorX, cursorY);
```

**Debug Information:**
- PTY data length
- Terminal dimensions (cols, rows)
- Viewport position (viewportY, baseY)
- Cursor position (cursorX, cursorY)
- Buffer state (totalLines, startIndex)
- Line previews (first/last line text)

### Common Issues

**Missing Input:**
- Check PTY write calls
- Verify raw input passthrough
- Inspect character codes: `char.charCodeAt(0)`
- Check logger output for sendRawInput

**Rendering Issues:**
- Check ANSI token structure
- Verify color conversion (RGB vs PALETTE)
- Inspect buffer serialization
- Check token grouping logic

**Focus Issues:**
- Check focus manager state
- Verify input routing
- Inspect keybind conflicts
- Check `hasFocus` and `isTerminalInput` flags

**Scrollback Issues:**
- Check scrollOffset calculation
- Verify maxScroll value
- Inspect visible lines slice
- Check auto-scroll reset

---

## File Locations

| File | Purpose |
|------|---------|
| `packages/cli/src/ui/contexts/TerminalContext.tsx` | Terminal 1 context provider |
| `packages/cli/src/ui/contexts/Terminal2Context.tsx` | Terminal 2 context provider |
| `packages/cli/src/ui/components/Terminal2.tsx` | Terminal display component |
| `packages/cli/src/ui/hooks/useTerminal2.ts` | Terminal 2 hook proxy |
| `packages/cli/src/ui/utils/terminalSerializer.ts` | ANSI buffer serialization |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `node-pty` | PTY process management |
| `@xterm/headless` | ANSI parsing and buffer management |
| `ink` | React terminal rendering |

---

## Future Enhancements

### Post-Alpha Tasks

**Terminal UI Improvements:**
- Collapsible terminal design (Option B)
- Auto-expand on errors
- Auto-collapse on success
- Split view for dual terminals

**Features:**
- Terminal tabs for multiple sessions
- Command palette integration
- Terminal search
- Copy/paste improvements
- Terminal themes

**Integration:**
- Better shell tool integration
- Command suggestions
- Error detection and highlighting
- Link detection and opening

---

## Best Practices

### Terminal Usage

1. **Always check `isRunning` before sending commands**
2. **Use `sendCommand()` for complete commands**
3. **Use `sendRawInput()` for interactive input**
4. **Call `resize()` when layout changes**
5. **Dispose properly on unmount**

### Error Handling

1. **Wrap PTY operations in try-catch**
2. **Handle process exit gracefully**
3. **Log errors for debugging**
4. **Provide user feedback on failures**

### Performance

1. **Limit scrollback buffer size**
2. **Use viewport-based rendering**
3. **Group ANSI tokens efficiently**
4. **Debounce resize operations**

---

## Troubleshooting

### Terminal Not Starting

**Check:**
- Shell executable exists (`powershell.exe` or `bash`)
- PTY spawn permissions
- Environment variables
- Platform detection (`os.platform()`)

**Solution:**
- Verify shell path
- Check process.env
- Test PTY spawn manually

### Output Not Displaying

**Check:**
- xterm.js buffer state
- Serialization errors
- React rendering
- Focus state

**Solution:**
- Check logger output
- Inspect buffer.active
- Verify token structure
- Test with simple commands

### Keybinds Not Working

**Check:**
- Focus manager state (`hasFocus`)
- Input routing configuration (`isTerminalInput`)
- Keybind conflicts
- Active panel state (`activeRightPanel`)

**Solution:**
- Verify focus with logger
- Check keybind definitions
- Test with different keys
- Inspect InputRoutingContext

### Performance Issues

**Check:**
- Scrollback buffer size
- Number of ANSI tokens
- Rendering frequency
- Memory usage

**Solution:**
- Reduce scrollback limit
- Optimize token grouping
- Debounce state updates
- Profile with React DevTools

---
