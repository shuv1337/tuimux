import { closeSync, openSync, writeSync } from "fs"

const OSC52_PREFIX = "\x1b]52;"
const BEL = "\x07"
const ST = "\x1b\\"

export interface Osc52ExtractResult {
  /** Input with any OSC 52 sequences removed. */
  output: string
  /** Raw OSC 52 sequences found, in order, each still terminator-including. */
  sequences: string[]
  /** Bytes of a sequence that started but wasn't terminated in this chunk. */
  pending: string
}

/**
 * Split OSC 52 clipboard sequences (both the BEL- and ST-terminated forms)
 * out of a raw PTY output chunk. `pending` carries over into the next call
 * when a sequence is split across chunk boundaries, mirroring how
 * `stripTerminalQueries` in pty.ts handles the same problem for cursor/color
 * queries.
 */
export function extractOsc52(input: string): Osc52ExtractResult {
  let output = ""
  const sequences: string[] = []
  let i = 0

  while (i < input.length) {
    const char = input[i]
    if (char !== "\x1b") {
      output += char
      i += 1
      continue
    }

    const remaining = input.slice(i)
    if (OSC52_PREFIX.startsWith(remaining) && remaining.length < OSC52_PREFIX.length) {
      return { output, sequences, pending: remaining }
    }

    if (!input.startsWith(OSC52_PREFIX, i)) {
      output += char
      i += 1
      continue
    }

    const belIndex = input.indexOf(BEL, i + OSC52_PREFIX.length)
    const stIndex = input.indexOf(ST, i + OSC52_PREFIX.length)
    let endIndex = -1
    let terminatorLength = 0

    if (belIndex !== -1 && (stIndex === -1 || belIndex < stIndex)) {
      endIndex = belIndex
      terminatorLength = 1
    } else if (stIndex !== -1) {
      endIndex = stIndex
      terminatorLength = 2
    } else {
      return { output, sequences, pending: input.slice(i) }
    }

    sequences.push(input.slice(i, endIndex + terminatorLength))
    i = endIndex + terminatorLength
  }

  return { output, sequences, pending: "" }
}

let ttyFd: number | null | undefined

/**
 * The session-server (src/lib/session-server.ts) runs fully detached with
 * stdio ignored — it has no terminal of its own, so OSC 52 can't be
 * relayed from there. This client process is the only one attached to the
 * real terminal tuimux was launched inside (a bare terminal, or Herdr/Zellij/
 * tmux acting as the parent), so it's the narrowest layer that can bounce a
 * clipboard write upward. We open /dev/tty directly rather than writing to
 * process.stdout because opentui's renderer intercepts stdout.write to
 * capture stray console output for its own overlay — going through it would
 * swallow the escape sequence instead of forwarding it.
 */
function getTtyFd(): number | null {
  if (ttyFd !== undefined) return ttyFd
  try {
    ttyFd = openSync("/dev/tty", "w")
  } catch {
    ttyFd = null
  }
  return ttyFd
}

/** Forward a raw escape sequence to the real terminal, bypassing opentui. */
export function forwardToRealTerminal(sequence: string): void {
  const fd = getTtyFd()
  if (fd === null) return
  try {
    writeSync(fd, sequence)
  } catch {
    // The tty went away (detached, closed) — stop trying until re-checked.
    try {
      closeSync(fd)
    } catch {
      // already gone
    }
    ttyFd = null
  }
}

/** Test-only hook to reset the cached fd between test cases. */
export function __resetTtyForTesting(): void {
  ttyFd = undefined
}
