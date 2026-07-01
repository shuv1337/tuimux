import { describe, expect, test } from "bun:test"
import { killPty, spawnPty } from "./pty"
import type { AppEntry } from "../types"

/**
 * End-to-end regression coverage for the paste/OSC 52 fix using a real
 * spawned PTY (not just the pure string-parsing units in pty.test.ts /
 * osc52.test.ts). This is the closest thing to a reproduction we can run
 * headlessly — it doesn't exercise a live nested Herdr/Zellij terminal (no
 * attached tty in this environment), but it does prove bracketed-paste
 * wrapping and OSC 52 passthrough survive a real child process round trip.
 */

function makeEntry(command: string): AppEntry {
  return {
    id: `test-${command}-${Math.random().toString(36).slice(2)}`,
    name: "test",
    command,
    cwd: process.cwd(),
    autostart: false,
    restartOnExit: false,
  }
}

async function collectUntil(
  onData: (callback: (data: string) => void) => void,
  predicate: (buffer: string) => boolean,
  timeoutMs = 3000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ""
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for output. Got: ${JSON.stringify(buffer)}`)), timeoutMs)
    onData((data) => {
      buffer += data
      if (predicate(buffer)) {
        clearTimeout(timer)
        resolve(buffer)
      }
    })
  })
}

describe("pty writePaste — real child process", () => {
  // `stty -echo -icanon` disables the kernel tty line discipline's own local
  // echo (which would duplicate everything we write on top of `cat`'s own
  // copy-through) and canonical line buffering (which would hold back our
  // paste's un-terminated last line until a newline arrived) — artifacts of
  // using a plain, non-fullscreen program as the test "app", not something
  // real terminal-attached apps (which run in raw mode themselves) hit.
  test("wraps pasted text in bracketed-paste markers once the child enables it", async () => {
    const pty = spawnPty(makeEntry(`bash -c 'stty -echo -icanon; printf "\\x1b[?2004h"; cat'`))
    try {
      await collectUntil(pty.onData, (buf) => buf.includes("\x1b[?2004h"))

      pty.writePaste("echo one\necho two")
      const echoed = await collectUntil(pty.onData, (buf) => buf.includes("\x1b[201~"))

      expect(echoed).toContain("\x1b[200~echo one\r\necho two\x1b[201~")
    } finally {
      killPty(pty)
    }
  })

  test("sends raw text when the child never enabled bracketed paste", async () => {
    const pty = spawnPty(makeEntry("bash -c 'stty -echo -icanon; cat'"))
    try {
      pty.writePaste("plain paste, no markers")
      const echoed = await collectUntil(pty.onData, (buf) => buf.includes("plain paste, no markers"))

      expect(echoed).not.toContain("\x1b[200~")
      expect(echoed).not.toContain("\x1b[201~")
    } finally {
      killPty(pty)
    }
  })
})

describe("pty output — OSC 52 passthrough", () => {
  test("an OSC 52 sequence written by the child reaches onData untouched", async () => {
    const pty = spawnPty(makeEntry(`bash -c 'printf "\\x1b]52;c;aGVsbG8=\\x07"'`))
    try {
      const output = await collectUntil(pty.onData, (buf) => buf.includes("\x07"))
      expect(output).toContain("\x1b]52;c;aGVsbG8=\x07")
    } finally {
      killPty(pty)
    }
  })
})
