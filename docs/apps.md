# App Configuration Examples

This guide provides examples and best practices for configuring TUI applications in tuimux.

## App Configuration Basics

Each app in tuimux is defined in the `apps` section of your `tuimux.yaml` configuration file. An app entry can have the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | *auto* | Stable identifier; auto-generated and written back if omitted |
| `name` | string | *required* | Display name shown in the tab list |
| `command` | string | *required* | The executable to run |
| `args` | string | `""` | Arguments passed to the command |
| `cwd` | string | `~` | Working directory for the app |
| `env` | object | `{}` | Environment variables |
| `autostart` | boolean | `false` | Start automatically on launch |
| `restart_on_exit` | boolean | `false` | Restart if the app exits |

### Basic Example

```yaml
apps:
  - name: "htop"
    command: "htop"
```

### Full Example

```yaml
apps:
  - name: "Project Shell"
    command: "zsh"
    cwd: "~/projects/myapp"
    autostart: true
    restart_on_exit: false
    env:
      TERM: "xterm-256color"
      EDITOR: "nvim"
```

## Path Placeholders

You can use these placeholders in `cwd` and `args`:

- `~` - Expands to your home directory
- `<CONFIG_DIR>` - Directory containing your `tuimux.yaml`
- `<STATE_DIR>` - XDG state directory (`~/.local/state/tuimux/`)

```yaml
apps:
  - name: "Config Editor"
    command: "nvim"
    args: "<CONFIG_DIR>/tuimux.yaml"
```

## Tips

- Set `autostart: true` for apps you always want running (like a shell or system monitor)
- Use `restart_on_exit: true` for long-running apps that should stay alive
- Apps that exit quickly (like `dust` or `duf`) work best without `restart_on_exit`
- Some apps require specific `TERM` settings - see troubleshooting if you have display issues

---

## Shell Examples

Shells are the most common apps to run in tuimux. Here are examples for popular shells:

### Bash

```yaml
apps:
  - name: "Bash"
    command: "bash"
    autostart: true
```

With a custom profile:

```yaml
apps:
  - name: "Bash (custom)"
    command: "bash"
    args: "--rcfile ~/.bashrc.tuimux"
```

### Zsh

```yaml
apps:
  - name: "Zsh"
    command: "zsh"
    autostart: true
```

Project-specific shell:

```yaml
apps:
  - name: "Project Shell"
    command: "zsh"
    cwd: "~/projects/myapp"
    autostart: true
    env:
      PROJECT_ENV: "development"
```

### Fish

```yaml
apps:
  - name: "Fish"
    command: "fish"
    autostart: true
```

With a specific config directory:

```yaml
apps:
  - name: "Fish (custom)"
    command: "fish"
    args: "--config ~/.config/fish/tuimux.fish"
```

### Nushell

```yaml
apps:
  - name: "Nushell"
    command: "nu"
    autostart: true
```

With custom config:

```yaml
apps:
  - name: "Nushell (custom)"
    command: "nu"
    args: "--config ~/.config/nushell/tuimux.nu"
```

### Shell Tips

- Use `autostart: true` for your primary shell
- Set `cwd` to frequently-used project directories
- Use `env` to set shell-specific environment variables
- Consider having multiple shell tabs for different projects

---

## System Monitor Examples

System monitors are excellent candidates for tuimux tabs. They provide at-a-glance system status while you work in other tabs.

### htop

The classic interactive process viewer.

```yaml
apps:
  - name: "htop"
    command: "htop"
    autostart: true
```

With custom config:

```yaml
apps:
  - name: "htop"
    command: "htop"
    args: "--tree"  # Show processes as a tree
```

### btop

A modern resource monitor with a beautiful interface.

```yaml
apps:
  - name: "btop"
    command: "btop"
    autostart: true
```

With low update mode for reduced CPU usage:

```yaml
apps:
  - name: "btop"
    command: "btop"
    args: "--low-color"
    env:
      BTOP_UPDATE_MS: "2000"  # Update every 2 seconds
```

### glances

Cross-platform monitoring tool with extensive metrics.

```yaml
apps:
  - name: "glances"
    command: "glances"
    autostart: true
```

Minimal mode (less resource-intensive):

```yaml
apps:
  - name: "glances"
    command: "glances"
    args: "--disable-plugin all --enable-plugin cpu,mem,load"
```

Web server mode (access from browser):

```yaml
apps:
  - name: "glances (web)"
    command: "glances"
    args: "-w"  # Starts web server on port 61208
```

### bottom (btm)

A graphical process/system monitor with vim-like keybindings.

```yaml
apps:
  - name: "bottom"
    command: "btm"
    autostart: true
```

With custom options:

```yaml
apps:
  - name: "bottom"
    command: "btm"
    args: "--battery --enable_gpu_memory"  # Show battery and GPU info
```

Basic mode (no graphs, more processes visible):

```yaml
apps:
  - name: "bottom"
    command: "btm"
    args: "--basic"
```

### System Monitor Tips

