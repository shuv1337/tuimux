# tuimux

A centralized TUI management application for running multiple TUI applications in embedded terminal windows. Built with [OpenTUI](https://github.com/anomalyco/opentui) and SolidJS.

## Screenshots

### Main Interface
![Shell](shell.png)

### Running TUI Applications
![btop](btop.png)

### Command Palette
![Command Palette](palette.png)

### Edit App Modal
![Edit App](edit.png)

## Features

- **Embedded Terminals**: Run multiple TUIs in a single window using Ghostty's high-performance terminal emulator.
- **Tab Management**: Organize and switch between different applications using a vertical sidebar.
- **Simple Modal Keyboard**: Two modes - TABS mode for navigation and TERMINAL mode for PTY input. Toggle with `Ctrl+A`.
- **Command Palette**: Quickly search, switch, stop, edit, and remove apps with a fuzzy-search palette (`Space`).
- **Runtime Management**: Add, edit, and remove application entries directly within the app without restarting.
- **Session Persistence**: Optional config to remember and restore running applications and the active tab between restarts.
- **Highly Configurable**: Customize themes and application lists via YAML.
- **Path Expansion**: Supports `~`, `<CONFIG_DIR>`, and `<STATE_DIR>` tokens in paths.
- **App Availability Detection**: Add Tab modal shows which TUI apps are installed on your system.

## Documentation

For detailed guides, see the [`docs/`](./docs/) directory:

- [Getting Started](./docs/getting-started.md) - Installation and first run
- [Configuration](./docs/configuration.md) - YAML config reference
- [Apps](./docs/apps.md) - App configuration examples
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

See also: [CONFIG.md](./CONFIG.md) for a comprehensive configuration reference.

### Dependency security

tuimux uses Bun as its package manager. Bun installs are not covered by Socket's CLI wrapper (which supports npm/pnpm/yarn/npx only). The [Socket GitHub App](https://github.com/apps/socket-security) handles PR-level dependency scanning instead. See [SECURITY.md](./SECURITY.md) for details.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [SolidJS](https://www.solidjs.com/)
- **TUI Engine**: [OpenTUI](https://github.com/anomalyco/opentui)
- **Terminal Emulator**: [ghostty-opentui](https://github.com/remorses/ghostty-opentui)
- **PTY**: `node-pty` (via `spawn-pty`)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime installed on your system.
- A terminal that supports TUI applications (xterm-256color recommended).

### Quick Start (No Install)

Run tuimux instantly without installing:

```bash
bunx tuimux
```

### Installation

Install globally:

```bash
bun install -g tuimux
```

Then run from anywhere:

```bash
tuimux
```

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/shuv1337/tuimux.git
cd tuimux
bun install
```

Start the application in development mode:

```bash
bun dev
```

Build for production:

```bash
bun run build
```

Run typechecks:

```bash
bun run typecheck
```

## Configuration

Tuimux looks for a configuration file at `~/.config/tuimux/tuimux.yaml`. It also supports a local `tuimux.yaml` in the current working directory for project-specific setups.

### Keyboard Shortcuts

Tuimux uses a simple two-mode system:

- **`Ctrl+A`** - Toggle between TABS and TERMINAL mode
- **Double-tap `Ctrl+A`** - Send `Ctrl+A` to the terminal (useful for nested tmux/screen)

**TABS Mode** (single keystrokes):

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate down/up in tab list |
| `gg` | Jump to first tab |
| `G` | Jump to last tab |
| `Enter` | Select/start app |
| `Space` | Open command palette |
| `t` | Add new tab |
| `e` | Edit selected app |
| `x` | Stop selected app |
| `r` | Restart selected app |
| `K` | Kill all running apps |
| `q` | Disconnect (leave apps running) |
| `Q` | Quit and stop all apps |
| `Shift+L` | Switch layout (tabs/panes) |
| `Shift+B` | Rotate sidebar position (left → top → right → bottom) |

**TERMINAL Mode**: All keystrokes pass through to the embedded terminal.

### Theme Customization

Default theme is Night Owl. Customize in your `tuimux.yaml`:

```yaml
theme:
  primary: "#82aaff"      # Blue - selections
  background: "#011627"   # Deep dark blue
  foreground: "#d6deeb"   # Light text
  accent: "#7fdbca"       # Cyan - active indicators
  muted: "#637777"        # Gray - inactive elements
```

## Change Log

### v0.4.0
- **Rebranded to tuimux**: Project renamed from tuidoscope to tuimux.
- **Layout Mode Rename**: "classic" layout is now "tabs"; "zellij" layout is now "panes". Legacy values still accepted.
- **Panes Mode Window Sidebar**: In panes layout, a window list sidebar replaces the tab list for managing windows.
- **Switch Layout Keybind**: Press `Shift+L` in non-terminal focus to toggle between tabs and panes layout.
- **Switch Layout Command Palette**: "Switch layout" command added to the command palette.

### v0.3.0
- **Simplified Keyboard System**: Replaced tmux-style leader key with simple focus-toggle model using `Ctrl+A`.
- **Two-Mode Interface**: TABS mode for navigation (single keystrokes) and TERMINAL mode for PTY input.
- **Enhanced Add Tab Modal**: Now shows app presets with availability detection directly in the modal.
- **Streamlined Config**: Removed keybinds configuration - keyboard shortcuts are now fixed for consistency.

### v0.2.0
- **Leader Key System**: tmux-style configurable leader key (default `Ctrl+A`).
- **App Availability Detection**: Preset list shows which apps are installed on your system.
- **Expanded Presets**: 30+ TUI apps including AI coding agents (Claude, OpenCode, Aider, Gemini, Codex).
- **Night Owl Theme**: Updated default theme to Night Owl color scheme.

### v0.1.0
- Initial release.
- Embedded terminal windows via `ghostty-opentui`.
- Vertical tab sidebar for application management.
- Command palette with fuzzy search.
- Optional session persistence (running apps & active tab).
- Runtime application configuration (Add/Edit).
- Path expansion for working directories.

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request on [GitHub](https://github.com/shuv1337/tuimux).

## Acknowledgments

This project is built directly on top of:

- **[OpenTUI](https://github.com/anomalyco/opentui)** - Provides the declarative component model and rendering engine for the entire interface.
- **[ghostty-opentui](https://github.com/remorses/ghostty-opentui)** - Enables high-performance, embedded terminal sessions within the application.

Huge thanks to both for making this possible.

## License

MIT
