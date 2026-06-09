# Configuration

Tuimux is configured using a YAML file named `tuimux.yaml`. 

## Configuration File Location

Tuimux searches for the configuration file in the following order:

1.  **Local Directory**: `./tuimux.yaml` (useful for project-specific TUI setups).
2.  **XDG Config Home**: `~/.config/tuimux/tuimux.yaml` (default on most Linux/macOS systems).

## YAML Structure

The configuration file follows a structured YAML format. Below is a full example with default values and explanations.

```yaml
version: 2

# Theme — pick a built-in name or supply a custom 5-token palette.
# Built-in themes: Graphite (default), Night Owl, Dracula, Nord,
#   Solarized Dark, One Dark, Catppuccin Mocha, Gruvbox Dark, Tokyo Night
# To use a built-in, omit the theme block entirely (or set it by name via
# the command palette → "Themes…"). To override with a custom palette:
theme:
  primary: "#6e7681"    # active selections, highlights
  background: "#0d1117" # main UI background
  foreground: "#c9d1d9" # primary text
  accent: "#58a6ff"     # active indicators
  muted: "#484f58"      # inactive tabs, secondary text

# UI settings
tab_width: 20
layout: "tabs"           # tabs | panes  (legacy: classic→tabs, zellij→panes)
sidebar_position: "left" # left | right | top | bottom  (Shift+B to cycle)

# Onboarding — set automatically; re-run wizard via command palette
onboarding_completed: false

# Session management
session:
  persist: false
  # file: "<STATE_DIR>/session.yaml" # Optional custom session file

# Application List
apps:
  - name: "Shell"
    command: "bash"
    cwd: "~"
    autostart: true
    restart_on_exit: false
    env:
      TERM: "xterm-256color"

  - name: "System Monitor"
    command: "htop"
    autostart: false
    restart_on_exit: true
```

## Section Details

### `version`
The schema version for the configuration file. Current version is `2`.

### `theme`

The default theme is **Graphite**. tuimux ships with 9 built-in themes:

| Theme | Description |
|-------|-------------|
| **Graphite** (default) | Dark graphite greys with a blue accent |
| Night Owl | Deep dark blue with cyan/teal accents |
| Dracula | Dark purple with pink and cyan |
| Nord | Arctic blue-grey palette |
| Solarized Dark | Classic Solarized dark palette |
| One Dark | Atom-inspired dark theme |
| Catppuccin Mocha | Warm dark pastel palette |
| Gruvbox Dark | Retro groove warm darks |
| Tokyo Night | Deep blue Tokyo night palette |

Switch themes live via the command palette (`Space`) → "Themes…". No restart required.

#### Custom Theme

To define a custom theme, provide a 5-token palette in `tuimux.yaml`. The full UI colour palette is derived from these five tokens at runtime:

| Property | Description |
|----------|-------------|
| `primary` | Active selections, highlights |
| `background` | Main UI background |
| `foreground` | Primary text colour |
| `accent` | Active indicators, checkboxes |
| `muted` | Inactive tabs, secondary text |

Example (Graphite defaults):

```yaml
theme:
  primary: "#6e7681"
  background: "#0d1117"
  foreground: "#c9d1d9"
  accent: "#58a6ff"
  muted: "#484f58"
```

### `tab_width`
(Default: `20`) The width of the sidebar in the tabs UI.

### `layout`
(Default: `tabs`) Selects the UI layout mode.

| Value | Behaviour |
|-------|-----------|
| `tabs` | Sidebar app list + one active app in an embedded terminal. |
| `panes` | tmux/zellij-style tiled windows and panes; multiple apps visible at once. |

Legacy aliases are still accepted: `classic` maps to `tabs` and `zellij` maps to `panes`.

You can switch layouts **at runtime** with **`Shift+L`** (or command palette → "Switch to tabs/panes layout") — no restart required. tuimux replays your running apps in the new layout.

### `sidebar_position`
(Default: `left`) Controls where the app/window sidebar is docked. Applies to both tabs and panes modes.

| Value | Result |
|-------|--------|
| `left` | Vertical sidebar on the left (default) |
| `right` | Vertical sidebar on the right |
| `top` | Horizontal bar at the top |
| `bottom` | Horizontal bar at the bottom |

Press **`Shift+B`** (or command palette → "Rotate sidebar position") to cycle through positions at runtime.

### `focus_on_launch`
(Default: `true`) When an app launches, automatically switch into TERMINAL focus so you can start typing into it immediately. Set to `false` to stay in control focus (TABS in tabs mode, PANES in panes mode) after launching.

### `onboarding_completed`
(Default: `false`) Set automatically to `true` after the first-run wizard is completed or skipped, so the wizard does not reappear on subsequent launches. Re-run the wizard at any time via the command palette → "Run setup wizard".

### `apps`
Each app entry defines a TUI application to be managed.
- `id`: (Optional) Stable identifier; auto-generated if omitted.
- `name`: Display name in the tab list.
- `command`: The executable to run.
- `args`: (Optional) String of arguments to pass to the command.
- `cwd`: (Default: `~`) Initial working directory. Supports `~`, `<CONFIG_DIR>`, and `<STATE_DIR>` placeholders.
- `autostart`: (Default: `false`) If true, the app starts automatically when tuimux launches.
- `restart_on_exit`: (Default: `false`) If true, the app will automatically respawn if it exits.
- `env`: (Optional) Key-value pairs of environment variables for the app.

### `session`
- `persist`: (Default: `false`) If true, tuimux remembers which apps were running and their state between restarts.
- `file`: Custom path for the session state file. Supports `<STATE_DIR>` placeholder.

`tuimux --shutdown` clears the persisted session snapshot so only apps marked `autostart: true` relaunch.

## Path Placeholders
The following placeholders can be used in `cwd`, `args`, and `session.file`:
- `~`: Expanded to the user's home directory.
- `<CONFIG_DIR>`: The directory containing the active `tuimux.yaml`.
- `<STATE_DIR>`: The XDG state directory (usually `~/.local/state/tuimux/`).

## See Also

- [CONFIG.md](../CONFIG.md) - Comprehensive configuration reference
- [Apps](./apps.md) - App configuration examples