- Set `autostart: true` for your preferred monitor to have system stats always visible
- Consider using `restart_on_exit: true` if you want the monitor to restart after pressing `q`
- Most monitors support custom configs - check their documentation for personalization options
- Use lightweight options (like `--low-color` or reduced update intervals) if running many tabs

---

## File Manager Examples

Terminal file managers are perfect for tuimux - navigate your filesystem in one tab while working in another.

### yazi

A blazing fast terminal file manager written in Rust with async I/O.

```yaml
apps:
  - name: "yazi"
    command: "yazi"
    cwd: "~"
```

Open in a specific directory:

```yaml
apps:
  - name: "yazi (projects)"
    command: "yazi"
    args: "~/projects"
```

### ranger

A vim-inspired file manager with previews and extensive customization.

```yaml
apps:
  - name: "ranger"
    command: "ranger"
    cwd: "~"
```

With a custom config directory:

```yaml
apps:
  - name: "ranger"
    command: "ranger"
    args: "--confdir=~/.config/ranger-tuimux"
```

Clean mode (no preview column):

```yaml
apps:
  - name: "ranger"
    command: "ranger"
    args: "--cmd='set column_ratios 1,3'"
```

### lf

A terminal file manager inspired by ranger, written in Go.

```yaml
apps:
  - name: "lf"
    command: "lf"
    cwd: "~"
```

With custom config:

```yaml
apps:
  - name: "lf"
    command: "lf"
    args: "-config ~/.config/lf/tuimux.lfrc"
```

Open in a specific path:

```yaml
apps:
  - name: "lf (downloads)"
    command: "lf"
    args: "~/Downloads"
```

### nnn

A fast and minimal file manager with a focus on simplicity.

```yaml
apps:
  - name: "nnn"
    command: "nnn"
    cwd: "~"
```

With plugins enabled:

```yaml
apps:
  - name: "nnn"
    command: "nnn"
    args: "-e"  # Open text files in $EDITOR
    env:
      NNN_PLUG: "f:finder;o:fzopen;p:preview-tui"
```

Detail mode (show file details):

```yaml
apps:
  - name: "nnn"
    command: "nnn"
    args: "-d"  # Show file details
```

### Midnight Commander (mc)

A classic dual-pane file manager with built-in editor and viewer.

```yaml
apps:
  - name: "mc"
    command: "mc"
    cwd: "~"
```

With specific directories in each pane:

```yaml
apps:
  - name: "mc"
    command: "mc"
    args: "~/projects ~/Downloads"  # Left pane, right pane
```

Viewer mode only:

```yaml
apps:
  - name: "mc (viewer)"
    command: "mc"
    args: "--view ~/logs/app.log"
```

### vifm

A vim-like file manager with two panes and extensive customization.

```yaml
apps:
  - name: "vifm"
    command: "vifm"
    cwd: "~"
```

With specific directories:

```yaml
apps:
  - name: "vifm"
    command: "vifm"
    args: "~/projects ~/backups"  # Left pane, right pane
```

Single pane mode:

```yaml
apps:
  - name: "vifm"
    command: "vifm"
    args: "--select ~/projects"
```

### File Manager Tips

- File managers work great alongside a shell tab for quick navigation
- Most file managers support opening files in your `$EDITOR` - set it in `env`
- Use `cwd` to start in your most-used directory
- Consider having multiple file manager tabs for different project roots
- For file managers that exit when you press `q`, omit `restart_on_exit` to avoid loops

---

## Git Tool Examples

Git TUI tools provide powerful visual interfaces for git operations. They're excellent tuimux companions for development workflows.

### lazygit

A simple terminal UI for git commands with intuitive keybindings.

```yaml
apps:
  - name: "lazygit"
    command: "lazygit"
    cwd: "~/projects/myrepo"
```

With a specific path:

```yaml
apps:
  - name: "lazygit"
    command: "lazygit"
    args: "--path ~/projects/myrepo"
```

With custom config:

```yaml
apps:
  - name: "lazygit"
    command: "lazygit"
    args: "--use-config-file ~/.config/lazygit/tuimux.yml"
```

In work tree mode (for git worktrees):

```yaml
apps:
  - name: "lazygit"
    command: "lazygit"
    args: "-w"  # Open in worktree mode
    cwd: "~/projects/myrepo"
```

### tig

A text-mode interface for git with a powerful log viewer.

```yaml
apps:
  - name: "tig"
    command: "tig"
    cwd: "~/projects/myrepo"
```

View specific branch:

```yaml
apps:
  - name: "tig (main)"
    command: "tig"
    args: "main"
    cwd: "~/projects/myrepo"
```

View a specific file's history:

```yaml
apps:
  - name: "tig (file)"
    command: "tig"
    args: "-- src/main.ts"
    cwd: "~/projects/myrepo"
```

Blame mode (see line-by-line authorship):

```yaml
apps:
  - name: "tig blame"
    command: "tig"
    args: "blame src/main.ts"
    cwd: "~/projects/myrepo"
```

Status mode (like `git status` but interactive):

```yaml
apps:
  - name: "tig status"
    command: "tig"
    args: "status"
    cwd: "~/projects/myrepo"
```

