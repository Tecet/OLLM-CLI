# UI Settings Guide

Customize OLLM CLI's appearance, keybinds, and typography to match your preferences.

---

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.ollm/ui.yaml` | Custom theme, keybinds, typography |
| `~/.ollm/config.yaml` | Runtime settings (layout, GPU, status) |

---

## Customization: `~/.ollm/ui.yaml`

Create this file to override any default setting. Only specify what you want to change:

```yaml
# Custom theme colors
theme:
  name: 'my-theme'
  bg:
    primary: '#1a1a2e'
    secondary: '#16213e'
  text:
    accent: '#e94560'
  role:
    assistant: '#00fff5'

# Custom typography
typography:
  bullets: '▸'
  borders: 'double'
  spinner: 'arc'

# Custom keybinds
keybinds:
  togglePanel: 'ctrl+b'
  approve: 'a'
```

---

## Available Settings

### Theme Colors

| Key | Description | Default |
|-----|-------------|---------|
| `theme.bg.primary` | Main background | `#0d1117` |
| `theme.bg.secondary` | Panels background | `#161b22` |
| `theme.bg.tertiary` | Borders/highlights | `#21262d` |
| `theme.text.primary` | Main text | `#c9d1d9` |
| `theme.text.secondary` | Dim text | `#8b949e` |
| `theme.text.accent` | Links, highlights | `#58a6ff` |
| `theme.role.user` | User messages | `#58a6ff` |
| `theme.role.assistant` | Assistant messages | `#7ee787` |
| `theme.role.system` | System messages | `#a371f7` |
| `theme.role.tool` | Tool calls | `#f0883e` |
| `theme.status.success` | Success indicators | `#3fb950` |
| `theme.status.warning` | Warnings | `#d29922` |
| `theme.status.error` | Errors | `#f85149` |
| `theme.diff.added` | Added lines | `#2ea043` |
| `theme.diff.removed` | Removed lines | `#f85149` |

### Typography

| Key | Options | Default |
|-----|---------|---------|
| `typography.bullets` | `•`, `●`, `○`, `▪`, `-` | `•` |
| `typography.checkmark` | `✓`, `✔`, `☑`, `[x]` | `✓` |
| `typography.cross` | `✗`, `✘`, `☒` | `✗` |
| `typography.arrow` | `→`, `>`, `=>`, `▸` | `→` |
| `typography.spinner` | `dots`, `line`, `arc`, `bounce` | `dots` |
| `typography.borders` | `round`, `single`, `double`, `bold`, `ascii` | `round` |

### Keybinds

| Key | Default | Description |
|-----|---------|-------------|
| `keybinds.tabChat` | `ctrl+1` | Switch to Chat tab |
| `keybinds.tabTools` | `ctrl+2` | Switch to Tools tab |
| `keybinds.tabFiles` | `ctrl+3` | Switch to Files tab |
| `keybinds.tabSearch` | `ctrl+4` | Switch to Search tab |
| `keybinds.tabDocs` | `ctrl+5` | Switch to Docs tab |
| `keybinds.tabSettings` | `ctrl+6` | Switch to Settings tab |
| `keybinds.togglePanel` | `ctrl+p` | Toggle side panel |
| `keybinds.commandPalette` | `ctrl+k` | Open command palette |
| `keybinds.clearChat` | `ctrl+l` | Clear chat history |
| `keybinds.saveSession` | `ctrl+s` | Save session |
| `keybinds.cancel` | `escape` | Cancel current action |
| `keybinds.send` | `enter` | Send message |
| `keybinds.newline` | `shift+enter` | Insert newline |
| `keybinds.approve` | `y` | Approve review |
| `keybinds.reject` | `n` | Reject review |
| `keybinds.scrollDown` | `j` | Scroll down (Docs) |
| `keybinds.scrollUp` | `k` | Scroll up (Docs) |

---

## Terminal Settings (Not Controllable by OLLM)

The following must be changed in your **terminal emulator** settings:

| Setting | Where to Change |
|---------|-----------------|
| **Font family** | Terminal Preferences → Font (e.g., Fira Code, JetBrains Mono) |
| **Font size** | Terminal Preferences → Font Size |
| **Line height** | Terminal Preferences → Line Spacing |
| **Cursor style** | Terminal Preferences → Cursor |
| **Window opacity** | Terminal Preferences → Appearance |

### Recommended Fonts
- [Fira Code](https://github.com/tonsky/FiraCode) — Programming ligatures
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — Increased readability
- [Cascadia Code](https://github.com/microsoft/cascadia-code) — Windows Terminal default
- [MesloLGS NF](https://github.com/romkatv/powerlevel10k#fonts) — Powerline glyphs

---

## Example Themes

### Dracula-Inspired
```yaml
theme:
  name: 'dracula'
  bg:
    primary: '#282a36'
    secondary: '#44475a'
  text:
    primary: '#f8f8f2'
    accent: '#bd93f9'
  role:
    assistant: '#50fa7b'
```

### Nord-Inspired
```yaml
theme:
  name: 'nord'
  bg:
    primary: '#2e3440'
    secondary: '#3b4252'
  text:
    primary: '#eceff4'
    accent: '#88c0d0'
  role:
    assistant: '#a3be8c'
```

---

## Cross-References

- [Stage 06: CLI UI](.dev/stages/stage-06-cli-ui.md#unified-ui-settings) — Full specification
- [Configuration](docs/README.md) — General configuration guide
