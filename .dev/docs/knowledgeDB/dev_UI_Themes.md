# Themes System

**Last Updated:** January 26, 2026  
**Status:** ✅ Implemented  
**Related Documents:**

- [dev_UI_Front.md](./dev_UI_Front.md) - UI layout and components
- [dev_SlashCommands.md](./dev_SlashCommands.md) - Theme commands

---

## Overview

OLLM CLI includes a comprehensive theming system with 6 built-in color schemes. Themes define colors for backgrounds, text, roles, status states, borders, and diff highlighting. Users can switch themes via commands and settings are persisted locally.

---

## Theme Structure

### Theme Interface

```typescript
interface Theme {
  name: string;
  bg: {
    primary: string; // Main background
    secondary: string; // Secondary background
    tertiary: string; // Tertiary background
  };
  text: {
    primary: string; // Main text color
    secondary: string; // Secondary text color
    accent: string; // Accent/highlight color
  };
  role: {
    user: string; // User message color
    assistant: string; // Assistant message color
    system: string; // System message color
    tool: string; // Tool call color
  };
  status: {
    success: string; // Success state color
    warning: string; // Warning state color
    error: string; // Error state color
    info: string; // Info state color
  };
  border: {
    primary: string; // Primary border color
    secondary: string; // Secondary border color
    active: string; // Active border color
    style: string; // Border style (round, single, double)
  };
  diff: {
    added: string; // Added lines in diff
    removed: string; // Removed lines in diff
  };
}
```

---

## Built-in Themes

### 1. Solarized Dark (Default)

**Name:** `solarized-dark`  
**Description:** A precision theme designed to decrease eye strain

**Color Palette:**

```typescript
{
  name: "solarized-dark",
  bg: {
    primary: "#002b36",    // Deep blue-black
    secondary: "#073642",  // Dark blue-gray
    tertiary: "#586e75"    // Medium gray
  },
  text: {
    primary: "#839496",    // Light gray
    secondary: "#657b83",  // Medium gray
    accent: "#b58900"      // Yellow-orange
  },
  role: {
    user: "#268bd2",       // Blue
    assistant: "#2aa198",  // Cyan
    system: "#586e75",     // Gray
    tool: "#b58900"        // Yellow-orange
  },
  status: {
    success: "#859900",    // Green
    warning: "#cb4b16",    // Orange
    error: "#dc322f",      // Red
    info: "#268bd2"        // Blue
  },
  border: {
    primary: "#073642",    // Dark blue-gray
    secondary: "#268bd2",  // Blue
    active: "#268bd2",     // Blue
    style: "round"
  },
  diff: {
    added: "#859900",      // Green
    removed: "#dc322f"     // Red
  }
}
```

---

### 2. Neon Dark

**Name:** `neon-dark`  
**Description:** A balanced dark theme suitable for most terminals

**Color Palette:**

```typescript
{
  name: "neon-dark",
  bg: {
    primary: "#1e1e1e",    // Very dark gray
    secondary: "#252526",  // Dark gray
    tertiary: "#2d2d30"    // Medium dark gray
  },
  text: {
    primary: "#d4d4d4",    // Light gray
    secondary: "#858585",  // Medium gray
    accent: "#4ec9b0"      // Teal
  },
  role: {
    user: "#569cd6",       // Blue
    assistant: "#4ec9b0",  // Teal
    system: "#858585",     // Gray
    tool: "#dcdcaa"        // Yellow
  },
  status: {
    success: "#4ec9b0",    // Teal
    warning: "#ce9178",    // Orange
    error: "#f48771",      // Red
    info: "#569cd6"        // Blue
  },
  border: {
    primary: "#4ec9b0",    // Teal
    secondary: "#4ec9b0",  // Teal
    active: "#22d239ff",   // Bright green
    style: "round"
  },
  diff: {
    added: "#4ec9b0",      // Teal
    removed: "#f48771"     // Red
  }
}
```

---

### 3. Dracula Dark

**Name:** `dracula-dark`  
**Description:** A high-contrast theme based on the popular Dracula specification

**Color Palette:**