### gitui

A blazing fast git TUI written in Rust.

```yaml
apps:
  - name: "gitui"
    command: "gitui"
    cwd: "~/projects/myrepo"
```

With a specific directory:

```yaml
apps:
  - name: "gitui"
    command: "gitui"
    args: "--directory ~/projects/myrepo"
```

With custom theme:

```yaml
apps:
  - name: "gitui"
    command: "gitui"
    args: "--theme ~/.config/gitui/theme.ron"
```

With watcher for auto-refresh on file changes:

```yaml
apps:
  - name: "gitui"
    command: "gitui"
    args: "--watcher"
    cwd: "~/projects/myrepo"
```

### Git Tool Tips

- Set `cwd` to your repository root for automatic context
- Git tools exit when you press `q` - avoid `restart_on_exit` unless you want them to restart
- lazygit and gitui are full-featured alternatives to git CLI commands
- tig excels at viewing history and blame - pair it with lazygit or gitui for staging/commits
- Consider having multiple git tool tabs for different repositories in a monorepo workflow

---

## Container Tool Examples

Container management TUIs are invaluable for monitoring and managing Docker containers and Kubernetes clusters. They integrate seamlessly with tuimux for DevOps workflows.

### lazydocker

A simple terminal UI for Docker and docker-compose.

```yaml
apps:
  - name: "lazydocker"
    command: "lazydocker"
```

With a specific docker-compose file:

```yaml
apps:
  - name: "lazydocker"
    command: "lazydocker"
    args: "--file ~/projects/myapp/docker-compose.yml"
    cwd: "~/projects/myapp"
```

With custom config:

```yaml
apps:
  - name: "lazydocker"
    command: "lazydocker"
    args: "--config ~/.config/lazydocker/tuimux.yml"
```

For a specific project directory:

```yaml
apps:
  - name: "lazydocker (myapp)"
    command: "lazydocker"
    cwd: "~/projects/myapp"  # Finds docker-compose.yml in this directory
```

### k9s

A powerful Kubernetes CLI to manage clusters with a TUI.

```yaml
apps:
  - name: "k9s"
    command: "k9s"
```

With a specific kubeconfig:

```yaml
apps:
  - name: "k9s"
    command: "k9s"
    args: "--kubeconfig ~/.kube/staging-config"
```

With a specific context:

```yaml
apps:
  - name: "k9s (production)"
    command: "k9s"
    args: "--context production-cluster"
```

With a specific namespace:

```yaml
apps:
  - name: "k9s (default ns)"
    command: "k9s"
    args: "--namespace default"
```

All namespaces view:

```yaml
apps:
  - name: "k9s (all)"
    command: "k9s"
    args: "--all-namespaces"
```

Read-only mode (safer for production):

```yaml
apps:
  - name: "k9s (readonly)"
    command: "k9s"
    args: "--readonly"
```

With custom skin/theme:

```yaml
apps:
  - name: "k9s"
    command: "k9s"
    env:
      K9S_CONFIG_DIR: "~/.config/k9s-tuimux"
```

Start directly in a specific resource view:

```yaml
apps:
  - name: "k9s (pods)"
    command: "k9s"
    args: "--command pods"
```

```yaml
apps:
  - name: "k9s (deployments)"
    command: "k9s"
    args: "--command deployments"
```

### Container Tool Tips

- lazydocker requires Docker to be running and accessible (your user must be in the `docker` group or using rootless Docker)
- k9s requires a valid kubeconfig and kubectl access to your cluster
- Use `--readonly` flag with k9s on production clusters to prevent accidental changes
- Consider having multiple k9s tabs for different clusters (staging, production)
- lazydocker is excellent alongside a shell tab for quick container debugging
- Both tools support custom themes - match them to your tuimux theme for consistency

---

## Editor Examples

Terminal text editors are a natural fit for tuimux, allowing you to edit files in one tab while running commands, monitoring logs, or managing files in others.

### Neovim

A hyperextensible Vim-based text editor with a modern plugin ecosystem.

```yaml
apps:
  - name: "nvim"
    command: "nvim"
    cwd: "~/projects/myapp"
```

Open a specific file:

```yaml
apps:
  - name: "nvim (config)"
    command: "nvim"
    args: "<CONFIG_DIR>/tuimux.yaml"
```

Open a directory (file explorer mode):

```yaml
apps:
  - name: "nvim (project)"
    command: "nvim"
    args: "."
    cwd: "~/projects/myapp"
```

With a specific config (for different setups):

```yaml
apps:
  - name: "nvim (minimal)"
    command: "nvim"
    args: "-u ~/.config/nvim/minimal.lua"
```

Diff mode (compare two files):

```yaml
apps:
  - name: "nvim (diff)"
    command: "nvim"
    args: "-d file1.txt file2.txt"
    cwd: "~/projects"
```

With custom environment for plugins:

```yaml
apps:
  - name: "nvim"
    command: "nvim"
    cwd: "~/projects/myapp"
    env:
      NVIM_APPNAME: "nvim-tuimux"  # Use alternate config directory
```

