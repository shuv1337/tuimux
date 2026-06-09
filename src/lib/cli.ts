/**
 * CLI argument parsing for tuimux
 */
import packageJson from "../../package.json"

export interface CLIOptions {
  help: boolean
  version: boolean
  debug: boolean
  add: boolean
  server: boolean
  noDefaultWindow: boolean
  noAutostart: boolean
  shutdown: boolean
  layout?: "tabs" | "panes"
  unknown: string[]
}

const VERSION = packageJson.version

const HELP_TEXT = `tuimux - A TUI multiplexer for managing terminal applications

Usage: tuimux [options]

Options:
  -h, --help       Show this help message and exit
  -v, --version    Show version number and exit
  -d, --debug      Enable debug logging (writes to state dir)
  -a, --add        Launch directly into the add app wizard
      --layout     Override layout mode (tabs|panes)
      --server     Start the session server (internal use)
      --shutdown   Shutdown session server and clear session state

Keyboard shortcuts (in tabs mode):
  j/k or ↑/↓       Navigate between apps
  Enter            Start/switch to selected app
  Space            Open command palette
  t                Add new app
  e                Edit selected app
  x                Stop selected app
  r                Restart selected app
  q                Quit (detach from session)
  Q (shift+q)      Shutdown session server
  Ctrl+a           Toggle between tabs and terminal mode

In terminal mode:
  Ctrl+a           Switch back to tabs mode
  Ctrl+a Ctrl+a    Send Ctrl+a to the terminal

For more information, visit: https://github.com/shuv1337/tuimux
`

/**
 * Parse CLI arguments
 */
export function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2) // Skip node/bun and script path

  const options: CLIOptions = {
    help: false,
    version: false,
    debug: false,
    add: false,
    server: false,
    noDefaultWindow: false,
    noAutostart: false,
    shutdown: false,
    layout: undefined,
    unknown: [],
  }

  const parseLayout = (value: string | undefined) => {
    if (value === "tabs" || value === "panes") {
      options.layout = value
      return true
    }
    if (value === "classic") {
      options.layout = "tabs"
      return true
    }
    if (value === "zellij") {
      options.layout = "panes"
      return true
    }
    return false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true
        break
      case "-v":
      case "--version":
        options.version = true
        break
      case "-d":
      case "--debug":
        options.debug = true
        break
      case "-a":
      case "--add":
        options.add = true
        break
      case "--server":
        options.server = true
        break
      case "--no-default-window":
        options.noDefaultWindow = true
        break
      case "--no-autostart":
        options.noAutostart = true
        break
      case "--shutdown":
        options.shutdown = true
        break
      default:
        if (arg === "--layout") {
          const value = args[index + 1]
          if (!parseLayout(value)) {
            options.unknown.push(arg)
          } else {
            index += 1
          }
          break
        }
        if (arg.startsWith("--layout=")) {
          const value = arg.slice("--layout=".length)
          if (!parseLayout(value)) {
            options.unknown.push(arg)
          }
          break
        }
        if (arg.startsWith("-")) {
          options.unknown.push(arg)
        }
        break
    }
  }

  return options
}

/**
 * Print help message and exit
 */
export function printHelp(): void {
  console.log(HELP_TEXT)
}

/**
 * Print version and exit
 */
export function printVersion(): void {
  console.log(`tuimux ${VERSION}`)
}

/**
 * Print error for unknown flags and exit
 */
export function printUnknownFlags(flags: string[]): void {
  console.error(`Unknown option${flags.length > 1 ? "s" : ""}: ${flags.join(", ")}`)
  console.error(`Try 'tuimux --help' for more information.`)
}