```typescript
{
  name: "dracula-dark",
  bg: {
    primary: "#282a36",    // Dark purple-gray
    secondary: "#44475a",  // Medium purple-gray
    tertiary: "#6272a4"    // Light purple-gray
  },
  text: {
    primary: "#f8f8f2",    // Off-white
    secondary: "#6272a4",  // Purple-gray
    accent: "#bd93f9"      // Purple
  },
  role: {
    user: "#8be9fd",       // Cyan
    assistant: "#bd93f9",  // Purple
    system: "#6272a4",     // Purple-gray
    tool: "#f1fa8c"        // Yellow
  },
  status: {
    success: "#50fa7b",    // Green
    warning: "#ffb86c",    // Orange
    error: "#ff5555",      // Red
    info: "#8be9fd"        // Cyan
  },
  border: {
    primary: "#44475a",    // Medium purple-gray
    secondary: "#bd93f9",  // Purple
    active: "#bd93f9",     // Purple
    style: "round"
  },
  diff: {
    added: "#50fa7b",      // Green
    removed: "#ff5555"     // Red
  }
}
```

---

### 4. Nord Dark

**Name:** `nord-dark`  
**Description:** An arctic, north-bluish color palette

**Color Palette:**

```typescript
{
  name: "nord-dark",
  bg: {
    primary: "#2e3440",    // Dark blue-gray
    secondary: "#3b4252",  // Medium blue-gray
    tertiary: "#434c5e"    // Light blue-gray
  },
  text: {
    primary: "#eceff4",    // Off-white
    secondary: "#d8dee9",  // Light gray
    accent: "#88c0d0"      // Cyan
  },
  role: {
    user: "#81a1c1",       // Blue
    assistant: "#88c0d0",  // Cyan
    system: "#4c566a",     // Gray
    tool: "#ebcb8b"        // Yellow
  },
  status: {
    success: "#a3be8c",    // Green
    warning: "#d08770",    // Orange
    error: "#bf616a",      // Red
    info: "#5e81ac"        // Blue
  },
  border: {
    primary: "#3b4252",    // Medium blue-gray
    secondary: "#88c0d0",  // Cyan
    active: "#88c0d0",     // Cyan
    style: "round"
  },
  diff: {
    added: "#a3be8c",      // Green
    removed: "#bf616a"     // Red
  }
}
```

---

### 5. Monokai Dark

**Name:** `monokai-dark`  
**Description:** A vibrant, high-contrast theme popular in Sublime Text

**Color Palette:**

```typescript
{
  name: "monokai-dark",
  bg: {
    primary: "#272822",    // Dark olive-gray
    secondary: "#3e3d32",  // Medium olive-gray
    tertiary: "#49483e"    // Light olive-gray
  },
  text: {
    primary: "#f8f8f2",    // Off-white
    secondary: "#75715e",  // Brown-gray
    accent: "#fd971f"      // Orange
  },
  role: {
    user: "#66d9ef",       // Cyan
    assistant: "#a6e22e",  // Green
    system: "#75715e",     // Brown-gray
    tool: "#e6db74"        // Yellow
  },
  status: {
    success: "#a6e22e",    // Green
    warning: "#fd971f",    // Orange
    error: "#f92672",      // Pink
    info: "#66d9ef"        // Cyan
  },
  border: {
    primary: "#1e1437ff",  // Dark purple
    secondary: "#3a3ac1ff",// Blue
    active: "#fd971f",     // Orange
    style: "round"
  },
  diff: {
    added: "#a6e22e",      // Green
    removed: "#f92672"     // Pink
  }
}
```

---

### 6. Solarized Dark 2

**Name:** `solarized-dark-2`  
**Description:** Alternative Solarized Dark variant (identical to solarized-dark)

**Note:** This is a duplicate of `solarized-dark` with the same color palette.

---

## Theme Configuration

### Default Theme

**Location:** `packages/cli/src/config/defaults.ts`

```typescript
export const defaultConfig: Config = {
  ui: {
    theme: 'solarized-dark', // Default theme
    // ... other UI settings
  },
  // ... other config
};
```

**Default:** `solarized-dark`

---

### User Theme Settings

**Storage Location:** `~/.ollm/settings.json`

**Structure:**

```json
{
  "ui": {
    "theme": "solarized-dark"
  },
  "llm": { ... },
  "tools": { ... }
}
```

**Path Resolution:**

- Windows: `C:\Users\<username>\.ollm\settings.json`
- macOS: `/Users/<username>/.ollm/settings.json`
- Linux: `/home/<username>/.ollm/settings.json`

**Persistence:**

- Theme selection is saved automatically when changed
- Settings persist across sessions
- Settings survive application updates

---

## Theme Management

### Theme Manager

**Location:** `packages/cli/src/ui/services/themeManager.ts`

**Responsibilities:**

- Load themes from `themes.ts`
- Validate theme names
- Provide theme instances
- Singleton pattern for global access

**API:**

```typescript
class ThemeManager {
  loadTheme(name: string): Theme;
  getAvailableThemes(): string[];
  validateTheme(name: string): boolean;
}

// Singleton access
const themeManager = getThemeManager();
```