### Helix

A post-modern modal text editor with built-in LSP support and tree-sitter integration.

```yaml
apps:
  - name: "helix"
    command: "hx"
    cwd: "~/projects/myapp"
```

Open a specific file:

```yaml
apps:
  - name: "helix"
    command: "hx"
    args: "src/main.rs"
    cwd: "~/projects/myapp"
```

Open multiple files:

```yaml
apps:
  - name: "helix"
    command: "hx"
    args: "src/lib.rs src/main.rs Cargo.toml"
    cwd: "~/projects/myapp"
```

With a specific config directory:

```yaml
apps:
  - name: "helix"
    command: "hx"
    args: "--config ~/.config/helix/tuimux.toml"
```

Health check mode (verify LSP and tree-sitter):

```yaml
apps:
  - name: "helix (health)"
    command: "hx"
    args: "--health"
```

With verbose logging for debugging:

```yaml
apps:
  - name: "helix (debug)"
    command: "hx"
    args: "-v"  # -vv for more verbose
    cwd: "~/projects/myapp"
```

### micro

A modern and intuitive terminal-based text editor with familiar keybindings (Ctrl+S, Ctrl+C, etc.).

```yaml
apps:
  - name: "micro"
    command: "micro"
    cwd: "~/projects/myapp"
```

Open a specific file:

```yaml
apps:
  - name: "micro"
    command: "micro"
    args: "README.md"
    cwd: "~/projects/myapp"
```

With a custom config directory:

```yaml
apps:
  - name: "micro"
    command: "micro"
    args: "-config-dir ~/.config/micro-tuimux"
```

With plugin enabled:

```yaml
apps:
  - name: "micro"
    command: "micro"
    env:
      MICRO_TRUECOLOR: "1"  # Enable true color support
```

Open file at a specific line:

```yaml
apps:
  - name: "micro"
    command: "micro"
    args: "+42 src/main.go"  # Open at line 42
    cwd: "~/projects/myapp"
```

Read-only mode (view files without editing):

```yaml
apps:
  - name: "micro (viewer)"
    command: "micro"
    args: "-readonly true ~/logs/app.log"
```

### Editor Tips

- Editors work well without `autostart` - launch them when you need to edit
- Set `cwd` to your project root so relative paths work correctly
- Most editors support opening directories for file browsing - useful for project navigation
- Neovim and Helix use modal editing (vim-style), while micro uses standard keybindings
- For Neovim with many plugins, consider a minimal config for faster startup in tuimux
- Helix has built-in LSP support - no plugins needed for code intelligence
- micro is excellent for quick edits if you're not familiar with vim keybindings
- Consider setting `TERM=xterm-256color` in `env` if you see color issues

---

## AI Coding Agent Examples

AI coding agents are terminal-based tools that use large language models to help write, review, and debug code. They work exceptionally well in tuimux - run the AI agent in one tab while monitoring system resources, browsing files, or running tests in others.

### Claude Code

Anthropic's official CLI for Claude, providing AI-powered coding assistance.

```yaml
apps:
  - name: "claude"
    command: "claude"
    cwd: "~/projects/myapp"
```

Start in a specific project:

```yaml
apps:
  - name: "claude (project)"
    command: "claude"
    cwd: "~/projects/myapp"
    env:
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"  # Uses your shell's env var
```

With a specific model:

```yaml
apps:
  - name: "claude"
    command: "claude"
    args: "--model claude-sonnet-4-20250514"
    cwd: "~/projects/myapp"
```

### OpenCode

An open source AI coding agent with support for multiple LLM providers.

```yaml
apps:
  - name: "opencode"
    command: "opencode"
    cwd: "~/projects/myapp"
```

With a specific provider and model:

```yaml
apps:
  - name: "opencode"
    command: "opencode"
    cwd: "~/projects/myapp"
    env:
      OPENCODE_MODEL: "anthropic/claude-sonnet-4-20250514"
```

In a git worktree workflow:

```yaml
apps:
  - name: "opencode (feature)"
    command: "opencode"
    cwd: "~/projects/myapp-feature-branch"
```

### Aider

AI pair programming in your terminal - works with many LLM providers.

```yaml
apps:
  - name: "aider"
    command: "aider"
    cwd: "~/projects/myapp"
```

With Claude:

```yaml
apps:
  - name: "aider"
    command: "aider"
    args: "--model claude-3-5-sonnet-20241022"
    cwd: "~/projects/myapp"
    env:
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
```

With OpenAI:

```yaml
apps:
  - name: "aider"
    command: "aider"
    args: "--model gpt-4o"
    cwd: "~/projects/myapp"
    env:
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
```

Watch mode (auto-commit changes):

```yaml
apps:
  - name: "aider (watch)"
    command: "aider"
    args: "--auto-commits --watch"
    cwd: "~/projects/myapp"
```

Architect mode (planning without editing):

```yaml
apps:
  - name: "aider (architect)"
    command: "aider"
    args: "--architect"
    cwd: "~/projects/myapp"
```

