# Tuidoscope Configuration Reference

This document provides comprehensive documentation for all tuidoscope configuration options.

## Table of Contents

- [Configuration File Location](#configuration-file-location)
- [Configuration Schema](#configuration-schema)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Theme Configuration](#theme-configuration)
- [App Configuration](#app-configuration)
- [Session Configuration](#session-configuration)
- [Path Placeholders](#path-placeholders)
- [Complete Example](#complete-example)

---

## Configuration File Location

Tuidoscope searches for configuration in this order:

1. **Local**: `./tuidoscope.yaml` (project-specific)
2. **XDG Config**: `~/.config/tuidoscope/tuidoscope.yaml`
3. **Defaults**: Built-in defaults if no file found

On first run without a config file, tuidoscope starts with an empty app list. Press `t` to add apps.

---

## Configuration Schema

```yaml
version: 2                    # Config schema version (required)
theme: { ... }                # Color theme
tab_width: 20                 # Tab sidebar width
layout: "classic"            # classic or zellij layout
apps: [ ... ]                 # Application entries
session: { ... }              # Session persistence
```

Runtime override: `tuidoscope --layout zellij`.

---

## Keyboard Shortcuts

Tuidoscope uses a simple focus-toggle model with fixed keybindings. There are no customizable keybinds.

### Focus Modes

**TABS Mode** - For navigation and app management:
- Single keystrokes control the UI
- StatusBar shows available shortcuts

**TERMINAL Mode** - For interacting with apps:
- All keyboard input passes through to the PTY
- Only `Ctrl+A` is intercepted for mode switching

In `layout: zellij`, the non-terminal focus mode is **MANAGER** and provides window/pane commands.

### Mode Toggle

| Key | Action |
|-----|--------|
| `Ctrl+A` | Toggle between TABS and TERMINAL mode |
| `Ctrl+A` `Ctrl+A` | In terminal mode, double-tap sends `Ctrl+A` to the PTY |

The double-tap is useful for:
- Applications that use `Ctrl+A` (like readline's beginning-of-line)
- Nested tmux sessions using the same prefix

### TABS Mode Shortcuts

| Key | Action |
|-----|--------|
| `j` / `Down` | Navigate to next tab |
| `k` / `Up` | Navigate to previous tab |
| `gg` | Jump to first tab (double-press `g`) |
| `G` | Jump to last tab (Shift+G) |
| `Enter` | Select/focus the current tab |
| `Space` | Open command palette |
| `t` | Open Add Tab modal |
| `e` | Edit selected app |
| `x` | Stop selected running app |
| `r` | Restart selected running app |
| `K` | Kill all running apps (Shift+K) |
| `q` | Disconnect (leave apps running) |
| `Q` | Quit and stop all apps |

### Command Palette Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Start or switch to selected app |
| `x` | Stop selected app |
| `Ctrl+E` | Edit selected app |
| `Ctrl+R` | Remove selected app and stop any running instances |
| `Esc` | Close command palette |

### MANAGER Mode Shortcuts (layout: zellij)

| Key | Action |
|-----|--------|
| `v` | Split active pane vertically |
| `s` | Split active pane horizontally |
| `n` | New window (clone active pane entry) |
| `x` | Close active pane |
| `w` | Close active window |
| `[` | Previous window |
| `]` | Next window |
| `p` | Cycle panes |
| `Space` | Command palette |
| `Ctrl+A` | Switch to TERMINAL mode |

### TERMINAL Mode Shortcuts

In terminal mode, all keys pass through to the application except:

| Key | Action |
|-----|--------|
| `Ctrl+A` | Switch to TABS mode |
| `Ctrl+A` `Ctrl+A` | Send literal `Ctrl+A` to terminal |

`Ctrl+C` always passes through to the terminal (never intercepted by tuidoscope).

---

## Theme Configuration

Tuidoscope uses a 5-color palette. Default is Night Owl:

```yaml
theme:
  primary: "#82aaff"      # Blue - active selections, highlights
  background: "#011627"   # Deep dark blue - main background
  foreground: "#d6deeb"   # Light gray-blue - primary text
  accent: "#7fdbca"       # Cyan/teal - active indicators, checkboxes
  muted: "#637777"        # Gray-blue - inactive elements, hints
```

### Color Properties

| Property | Purpose | Night Owl Default |
|----------|---------|-------------------|
| `primary` | Active selections, focused items, highlights | `#82aaff` (blue) |
| `background` | Main UI background | `#011627` (dark blue) |
| `foreground` | Primary text color | `#d6deeb` (light gray) |
| `accent` | Active indicators, selected checkboxes, success | `#7fdbca` (cyan) |
| `muted` | Inactive tabs, secondary text, hints | `#637777` (gray) |

### Alternative Themes

**Tokyo Night:**
```yaml
theme:
  primary: "#7aa2f7"
  background: "#1a1b26"
  foreground: "#c0caf5"
  accent: "#bb9af7"
  muted: "#565f89"
```

**Dracula:**
```yaml
theme:
  primary: "#bd93f9"
  background: "#282a36"
  foreground: "#f8f8f2"
  accent: "#50fa7b"
  muted: "#6272a4"
```

**Nord:**
```yaml
theme:
  primary: "#88c0d0"
  background: "#2e3440"
  foreground: "#eceff4"
  accent: "#a3be8c"
  muted: "#4c566a"
```

---

## App Configuration

Apps are defined as an array of entries:

```yaml
apps:
  - name: "Shell"
    command: "zsh"
    args: ""
    cwd: "~"
    autostart: true
    restart_on_exit: false
    env:
      TERM: "xterm-256color"
```

### App Entry Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | auto | Stable app identifier (auto-generated if omitted) |
| `name` | string | required | Display name in tab list |
| `command` | string | required | Executable to run |
| `args` | string | `""` | Arguments passed to command |
| `cwd` | string | `"~"` | Working directory (supports placeholders) |
| `autostart` | boolean | `false` | Start automatically on launch |
| `restart_on_exit` | boolean | `false` | Respawn if process exits |
| `env` | object | `{}` | Environment variables |

### Working Directory Examples

```yaml
apps:
  # Home directory
  - name: "Shell"
    command: "zsh"
    cwd: "~"

  # Relative to config file location
  - name: "lazygit"
    command: "lazygit"
    cwd: "<CONFIG_DIR>"

  # Absolute path
  - name: "Project Shell"
    command: "zsh"
    cwd: "/home/user/projects/myapp"
```

### Environment Variables

```yaml
apps:
  - name: "Shell"
    command: "zsh"
    env:
      TERM: "xterm-256color"
      EDITOR: "nvim"
      MY_VAR: "custom_value"
```

### Common App Configurations

**AI Coding Agents:**
```yaml
apps:
  - name: "Claude"
    command: "claude"
    cwd: "<CONFIG_DIR>"

  - name: "OpenCode"
    command: "opencode"
    cwd: "<CONFIG_DIR>"

  - name: "Aider"
    command: "aider"
    cwd: "<CONFIG_DIR>"
```

**System Monitors:**
```yaml
apps:
  - name: "htop"
    command: "htop"
    restart_on_exit: true  # Respawn if quit accidentally

  - name: "btop"
    command: "btop"

  - name: "glances"
    command: "glances"
```

**Git Tools:**
```yaml
apps:
  - name: "lazygit"
    command: "lazygit"
    cwd: "<CONFIG_DIR>"

  - name: "tig"
    command: "tig"
    cwd: "<CONFIG_DIR>"
```

**File Managers:**
```yaml
apps:
  - name: "ranger"
    command: "ranger"
    cwd: "~"

  - name: "yazi"
    command: "yazi"
    cwd: "~"

  - name: "lf"
    command: "lf"
    cwd: "~"
```

---

## Session Configuration

```yaml
session:
  persist: false
  file: "~/.local/state/tuidoscope/session.yaml"
```

### Session Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `persist` | boolean | `false` | Remember running apps between restarts |
| `file` | string | XDG state dir | Custom session file path |

`tuidoscope --shutdown` clears the persisted session snapshot so only `autostart: true` apps relaunch.

When `persist: true`, tuidoscope saves:
- Which apps were running
- Which tab was active
- App process state

When `layout: zellij`, it also stores window/pane layouts and active pane.

---

## Path Placeholders

These placeholders can be used in `cwd`, `args`, and `session.file`:

| Placeholder | Expands To | Example |
|-------------|------------|---------|
| `~` | User home directory | `/home/username` |
| `<CONFIG_DIR>` | Directory containing the active config file | `~/.config/tuidoscope` |
| `<STATE_DIR>` | XDG state directory | `~/.local/state/tuidoscope` |

### Examples

```yaml
apps:
  - name: "Shell"
    cwd: "~"                        # /home/user

  - name: "Project"
    cwd: "<CONFIG_DIR>"             # ~/.config/tuidoscope

session:
  file: "<STATE_DIR>/session.yaml"  # ~/.local/state/tuidoscope/session.yaml
```

---

## Complete Example

```yaml
# tuidoscope configuration
# ~/.config/tuidoscope/tuidoscope.yaml

version: 2

# Night Owl theme
theme:
  primary: "#82aaff"
  background: "#011627"
  foreground: "#d6deeb"
  accent: "#7fdbca"
  muted: "#637777"

# Tab sidebar width
tab_width: 20

# Layout mode (classic sidebar or zellij-style panes)
layout: "classic"

# Applications
apps:
  - name: "Shell"
    command: "zsh"
    cwd: "~"
    autostart: true
    env:
      TERM: "xterm-256color"

  - name: "htop"
    command: "htop"
    cwd: "~"

  - name: "lazygit"
    command: "lazygit"
    cwd: "<CONFIG_DIR>"

  - name: "Claude"
    command: "claude"
    cwd: "<CONFIG_DIR>"

# Session
session:
  persist: false
  file: "<STATE_DIR>/session.yaml"
```

---

## Troubleshooting

### Ctrl+A conflicts with terminal emulator

Some terminals (like GNOME Terminal) use `Ctrl+A` for select-all. Solutions:
1. Disable the conflicting shortcut in your terminal emulator settings
2. Use an alternative terminal emulator

### Ctrl+A conflicts with applications

Applications that use `Ctrl+A` (like bash/readline for beginning-of-line):
- Double-tap `Ctrl+A` to send the literal `Ctrl+A` to the terminal
- The second tap must be within 500ms of the first

### Ctrl+A conflicts with nested tmux

If running tmux inside tuidoscope with the `Ctrl+A` prefix:
- Double-tap `Ctrl+A` to send it to tmux
- Or configure tmux to use a different prefix (e.g., `Ctrl+B`)

### Keys not working in Terminal Mode

In Terminal Mode, all keys except `Ctrl+A` pass directly to the terminal app. Press `Ctrl+A` to switch to TABS mode for navigation.