---

### Settings Service

**Location:** `packages/cli/src/config/settingsService.ts`

**Responsibilities:**

- Load user settings from `~/.ollm/settings.json`
- Save user settings
- Provide theme getter/setter
- Notify listeners on changes

**API:**

```typescript
class SettingsService {
  getTheme(): string;
  setTheme(theme: string): void;
  getSettings(): UserSettings;
  // ... other methods
}

// Singleton access
const settings = SettingsService.getInstance();
```

---

## Theme Commands

### /theme list

**Description:** List all available themes

**Usage:**

```bash
/theme list
```

**Output:**

```
Available themes:
  • solarized-dark (default)
  • neon-dark
  • dracula-dark
  • nord-dark
  • monokai-dark
  • solarized-dark-2
```

---

### /theme use <name>

**Description:** Switch to a theme permanently

**Usage:**

```bash
/theme use dracula-dark
```

**Behavior:**

1. Validates theme name
2. Loads theme from ThemeManager
3. Applies theme to UI
4. Saves selection to `~/.ollm/settings.json`

**Output:**

```
✓ Theme changed to: dracula-dark
```

---

### /theme preview <name>

**Description:** Preview a theme temporarily (not saved)

**Usage:**

```bash
/theme preview nord-dark
```

**Behavior:**

1. Validates theme name
2. Loads theme from ThemeManager
3. Applies theme to UI
4. Does NOT save to settings

**Output:**

```
✓ Previewing theme: nord-dark
(Use /theme use nord-dark to save permanently)
```

---

## Theme Application Flow

### Startup Flow

```
App.tsx initialization
    ↓
Load theme from SettingsService.getTheme()
    ↓
Fallback to config.ui.theme (solarized-dark)
    ↓
Load theme from ThemeManager
    ↓
Apply to UIContext
    ↓
Render UI with theme
```

### Runtime Change Flow

```
User executes /theme use <name>
    ↓
Validate theme name
    ↓
Load theme from ThemeManager
    ↓
Call setTheme callback (updates UIContext)
    ↓
SettingsService.setTheme(name)
    ↓
Save to ~/.ollm/settings.json
    ↓
UI re-renders with new theme
```

---

## Theme Usage in Components

### Accessing Theme

**Via UIContext:**

```typescript
import { useUI } from '../../features/context/UIContext.js';

function MyComponent() {
  const { state: uiState } = useUI();
  const { theme } = uiState;

  return (
    <Text color={theme.text.primary}>
      Hello World
    </Text>
  );
}
```

**Via Props:**

```typescript
interface MyComponentProps {
  theme: Theme;
}

function MyComponent({ theme }: MyComponentProps) {
  return (
    <Box borderColor={theme.border.active}>
      <Text color={theme.text.accent}>
        Highlighted Text
      </Text>
    </Box>
  );
}
```

---

### Common Theme Patterns

**Text Colors:**

```typescript
// Primary text (main content)
<Text color={theme.text.primary}>Content</Text>

// Secondary text (less important)
<Text color={theme.text.secondary}>Details</Text>

// Accent text (highlights, emphasis)
<Text color={theme.text.accent}>Important!</Text>
```

**Role Colors:**

```typescript
// User messages
<Text color={theme.role.user}>User: Hello</Text>

// Assistant messages
<Text color={theme.role.assistant}>Assistant: Hi!</Text>

// System messages
<Text color={theme.role.system}>System: Ready</Text>

// Tool calls
<Text color={theme.role.tool}>Tool: execute</Text>
```

**Status Colors:**

```typescript
// Success state
<Text color={theme.status.success}>✓ Success</Text>

// Warning state
<Text color={theme.status.warning}>⚠ Warning</Text>

// Error state
<Text color={theme.status.error}>✗ Error</Text>

// Info state
<Text color={theme.status.info}>ℹ Info</Text>
```

**Borders:**

```typescript
// Primary border
<Box borderColor={theme.border.primary} borderStyle={theme.border.style}>
  Content
</Box>

// Active border (focused elements)
<Box borderColor={theme.border.active} borderStyle={theme.border.style}>
  Focused
</Box>
```

**Diff Colors:**

```typescript
// Added lines
<Text color={theme.diff.added}>+ Added line</Text>

// Removed lines
<Text color={theme.diff.removed}>- Removed line</Text>
```

---

## File Locations