### Codex CLI

OpenAI's Codex-based CLI assistant.

```yaml
apps:
  - name: "codex"
    command: "codex"
    cwd: "~/projects/myapp"
```

With a specific model:

```yaml
apps:
  - name: "codex"
    command: "codex"
    args: "--model o4-mini"
    cwd: "~/projects/myapp"
    env:
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
```

### Gemini CLI

Google's Gemini-powered coding assistant.

```yaml
apps:
  - name: "gemini"
    command: "gemini"
    cwd: "~/projects/myapp"
```

With authentication:

```yaml
apps:
  - name: "gemini"
    command: "gemini"
    cwd: "~/projects/myapp"
    env:
      GOOGLE_API_KEY: "${GOOGLE_API_KEY}"
```

### AI Coding Agent Tips

- Set `cwd` to your project root - AI agents need context from your codebase
- Keep API keys in your shell environment rather than hardcoding them in config
- AI agents work great alongside a file manager tab for context navigation
- Consider having multiple agent tabs for different projects or feature branches
- Most agents have high memory usage - monitor with htop/btop in another tab
- Use `restart_on_exit: false` as agents naturally exit after completing tasks
- For long sessions, the agent may consume significant tokens - be aware of costs

---

## Utility Examples

Disk usage analyzers and other utility TUIs are helpful for quickly understanding storage consumption and system state. These tools typically exit after displaying information, making them ideal for quick checks.

### ncdu

NCurses Disk Usage - an interactive disk usage analyzer with an ncurses interface.

```yaml
apps:
  - name: "ncdu"
    command: "ncdu"
    cwd: "~"
```

Scan a specific directory:

```yaml
apps:
  - name: "ncdu (projects)"
    command: "ncdu"
    args: "~/projects"
```

With color output:

```yaml
apps:
  - name: "ncdu"
    command: "ncdu"
    args: "--color dark"
    cwd: "~"
```

Export scan results to a file for later analysis:

```yaml
apps:
  - name: "ncdu (export)"
    command: "ncdu"
    args: "-o ~/ncdu-scan.json ~"
```

Read from a previously exported scan:

```yaml
apps:
  - name: "ncdu (import)"
    command: "ncdu"
    args: "-f ~/ncdu-scan.json"
```

Exclude certain directories:

```yaml
apps:
  - name: "ncdu"
    command: "ncdu"
    args: "--exclude .git --exclude node_modules ~"
```

### dust

A more intuitive version of `du` written in Rust. Shows disk usage in a tree-like format.

```yaml
apps:
  - name: "dust"
    command: "dust"
    cwd: "~"
```

Scan a specific directory:

```yaml
apps:
  - name: "dust (projects)"
    command: "dust"
    args: "~/projects"
```

Show only top N directories:

```yaml
apps:
  - name: "dust"
    command: "dust"
    args: "-n 20"  # Show top 20 largest
    cwd: "~"
```

Show files alongside directories:

```yaml
apps:
  - name: "dust"
    command: "dust"
    args: "-f"  # Include files
    cwd: "~"
```

Show apparent size (not disk usage):

```yaml
apps:
  - name: "dust"
    command: "dust"
    args: "-s"  # Apparent size
    cwd: "~"
```

Reverse order (smallest first):

```yaml
apps:
  - name: "dust"
    command: "dust"
    args: "-r"
    cwd: "~"
```

Ignore hidden files:

```yaml
apps:
  - name: "dust"
    command: "dust"
    args: "-i"  # Ignore hidden
    cwd: "~"
```

### duf

Disk Usage/Free utility - a better `df` alternative with a colorful output.

```yaml
apps:
  - name: "duf"
    command: "duf"
```

Show all filesystems (including pseudo, duplicates, etc.):

```yaml
apps:
  - name: "duf (all)"
    command: "duf"
    args: "--all"
```

Show only local filesystems:

```yaml
apps:
  - name: "duf (local)"
    command: "duf"
    args: "--only local"
```

Show only network filesystems:

```yaml
apps:
  - name: "duf (network)"
    command: "duf"
    args: "--only network"
```

Hide specific filesystems:

```yaml
apps:
  - name: "duf"
    command: "duf"
    args: "--hide special"
```

Sort by usage:

```yaml
apps:
  - name: "duf"
    command: "duf"
    args: "--sort usage"
```

JSON output (for scripting):

```yaml
apps:
  - name: "duf (json)"
    command: "duf"
    args: "--json"
```

With custom theme:

```yaml
apps:
  - name: "duf"
    command: "duf"
    args: "--theme dark"
```

### Utility Tips

- `ncdu` is interactive and allows navigation/deletion - great for cleaning up disk space
- `dust` provides a quick snapshot and exits - ideal for quick checks
- `duf` shows filesystem overview and exits - use it to check mounted volumes
- None of these tools need `restart_on_exit` since they're meant for one-off checks
- `ncdu` requires scanning time for large directories - be patient with big filesystems
- Consider running `dust` or `duf` with `autostart: false` and launching manually when needed
- For ongoing disk monitoring, pair these with a system monitor like `btop` in another tab

