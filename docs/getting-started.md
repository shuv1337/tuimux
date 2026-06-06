# Getting Started

## Introduction

**tuimux** is a centralized TUI (Text User Interface) management application designed to organize and run multiple TUI applications within embedded terminal windows. Built with [OpenTUI](https://github.com/opentui/opentui) and SolidJS, it provides a unified interface for your favorite terminal tools, allowing you to switch between them quickly and manage them as a single workspace.

By leveraging Ghostty's high-performance terminal emulator, tuimux offers a smooth and responsive experience for running everything from simple shells to complex graphical TUIs like `btop` or `lazygit`.

## Use Cases

Tuimux is particularly useful for:

- **System Monitoring:** Keep multiple monitoring tools like `htop`, `btop`, `glances`, or `bandwhich` running in separate tabs for quick access.
- **Git Workflow Management:** Manage multiple repositories simultaneously using `lazygit`, `tig`, or `gitui` without cluttering your main terminal.
- **AI-Assisted Development:** Keep AI coding agents like `claude`, `opencode`, or `aider` active in dedicated tabs, ready to assist with your project.
- **File Management:** Organize different file managers like `yazi`, `ranger`, or `lf` for different projects or tasks.
- **Infrastructure Management:** Run `k9s` or `lazydocker` in a centralized dashboard to monitor your containers and clusters.
- **Consolidated Workspace:** Instead of managing multiple terminal tabs or tmux panes manually, tuimux provides a structured environment with optional session persistence (enable `session.persist`) to remember your active apps between restarts.

## Installation

### Prerequisites

- **Bun**: Tuimux is built on the [Bun](https://bun.sh/) runtime. You must have Bun installed on your system.
- **Terminal**: A terminal that supports TUI applications (xterm-256color recommended).

### Quick Start (No Install)

You can run tuimux immediately using `bunx` without installing it globally:

```bash
bunx tuimux
```

### Global Installation

To install tuimux globally on your system:

```bash
bun install -g tuimux
```

Once installed, you can launch it from any directory:

```bash
tuimux
```

## First Run

When you launch tuimux for the first time without an existing configuration file, you'll see an empty app list. Getting started is simple:

1. Press **`t`** to open the Add Tab modal
2. Choose from a list of detected TUI application presets, or switch to Custom mode to add your own
3. Select an app with **`Enter`** to add it to your workspace

Tuimux will save your configuration to `~/.config/tuimux/tuimux.yaml` (or your system's equivalent XDG config directory).

### Keyboard Navigation

Tuimux uses a simple two-mode keyboard system:

- **Tabs Mode** (default): Single keystrokes control navigation and app management
  - `j`/`k` - Navigate up/down through the app list
  - `gg`/`G` - Jump to top/bottom of list
  - `Enter` - Start or focus the selected app
  - `t` - Add a new app
  - `e` - Edit selected app
  - `x` - Stop selected app
  - `r` - Restart selected app
  - `K` (Shift+K) - Kill all running apps
  - `Space` - Open command palette
  - `q` - Disconnect (leave apps running)
  - `Q` (Shift+Q) - Quit and stop all apps

Disconnecting keeps the session server running. Launch `tuimux` again to reattach.

- **Terminal Mode**: All input goes to the focused terminal
  - `Ctrl+A` - Switch back to Tabs mode
  - `Ctrl+A Ctrl+A` (double-tap) - Send literal Ctrl+A to the terminal

Press **`Ctrl+A`** to toggle between Tabs and Terminal mode.

## Quick Start Example

If you want to get started immediately with a simple shell, you can skip the onboarding wizard and create a minimal configuration file:

```yaml
# ~/.config/tuimux/tuimux.yaml
version: 1

apps:
  - name: "Shell"
    command: "$SHELL"
    cwd: "~"
    autostart: true
```

This creates a single shell tab using your default shell (bash, zsh, fish, etc.). You can add more apps later by pressing `t` to open the "Add Tab" modal.

For a more feature-rich setup, you might include common TUI tools:

```yaml
version: 1

apps:
  - name: "Shell"
    command: "$SHELL"
    cwd: "~"
    autostart: true

  - name: "System Monitor"
    command: "btop"
    autostart: true
    restart_on_exit: true

  - name: "Files"
    command: "yazi"
    autostart: false
```

See the [Configuration Guide](configuration.md) for complete documentation of all available options.