| File                                           | Purpose                          |
| ---------------------------------------------- | -------------------------------- |
| `packages/cli/src/config/themes.ts`            | Theme definitions (all 6 themes) |
| `packages/cli/src/config/defaults.ts`          | Default theme setting            |
| `packages/cli/src/config/settingsService.ts`   | User settings persistence        |
| `packages/cli/src/ui/services/themeManager.ts` | Theme loading and validation     |
| `packages/cli/src/commands/themeCommands.ts`   | Theme slash commands             |
| `~/.ollm/settings.json`                        | User theme selection (persisted) |

---

## Adding New Themes

### Step 1: Define Theme

Add to `packages/cli/src/config/themes.ts`:

```typescript
export const themesData: Record<string, Theme> = {
  // ... existing themes

  'my-custom-theme': {
    name: 'my-custom-theme',
    bg: {
      primary: '#000000',
      secondary: '#111111',
      tertiary: '#222222',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
      accent: '#00ff00',
    },
    role: {
      user: '#0000ff',
      assistant: '#00ff00',
      system: '#888888',
      tool: '#ffff00',
    },
    status: {
      success: '#00ff00',
      warning: '#ff8800',
      error: '#ff0000',
      info: '#0088ff',
    },
    border: {
      primary: '#444444',
      secondary: '#00ff00',
      active: '#00ff00',
      style: 'round',
    },
    diff: {
      added: '#00ff00',
      removed: '#ff0000',
    },
  },
};
```

### Step 2: Test Theme

```bash
# Preview theme
/theme preview my-custom-theme

# Use theme permanently
/theme use my-custom-theme
```

### Step 3: Verify Persistence

1. Restart application
2. Check theme is still applied
3. Verify `~/.ollm/settings.json` contains theme name

---

## Best Practices

### For Theme Designers

1. **Maintain Contrast**
   - Ensure text is readable on backgrounds
   - Test with different terminal emulators
   - Consider accessibility (WCAG guidelines)

2. **Consistent Color Roles**
   - Use consistent colors for similar elements
   - Success = green, Error = red, Warning = orange
   - Info = blue (convention)

3. **Test All States**
   - Test with all message types (user, assistant, system, tool)
   - Test with all status states (success, warning, error, info)
   - Test borders and diffs

4. **Border Styles**
   - Use "round" for modern look
   - Use "single" for classic look
   - Use "double" for emphasis

### For Developers

1. **Always Use Theme Colors**
   - Never hardcode colors in components
   - Always reference `theme.*` properties
   - Pass theme via props or context

2. **Respect Theme Structure**
   - Use appropriate color categories
   - Don't mix role colors with status colors
   - Use accent for highlights, not primary

3. **Test Theme Changes**
   - Test with all built-in themes
   - Verify colors are applied correctly
   - Check for contrast issues

---

## Troubleshooting

### Theme Not Applying

**Check:**

1. Theme name is correct (case-sensitive)
2. Theme exists in `themes.ts`
3. Settings file is writable (`~/.ollm/settings.json`)
4. No JSON syntax errors in settings file

**Solution:**

```bash
# List available themes
/theme list

# Use correct theme name
/theme use solarized-dark
```

---

### Theme Not Persisting

**Check:**

1. Settings directory exists (`~/.ollm/`)
2. Settings file is writable
3. No permission errors

**Solution:**

```bash
# Check settings file
cat ~/.ollm/settings.json

# Verify theme is saved
# Should show: {"ui":{"theme":"theme-name"},...}
```

---

### Colors Look Wrong

**Check:**

1. Terminal supports 256 colors
2. Terminal color scheme not overriding
3. Theme definition is correct

**Solution:**

- Use a modern terminal emulator (iTerm2, Windows Terminal, Alacritty)
- Disable terminal color scheme overrides
- Test with different themes

---

## Future Enhancements

### Planned Features

1. **Custom Theme Support**
   - User-defined themes in `~/.ollm/themes/`
   - Theme import/export
   - Theme editor UI

2. **Theme Variants**
   - Light themes
   - High contrast themes
   - Colorblind-friendly themes

3. **Dynamic Theming**
   - Time-based theme switching
   - Context-aware themes
   - Adaptive contrast

4. **Theme Marketplace**
   - Community themes
   - Theme ratings
   - Theme preview gallery

---

## References

**Related Documentation:**

- [dev_UI_Front.md](./dev_UI_Front.md) - UI components using themes
- [dev_SlashCommands.md](./dev_SlashCommands.md) - Theme commands

**External Resources:**

- [Solarized Color Scheme](https://ethanschoonover.com/solarized/)
- [Dracula Theme](https://draculatheme.com/)
- [Nord Theme](https://www.nordtheme.com/)
- [Monokai Theme](https://monokai.pro/)

---