---

## Network Tool Examples

Network monitoring TUIs help you understand bandwidth usage, diagnose connectivity issues, and visualize network traffic. They're invaluable for debugging network problems or monitoring traffic in real-time.

### bandwhich

A terminal bandwidth utilization tool that displays current network utilization by process, connection, and remote IP/hostname.

```yaml
apps:
  - name: "bandwhich"
    command: "bandwhich"
```

**Note:** bandwhich requires root privileges to capture network data. Run with sudo:

```yaml
apps:
  - name: "bandwhich"
    command: "sudo"
    args: "bandwhich"
```

Show raw (numeric) addresses instead of resolving hostnames:

```yaml
apps:
  - name: "bandwhich"
    command: "sudo"
    args: "bandwhich --raw"
```

Show only specific network interface:

```yaml
apps:
  - name: "bandwhich (eth0)"
    command: "sudo"
    args: "bandwhich --interface eth0"
```

Show processes table (default view):

```yaml
apps:
  - name: "bandwhich"
    command: "sudo"
    args: "bandwhich --show-table processes"
```

Show connections table:

```yaml
apps:
  - name: "bandwhich (connections)"
    command: "sudo"
    args: "bandwhich --show-table connections"
```

Show remote addresses table:

```yaml
apps:
  - name: "bandwhich (remotes)"
    command: "sudo"
    args: "bandwhich --show-table remote-addresses"
```

Disable DNS resolution (faster startup):

```yaml
apps:
  - name: "bandwhich"
    command: "sudo"
    args: "bandwhich --no-resolve"
```

### trippy

A network diagnostic tool that combines traceroute and ping with a real-time TUI. Great for diagnosing latency and packet loss along network paths.

```yaml
apps:
  - name: "trippy"
    command: "trip"
    args: "google.com"
```

**Note:** trippy requires root privileges for raw socket access. Run with sudo:

```yaml
apps:
  - name: "trippy"
    command: "sudo"
    args: "trip google.com"
```

Trace to a specific target:

```yaml
apps:
  - name: "trippy (github)"
    command: "sudo"
    args: "trip github.com"
```

Use ICMP (default) protocol:

```yaml
apps:
  - name: "trippy"
    command: "sudo"
    args: "trip --protocol icmp google.com"
```

Use UDP protocol:

```yaml
apps:
  - name: "trippy (udp)"
    command: "sudo"
    args: "trip --protocol udp google.com"
```

Use TCP protocol (useful when ICMP is blocked):

```yaml
apps:
  - name: "trippy (tcp)"
    command: "sudo"
    args: "trip --protocol tcp google.com"
```

Specify target port (for TCP/UDP):

```yaml
apps:
  - name: "trippy (tcp:443)"
    command: "sudo"
    args: "trip --protocol tcp --target-port 443 google.com"
```

Set maximum hops:

```yaml
apps:
  - name: "trippy"
    command: "sudo"
    args: "trip --max-ttl 30 google.com"
```

Set packet interval (faster updates):

```yaml
apps:
  - name: "trippy (fast)"
    command: "sudo"
    args: "trip --min-round-duration 500ms google.com"
```

Use a specific source interface:

```yaml
apps:
  - name: "trippy (eth0)"
    command: "sudo"
    args: "trip --interface eth0 google.com"
```

Trace multiple targets:

```yaml
apps:
  - name: "trippy (multi)"
    command: "sudo"
    args: "trip google.com cloudflare.com 8.8.8.8"
```

### Network Tool Tips

- Both `bandwhich` and `trippy` require elevated privileges for raw network access
- On Linux, you can grant capabilities instead of running as root:
  - `sudo setcap cap_net_raw+ep $(which bandwhich)`
  - `sudo setcap cap_net_raw+ep $(which trip)`
- After setting capabilities, you can run without sudo in your tuimux config
- `bandwhich` is excellent for understanding which processes are using network bandwidth
- `trippy` is great for diagnosing latency issues and visualizing network paths
- Both tools benefit from a stable terminal size - avoid resizing while running
- For ongoing monitoring, set `autostart: true` if you need constant network visibility
- Pair these with a system monitor tab to correlate network usage with CPU/memory

---

## Advanced Configuration

This section covers advanced patterns for configuring apps with custom environment variables, working directories, and other specialized settings.

### Custom Environment Variables

Environment variables let you customize app behavior without modifying system-wide settings.

**Basic environment variable:**

```yaml
apps:
  - name: "Shell (dev)"
    command: "zsh"
    env:
      NODE_ENV: "development"
      DEBUG: "app:*"
```

**Multiple environment variables:**

```yaml
apps:
  - name: "API Dev Server"
    command: "npm"
    args: "run dev"
    cwd: "~/projects/api"
    env:
      NODE_ENV: "development"
      PORT: "3000"
      DATABASE_URL: "postgresql://localhost/devdb"
      REDIS_URL: "redis://localhost:6379"
      LOG_LEVEL: "debug"
```

**Using shell environment variables (inheritance):**

