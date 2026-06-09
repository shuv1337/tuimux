import type { Subprocess, Terminal } from "bun"
import { expandPath } from "./config"
import { buildEntryCommand } from "./command"
import type { AppEntry } from "../types"

export interface PtyOptions {
  cols?: number
  rows?: number
}

export interface PtyProcess {
  terminal: Terminal
  proc: Subprocess<any, any, any>
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
  onData: (callback: (data: string) => void) => void
  onExit: (callback: (info: { exitCode: number; signal: number }) => void) => void
  pid: number
}

// List of common shells that need interactive mode
const INTERACTIVE_SHELLS = ["bash", "zsh", "fish", "sh", "dash", "ksh", "tcsh", "csh"]

const DEFAULT_FG = "#c0caf5"
const DEFAULT_BG = "#1a1b26"

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const chars = trimmed.slice(1).split("")
    return `#${chars.map((c) => c + c).join("")}`.toLowerCase()
  }
  return fallback
}

function hexToOscRgb(hex: string): string {
  const normalized = normalizeHexColor(hex, DEFAULT_BG).slice(1)
  const r = normalized.slice(0, 2)
  const g = normalized.slice(2, 4)
  const b = normalized.slice(4, 6)
  return `rgb:${r}/${g}/${b}`
}

function buildColorResponse(code: "10" | "11", hex: string): string {
  return `\u001b]${code};${hexToOscRgb(hex)}\u001b\\`
}

function buildCursorPositionReport(): string {
  return "\u001b[1;1R"
}

function stripTerminalQueries(
  input: string,
  colors: { fg: string; bg: string }
): { output: string; responses: string[]; pending: string } {
  let output = ""
  const responses: string[] = []
  let i = 0
  const prefixes = ["\u001b[6n", "\u001b[?6n", "\u001b]10;?", "\u001b]11;?"]

  while (i < input.length) {
    const char = input[i]
    if (char !== "\u001b") {
      output += char
      i += 1
      continue
    }

    const remaining = input.slice(i)
    const hasPartialPrefix = prefixes.some(
      (prefix) => prefix.startsWith(remaining) && remaining.length < prefix.length
    )
    if (hasPartialPrefix) {
      return { output, responses, pending: remaining }
    }

    const next = input[i + 1]
    if (next === "[") {
      if (input.startsWith("\u001b[6n", i)) {
        responses.push(buildCursorPositionReport())
        i += 4
        continue
      }
      if (input.startsWith("\u001b[?6n", i)) {
        responses.push(buildCursorPositionReport())
        i += 5
        continue
      }
    }

    if (next === "]") {
      if (input.startsWith("\u001b]10;?", i) || input.startsWith("\u001b]11;?", i)) {
        const isForeground = input.startsWith("\u001b]10;?", i)
        const terminatorIndex = input.indexOf("\u0007", i + 5)
        const stIndex = input.indexOf("\u001b\\", i + 5)
        let endIndex = -1
        let terminatorLength = 0

        if (terminatorIndex !== -1) {
          endIndex = terminatorIndex
          terminatorLength = 1
        } else if (stIndex !== -1) {
          endIndex = stIndex
          terminatorLength = 2
        } else {
          return { output, responses, pending: input.slice(i) }
        }

        responses.push(buildColorResponse(isForeground ? "10" : "11", isForeground ? colors.fg : colors.bg))
        i = endIndex + terminatorLength
        continue
      }
    }

    output += char
    i += 1
  }

  return { output, responses, pending: "" }
}

/**
 * Build a command string for shell execution.
 */
function buildCommandString(command: string): string {
  const trimmed = command.trim()
  if (!trimmed.includes(" ") && INTERACTIVE_SHELLS.includes(trimmed)) {
    return `${trimmed} -i`
  }
  return trimmed
}

/**
 * Parse a command string into program and arguments
 */
function parseCommand(command: string): { program: string; args: string[] } {
  const trimmed = command.trim()

  // Simple case: single word command (bash, htop, etc.)
  if (!trimmed.includes(" ")) {
    // For shells, force interactive mode to prevent SIGHUP exits
    if (INTERACTIVE_SHELLS.includes(trimmed)) {
      return { program: trimmed, args: ["-i"] }
    }
    return { program: trimmed, args: [] }
  }

  // Complex command: use shell to execute
  const shell = process.env.SHELL || "/bin/sh"
  return { program: shell, args: ["-c", trimmed] }
}

/**
 * Spawn a PTY for an app entry using Bun's native PTY support
 */
