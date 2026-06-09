# Tuimux Configuration Reference

This document provides comprehensive documentation for all tuimux configuration options.

## Table of Contents

- [Configuration File Location](#configuration-file-location)
- [Command-Line Options](#command-line-options)
- [Configuration Schema](#configuration-schema)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Theme Configuration](#theme-configuration)
- [App Configuration](#app-configuration)
- [Session Configuration](#session-configuration)
- [Path Placeholders](#path-placeholders)
- [Complete Example](#complete-example)

---

## Configuration File Location

Tuimux searches for configuration in this order:

1. **Local**: `./tuimux.yaml` (project-specific)
2. **XDG Config**: `~/.config/tuimux/tuimux.yaml`
3. **Defaults**: Built-in defaults if no file found

On first run without a config file and no apps configured, tuimux shows a welcome + multi-select app-preset wizard. Complete or skip it to get started. The wizard can be re-run at any time from the command palette → "Run setup wizard".

---

## Command-Line Options

Run `tuimux --help` to see all options.

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show help and exit |
| `-v`, `--version` | Show the version and exit |
| `-d`, `--debug` | Enable debug logging (written to the state dir; equivalent to `TUIMUX_DEBUG=1`) |
| `-a`, `--add` | Launch straight into the Add-App wizard |
| `--layout <tabs\|panes>` | Override the layout mode for this launch |
| `--shutdown` | Shut down the background session server and clear the persisted session |

---

## Configuration Schema

```yaml
version: 2                      # Config schema version (required)
theme: { ... }                  # Color theme
tab_width: 20                   # Tab sidebar width
layout: "tabs"                  # tabs or panes layout
sidebar_position: "left"        # left | right | top | bottom (tab/window list placement; rotate at runtime with Shift+B)
focus_on_launch: true           # Jump focus into a pane when its app launches (default: true)
onboarding_completed: false     # Set to true once the first-run wizard is completed or skipped; prevents it re-appearing
apps: [ ... ]                   # Application entries
session: { ... }                # Session persistence
```

When `focus_on_launch` is `true` (the default), launching an app automatically
switches into TERMINAL mode so you can type immediately. Set it to `false` to stay
in TABS/PANES focus after launching.

Runtime override: `tuimux --layout panes`.

---

## Keyboard Shortcuts

Tuimux uses a simple focus-toggle model with fixed keybindings. There are no customizable keybinds.

### Focus Modes

**TABS Mode** - For navigation and app management:
- Single keystrokes control the UI
- StatusBar shows available shortcuts

**TERMINAL Mode** - For interacting with apps:
- All keyboard input passes through to the PTY
- Only `Ctrl+A` is intercepted for mode switching

In `layout: panes`, the non-terminal focus mode is **PANES** and provides window/pane commands.

### Mode Toggle

| Key | Action |
|-----|--------|
| `Ctrl+A` | Toggle between TABS/PANES and TERMINAL mode |
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
| `q` | Detach (leave apps running) |
| `Q` | Quit and stop all apps |
| `?` | Show help cheatsheet |
| `Shift+L` | Switch layout (toggle tabs/panes) |
| `Shift+B` | Rotate sidebar position (left/top/right/bottom) |

### Command Palette Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Start or switch to selected app |
| `x` | Stop selected app |
| `Ctrl+E` | Edit selected app |
| `Ctrl+R` | Remove selected app and stop any running instances |
| `Esc` | Close command palette |

The command palette also exposes global commands (fuzzy-searchable):

- **Switch layout** — toggle between tabs and panes layout
- **Rotate sidebar position** — cycle left → top → right → bottom
- **Run setup wizard** — re-run the first-run onboarding wizard
- **Themes…** — browse and apply built-in themes live

### PANES Mode Shortcuts (layout: panes)

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
| `t` | Add app |
| `q` | Detach (leave apps running) |
| `Q` | Quit and stop all apps |
| `?` | Show help cheatsheet |
| `Shift+L` | Switch layout (toggle panes/tabs) |
| `Shift+B` | Rotate sidebar position (left/top/right/bottom) |
| `Ctrl+A` | Switch to TERMINAL mode |

### TERMINAL Mode Shortcuts

In terminal mode, all keys pass through to the application except:

| Key | Action |
|-----|--------|
| `Ctrl+A` | Switch to TABS mode |
| `Ctrl+A` `Ctrl+A` | Send literal `Ctrl+A` to terminal |

`Ctrl+C` always passes through to the terminal (never intercepted by tuimux).

---

## Layout Modes

Tuimux supports two layout modes, selectable at runtime with `Shift+L` or in config:

| Value | Description |
|-------|-------------|
| `tabs` | Vertical tab sidebar on the left; single active terminal fills the right panel. |
| `panes` | Window list sidebar on the left; windows can be split into multiple panes. |

**Legacy aliases**: the old values `classic` (maps to `tabs`) and `zellij` (maps to `panes`) are still accepted in config files and on the command line for backwards compatibility. New configs should use `tabs`/`panes`.

In **panes** mode a **Windows** sidebar replaces the tab list on the left edge. Each entry in the sidebar shows the window index and title; the active/selected window is highlighted. A `+ New` footer row opens the add-window flow. All pane management keys (`v`, `s`, `x`, `p`, etc.) are available while in PANES focus.

---

## Theme Configuration

Tuimux uses a 5-color palette. The default built-in theme is **Graphite**:

```yaml
theme:
  primary: "#a0a8b8"      # Silver-blue - active selections, highlights
  background: "#1c1e24"   # Deep charcoal - main background
  foreground: "#cdd1db"   # Cool light gray - primary text
  accent: "#7eb8c9"       # Muted cyan - active indicators, checkboxes
  muted: "#4a4f5c"        # Dark gray - inactive elements, hints
```

### Color Properties

| Property | Purpose | Graphite Default |
|----------|---------|------------------|
| `primary` | Active selections, focused items, highlights | `#a0a8b8` (silver-blue) |
| `background` | Main UI background | `#1c1e24` (charcoal) |
| `foreground` | Primary text color | `#cdd1db` (light gray) |
| `accent` | Active indicators, selected checkboxes, success | `#7eb8c9` (muted cyan) |
| `muted` | Inactive tabs, secondary text, hints | `#4a4f5c` (dark gray) |

### Built-in Themes

Tuimux ships with 9 built-in themes selectable live via the command palette → "Themes…":

1. **Graphite** (default)
2. Night Owl
3. Dracula
4. Nord
5. Solarized Dark
6. One Dark
7. Catppuccin Mocha
8. Gruvbox Dark
9. Tokyo Night

### Custom Theme

Override any token in `tuimux.yaml` to define a custom theme. The full UI palette is derived at runtime from these 5 values:

**Night Owl:**
```yaml
theme:
  primary: "#82aaff"
  background: "#011627"
  foreground: "#d6deeb"
  accent: "#7fdbca"
  muted: "#637777"
```

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
  file: "~/.local/state/tuimux/session.yaml"
```

### Session Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `persist` | boolean | `false` | Remember running apps between restarts |
| `file` | string | XDG state dir | Custom session file path |

`tuimux --shutdown` clears the persisted session snapshot so only `autostart: true` apps relaunch.

When `persist: true`, tuimux saves:
- Which apps were running
- Which tab was active
- App process state

When `layout: panes`, it also stores window/pane layouts and active pane.

---

## Path Placeholders

These placeholders can be used in `cwd`, `args`, and `session.file`:

| Placeholder | Expands To | Example |
|-------------|------------|---------|
| `~` | User home directory | `/home/username` |
| `<CONFIG_DIR>` | Directory containing the active config file | `~/.config/tuimux` |
| `<STATE_DIR>` | XDG state directory | `~/.local/state/tuimux` |

### Examples

```yaml
apps:
  - name: "Shell"
    cwd: "~"                        # /home/user

  - name: "Project"
    cwd: "<CONFIG_DIR>"             # ~/.config/tuimux

session:
  file: "<STATE_DIR>/session.yaml"  # ~/.local/state/tuimux/session.yaml
```

---

## Complete Example

```yaml
# tuimux configuration
# ~/.config/tuimux/tuimux.yaml

version: 2

# Graphite theme (default — omit this block to use the default)
theme:
  primary: "#a0a8b8"
  background: "#1c1e24"
  foreground: "#cdd1db"
  accent: "#7eb8c9"
  muted: "#4a4f5c"

# Tab sidebar width
tab_width: 20

# Layout mode: "tabs" (sidebar) or "panes" (window list + split panes)
# Legacy values "classic" and "zellij" are still accepted as aliases.
layout: "tabs"

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

## Debug / Environment Variables

| Variable | Description |
|----------|-------------|
| `TUIMUX_DEBUG=1` | Enable verbose debug logging to stderr |
| `TUIMUX_DEBUG_LOG=<path>` | Write debug log to the specified file instead of stderr |

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

If running tmux inside tuimux with the `Ctrl+A` prefix:
- Double-tap `Ctrl+A` to send it to tmux
- Or configure tmux to use a different prefix (e.g., `Ctrl+B`)

### Keys not working in Terminal Mode

In Terminal Mode, all keys except `Ctrl+A` pass directly to the terminal app. Press `Ctrl+A` to switch to TABS mode for navigation.

### Migrating from tuidoscope

If you previously used tuidoscope, tuimux will automatically migrate your config and state files from `~/.config/tuidoscope/` and `~/.local/state/tuidoscope/` on first run. No manual steps required. The old directories are left untouched.