```yaml
apps:
  - name: "Claude"
    command: "claude"
    cwd: "~/projects/myapp"
    env:
      # Reference your shell's environment variables
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
      HOME: "${HOME}"
```

**Overriding PATH for specific apps:**

```yaml
apps:
  - name: "Node 20 Shell"
    command: "zsh"
    env:
      PATH: "/opt/node20/bin:${PATH}"
```

**Setting locale for apps with encoding issues:**

```yaml
apps:
  - name: "Legacy App"
    command: "oldapp"
    env:
      LANG: "en_US.UTF-8"
      LC_ALL: "en_US.UTF-8"
```

### Working Directory Patterns

The `cwd` (current working directory) setting is crucial for apps that need filesystem context.

**Project-specific shells:**

```yaml
apps:
  - name: "Frontend Shell"
    command: "zsh"
    cwd: "~/projects/myapp/frontend"
    autostart: true

  - name: "Backend Shell"
    command: "zsh"
    cwd: "~/projects/myapp/backend"
    autostart: true
```

**Git tools in different repos:**

```yaml
apps:
  - name: "lazygit (main)"
    command: "lazygit"
    cwd: "~/projects/main-app"

  - name: "lazygit (libs)"
    command: "lazygit"
    cwd: "~/projects/shared-libs"
```

**Using path placeholders:**

```yaml
apps:
  - name: "Config Editor"
    command: "nvim"
    args: "tuimux.yaml"
    cwd: "<CONFIG_DIR>"  # Opens config in its own directory

  - name: "Log Viewer"
    command: "less"
    args: "+F session.log"
    cwd: "<STATE_DIR>"  # Opens state files
```

**Home directory shorthand:**

```yaml
apps:
  - name: "Home Shell"
    command: "zsh"
    cwd: "~"  # Expands to /home/username or /Users/username
```

### Combining Environment and Working Directory

**Full development environment setup:**

```yaml
apps:
  - name: "Dev Shell"
    command: "zsh"
    cwd: "~/projects/myapp"
    autostart: true
    env:
      NODE_ENV: "development"
      EDITOR: "nvim"
      TERM: "xterm-256color"

  - name: "Test Runner"
    command: "npm"
    args: "run test:watch"
    cwd: "~/projects/myapp"
    env:
      CI: "false"
      FORCE_COLOR: "1"
    restart_on_exit: true  # Keep tests running

  - name: "Dev Server"
    command: "npm"
    args: "run dev"
    cwd: "~/projects/myapp"
    autostart: true
    restart_on_exit: true
    env:
      PORT: "3000"
      NODE_ENV: "development"
```

**Monorepo workspace pattern:**

```yaml
apps:
  - name: "Root Shell"
    command: "zsh"
    cwd: "~/projects/monorepo"
    autostart: true

  - name: "Package A"
    command: "npm"
    args: "run dev"
    cwd: "~/projects/monorepo/packages/a"
    env:
      DEBUG: "a:*"

  - name: "Package B"
    command: "npm"
    args: "run dev"
    cwd: "~/projects/monorepo/packages/b"
    env:
      DEBUG: "b:*"

  - name: "lazygit"
    command: "lazygit"
    cwd: "~/projects/monorepo"
```

**Docker development with environment:**

```yaml
apps:
  - name: "Docker Shell"
    command: "zsh"
    cwd: "~/projects/myapp"
    env:
      DOCKER_BUILDKIT: "1"
      COMPOSE_DOCKER_CLI_BUILD: "1"

  - name: "lazydocker"
    command: "lazydocker"
    cwd: "~/projects/myapp"
    env:
      DOCKER_HOST: "unix:///var/run/docker.sock"
```

### Conditional Behavior with Environment

**Debug mode toggle:**

```yaml
apps:
  # Production-like environment
  - name: "App (prod)"
    command: "npm"
    args: "run start"
    cwd: "~/projects/myapp"
    env:
      NODE_ENV: "production"
      LOG_LEVEL: "warn"

  # Debug environment  
  - name: "App (debug)"
    command: "npm"
    args: "run start"
    cwd: "~/projects/myapp"
    env:
      NODE_ENV: "development"
      LOG_LEVEL: "debug"
      DEBUG: "*"
```

**GPU/CUDA settings:**

```yaml
apps:
  - name: "ML Training"
    command: "python"
    args: "train.py"
    cwd: "~/projects/ml-model"
    env:
      CUDA_VISIBLE_DEVICES: "0"
      TF_CPP_MIN_LOG_LEVEL: "2"
```

**SSH agent forwarding:**

```yaml
apps:
  - name: "Remote Shell"
    command: "ssh"
    args: "-A user@server"
    env:
      SSH_AUTH_SOCK: "${SSH_AUTH_SOCK}"
```

### Tips for Advanced Configuration

- Environment variables set in `env` override system environment variables
- Use `${VAR}` syntax to reference your shell's environment variables
- `cwd` supports `~`, `<CONFIG_DIR>`, and `<STATE_DIR>` placeholders
- Relative paths in `args` are resolved relative to `cwd`
- For complex startup sequences, consider using a shell script as the command
- Test your environment setup by running `env` in a shell tab to see all variables
- Remember that `autostart: true` apps launch in the order they're defined