export function spawnPty(
  entry: AppEntry,
  options: PtyOptions = {}
): PtyProcess {
  const { cols = 80, rows = 24 } = options
  const cwd = expandPath(entry.cwd)

  const colorOverrides = {
    fg: normalizeHexColor(entry.env?.TUIDISCOPE_FG ?? process.env.TUIDISCOPE_FG, DEFAULT_FG),
    bg: normalizeHexColor(entry.env?.TUIDISCOPE_BG ?? process.env.TUIDISCOPE_BG, DEFAULT_BG),
  }

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TERM: "xterm-256color",
    COLUMNS: String(cols),
    LINES: String(rows),
    ...entry.env,
  }

  // Bun.Terminal provides a real PTY, but it does NOT make the spawned process a
  // session leader with that PTY as its controlling terminal. Apps that read the
  // PTY slave via stdin (htop, btop, …) work fine, but apps that open /dev/tty
  // directly (lazydocker/gocui, and other ncurses/tcell apps) fail with
  // "open /dev/tty: no such device or address". Wrapping with `setsid -c` starts
  // the child in a new session and sets the PTY as its controlling terminal,
  // fixing /dev/tty without adding a second PTY layer — so live resize
  // (TIOCSWINSZ) still reaches the inner app, unlike the old `script` wrapper.
  // Opt out with TUIDISCOPE_NO_SETSID=1. The legacy `script` wrapper (which broke
  // resize) remains available behind TUIDISCOPE_USE_SCRIPT=1.
  const useScript = process.platform !== "win32" && !!process.env.TUIDISCOPE_USE_SCRIPT
  const useSetsid =
    process.platform === "linux" && !process.env.TUIDISCOPE_NO_SETSID && !useScript
  const entryCommand = buildEntryCommand(entry)
  const commandString = buildCommandString(entryCommand)
  const { program, args } = parseCommand(entryCommand)

  let spawnProgram: string
  let spawnArgs: string[]

  if (useScript) {
    spawnProgram = "script"
    if (process.platform === "darwin") {
      // macOS: script -q /dev/null command args...
      spawnArgs = ["-q", "/dev/null", program, ...args]
    } else {
      // Linux: script -q -c "command" /dev/null
      spawnArgs = ["-q", "-c", commandString, "/dev/null"]
    }
  } else if (useSetsid) {
    // setsid -c <program> <args...> : new session + controlling tty on the PTY
    spawnProgram = "setsid"
    spawnArgs = ["-c", program, ...args]
  } else {
    spawnProgram = program
    spawnArgs = args
  }

  // Callbacks storage
  let dataCallback: ((data: string) => void) | null = null
  let exitCallback: ((info: { exitCode: number; signal: number }) => void) | null = null

  let pendingControl = ""

  // Create terminal with callbacks
  const terminal = new Bun.Terminal({
    cols,
    rows,
    data(_term, data) {
      const str = typeof data === "string" ? data : new TextDecoder().decode(data)
      const parsed = stripTerminalQueries(pendingControl + str, colorOverrides)
      pendingControl = parsed.pending

      if (parsed.responses.length > 0) {
        terminal.write(parsed.responses.join(""))
      }

      if (dataCallback && parsed.output.length > 0) {
        dataCallback(parsed.output)
      }
    },
    exit(_term) {
      // We'll handle exit via proc.exited
    },
  })

  // Spawn the process with the terminal
  const proc = Bun.spawn([spawnProgram, ...spawnArgs], {
    terminal,
    cwd,
    env,
  })

  // Handle process exit
  proc.exited.then((exitCode) => {
    if (exitCallback) {
      exitCallback({ exitCode, signal: 0 })
    }
  }).catch(() => {
    if (exitCallback) {
      exitCallback({ exitCode: 1, signal: 0 })
    }
  })

  const ptyProcess: PtyProcess = {
    terminal,
    proc,
    pid: proc.pid,

    write(data: string) {
      terminal.write(data)
    },

    resize(cols: number, rows: number) {
      terminal.resize(cols, rows)
    },

    kill() {
      proc.kill()
      terminal.close()
    },

    onData(callback: (data: string) => void) {
      dataCallback = callback
    },

    onExit(callback: (info: { exitCode: number; signal: number }) => void) {
      exitCallback = callback
    },
  }

  return ptyProcess
}

/**
 * Resize a PTY
 */
export function resizePty(ptyProcess: PtyProcess, cols: number, rows: number): void {
  ptyProcess.resize(cols, rows)
}

/**
 * Kill a PTY process
 */
export function killPty(ptyProcess: PtyProcess): void {
  ptyProcess.kill()
}
