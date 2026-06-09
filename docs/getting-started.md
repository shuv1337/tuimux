# Getting Started

## Introduction

**tuimux** is a centralized TUI (Text User Interface) management application designed to organize and run multiple TUI applications within embedded terminal windows. Built with [OpenTUI](https://github.com/anomalyco/opentui) and SolidJS, it provides a unified interface for your favorite terminal tools, allowing you to switch between them quickly and manage them as a single workspace.

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

When you launch tuimux for the first time without an existing configuration file, a **welcome onboarding wizard** appears. It lets you choose from a multi-select list of app presets (30+ options including shells, system monitors, AI coding agents, file managers, and more). tuimux detects which tools are already installed and highlights them. Press **`Esc`** to skip the wizard and start with an empty workspace.

Once you complete or skip the wizard, tuimux saves your configuration to `~/.config/tuimux/tuimux.yaml` and sets an `onboarding_completed` flag so the wizard won't reappear on subsequent launches. You can re-run the wizard at any time via the command palette (`Space`) → "Run setup wizard".

If you have an existing `~/.config/tuidoscope` config and session from the previous name, tuimux automatically migrates it on first run.

### Layout Modes

tuimux supports two layout modes, switchable at any time:

- **tabs** (default): A sidebar shows your app list; one active app is displayed in the embedded terminal at a time. Good for focused, single-app workflows.
- **panes**: tmux/zellij-style tiled windows and panes. A window-list sidebar; each window holds a split tree of panes, so multiple apps can be visible simultaneously.

Press **`Shift+L`** (or use the command palette → "Switch to tabs/panes layout") to toggle between the two layouts at runtime. tuimux restarts the session server in the target layout and replays your running apps.

### Keyboard Navigation

tuimux uses a two-focus keyboard system. The **control focus** (shown as **TABS** in tabs mode or **PANES** in panes mode) lets you navigate and manage apps. The **terminal focus** passes all keystrokes directly to the embedded PTY.

Press **`Ctrl+A`** to toggle between control and terminal focus. Double-tap `Ctrl+A` to send a literal Ctrl+A to the terminal. **`Ctrl+C` always passes through to the focused app — it never quits tuimux.**

**Tabs mode — control keys:**

| Key | Action |
|-----|--------|
| `j` / `k` or `↑` / `↓` | Navigate up/down through the app list |
| `gg` / `G` | Jump to top / bottom of list |
| `Enter` | Start or focus the selected app |
| `t` | Add a new app |
| `e` | Edit selected app |
| `x` | Stop selected app |
| `r` | Restart selected app |
| `K` (Shift+K) | Kill all running apps |
| `Space` | Open command palette |
| `?` | Show help cheatsheet |
| `Shift+L` | Switch between tabs and panes layout |
| `Shift+B` | Rotate sidebar position (left → top → right → bottom) |
| `q` | Detach (leave apps running) |
| `Q` (Shift+Q) | Quit and stop all apps |

**Panes mode — control keys:**

| Key | Action |
|-----|--------|
| `v` | Split pane vertically |
| `s` | Split pane horizontally |
| `n` | New window |
| `w` | Close current window |
| `x` | Close current pane |
| `[` / `]` | Previous / next window |
| `p` | Cycle focus between panes |
| `t` | Add app to pane |
| `Space` | Open command palette |
| `?` | Show help cheatsheet |
| `Shift+L` | Switch between tabs and panes layout |
| `Shift+B` | Rotate sidebar position |
| `q` | Detach (leave apps running) |
| `Q` (Shift+Q) | Quit and stop all apps |

Detaching keeps the session server running. Launch `tuimux` again to reattach.

## Quick Start Example

If you want to get started immediately with a simple shell, you can skip the onboarding wizard and create a minimal configuration file manually:

```yaml
# ~/.config/tuimux/tuimux.yaml
version: 2

apps:
  - name: "Shell"
    command: "$SHELL"
    cwd: "~"
    autostart: true
```

This creates a single shell tab using your default shell (bash, zsh, fish, etc.). You can add more apps later by pressing `t` to open the "Add Tab" modal.

For a more feature-rich setup, you might include common TUI tools:

```yaml
version: 2

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