---

## TERM Settings for Compatibility

Some terminal applications require specific `TERM` environment variable settings to render correctly. This section covers common TERM-related issues and solutions.

### Why TERM Matters

The `TERM` variable tells applications what capabilities your terminal supports (colors, cursor movement, etc.). Apps that use advanced terminal features may misbehave if TERM is incorrect.

### Common TERM Values

| Value | Description | Use Case |
|-------|-------------|----------|
| `xterm-256color` | Standard 256-color xterm | Most modern TUI apps |
| `xterm-direct` | True color (24-bit) support | Apps with rich color themes |
| `screen-256color` | For use inside tmux/screen | Nested terminal sessions |
| `dumb` | No capabilities | Simple text output only |

### Default Setting (Recommended)

For most apps, `xterm-256color` provides the best compatibility:

```yaml
apps:
  - name: "Shell"
    command: "zsh"
    env:
      TERM: "xterm-256color"
```

### Apps with True Color Support

For apps that support 24-bit color (like Neovim with certain themes):

```yaml
apps:
  - name: "nvim"
    command: "nvim"
    cwd: "~/projects"
    env:
      TERM: "xterm-256color"
      COLORTERM: "truecolor"
```

**Note:** Some apps check `COLORTERM` separately from `TERM` for true color detection.

### Legacy Applications

Older applications may not handle modern TERM values well:

```yaml
apps:
  - name: "Legacy TUI"
    command: "oldapp"
    env:
      TERM: "vt100"  # Basic terminal emulation
```

Or for apps that expect Linux console:

```yaml
apps:
  - name: "Console App"
    command: "consoleapp"
    env:
      TERM: "linux"
```

### Nested Terminal Sessions

When running tuimux inside tmux or screen, or when running tmux/screen inside tuimux:

```yaml
apps:
  - name: "tmux"
    command: "tmux"
    env:
      TERM: "screen-256color"  # tmux expects this inside screen/tmux
```

For running inside tmux:

```yaml
apps:
  - name: "Inner Shell"
    command: "zsh"
    env:
      TERM: "tmux-256color"
```

### Apps with Specific Requirements

**htop** - works best with 256 colors:

```yaml
apps:
  - name: "htop"
    command: "htop"
    env:
      TERM: "xterm-256color"
```

**Neovim** - full color support:

```yaml
apps:
  - name: "nvim"
    command: "nvim"
    env:
      TERM: "xterm-256color"
      COLORTERM: "truecolor"
      NVIM_TUI_ENABLE_TRUE_COLOR: "1"
```

**Emacs in terminal** - requires 256 colors for themes:

```yaml
apps:
  - name: "emacs"
    command: "emacs"
    args: "-nw"  # No window (terminal mode)
    env:
      TERM: "xterm-256color"
```

**btop** - supports true color:

```yaml
apps:
  - name: "btop"
    command: "btop"
    env:
      TERM: "xterm-256color"
      COLORTERM: "truecolor"
```

**lazygit** - works with 256 colors:

```yaml
apps:
  - name: "lazygit"
    command: "lazygit"
    cwd: "~/projects/myrepo"
    env:
      TERM: "xterm-256color"
```

**Midnight Commander (mc)** - needs proper TERM for function keys:

```yaml
apps:
  - name: "mc"
    command: "mc"
    env:
      TERM: "xterm-256color"
      COLORTERM: "truecolor"
```

### Troubleshooting TERM Issues

**Symptom: Garbled or missing characters**

Try setting a simpler TERM:

```yaml
env:
  TERM: "xterm"  # Simpler than xterm-256color
```

**Symptom: No colors in output**

Ensure 256-color support:

```yaml
env:
  TERM: "xterm-256color"
```

**Symptom: Function keys (F1-F12) don't work**

Some apps need specific terminfo:

```yaml
env:
  TERM: "xterm-256color"
  # Or for mc specifically:
  TERM: "xterm"
```

**Symptom: Cursor invisible or wrong shape**

```yaml
env:
  TERM: "xterm-256color"
```

**Symptom: Mouse clicks not registering**

Ensure your TERM supports mouse:

```yaml
env:
  TERM: "xterm-256color"  # Has mouse support
```

### Finding the Right TERM

1. Start with `TERM: "xterm-256color"` (works for 95% of apps)
2. If colors are wrong, add `COLORTERM: "truecolor"`
3. If still broken, try `TERM: "xterm"` (fewer features, more compatible)
4. For very old apps, try `TERM: "vt100"` or `TERM: "dumb"`
5. Check the app's documentation for specific requirements

### Tips

- Most modern TUI apps work fine with `xterm-256color`
- If an app looks wrong, check its GitHub issues for TERM recommendations
- The `COLORTERM` variable is separate from `TERM` and enables true color
- You can check your terminal's capabilities with `tput colors` in a shell tab
- Some apps respect `FORCE_COLOR=1` to enable colors regardless of TERM
