import { describe, expect, test } from "bun:test"
import { stripTerminalQueries, wrapForPaste, type PasteModeState } from "./pty"

const COLORS = { fg: "#c0caf5", bg: "#1a1b26" }

function freshPasteMode(): PasteModeState {
  return { enabled: false }
}

describe("stripTerminalQueries — cursor/color queries (unchanged behavior)", () => {
  test("still answers a cursor position query", () => {
    const result = stripTerminalQueries("\x1b[6n", COLORS, freshPasteMode())
    expect(result.responses).toEqual(["\x1b[1;1R"])
    expect(result.output).toBe("")
  })

  test("passes through unrelated output untouched", () => {
    const result = stripTerminalQueries("hello world\n", COLORS, freshPasteMode())
    expect(result.output).toBe("hello world\n")
    expect(result.responses).toEqual([])
  })
})

describe("stripTerminalQueries — bracketed paste mode tracking", () => {
  test("enabling bracketed paste flips the tracked state and passes the sequence through", () => {
    const pasteMode = freshPasteMode()
    const result = stripTerminalQueries("\x1b[?2004h", COLORS, pasteMode)
    expect(pasteMode.enabled).toBe(true)
    expect(result.output).toBe("\x1b[?2004h")
    expect(result.responses).toEqual([])
  })

  test("disabling bracketed paste flips it back off", () => {
    const pasteMode: PasteModeState = { enabled: true }
    const result = stripTerminalQueries("\x1b[?2004l", COLORS, pasteMode)
    expect(pasteMode.enabled).toBe(false)
    expect(result.output).toBe("\x1b[?2004l")
  })

  test("state survives interleaved with regular output", () => {
    const pasteMode = freshPasteMode()
    stripTerminalQueries("some prompt text\x1b[?2004h", COLORS, pasteMode)
    expect(pasteMode.enabled).toBe(true)
  })

  test("a mode toggle split across two chunks is still detected", () => {
    const pasteMode = freshPasteMode()
    const first = stripTerminalQueries("\x1b[?200", COLORS, pasteMode)
    expect(first.pending).toBe("\x1b[?200")
    expect(pasteMode.enabled).toBe(false)

    const second = stripTerminalQueries(first.pending + "4h", COLORS, pasteMode)
    expect(pasteMode.enabled).toBe(true)
    expect(second.pending).toBe("")
  })
})

describe("wrapForPaste", () => {
  test("wraps in bracketed-paste markers when the child enabled it", () => {
    expect(wrapForPaste("hello\nworld", true)).toBe("\x1b[200~hello\nworld\x1b[201~")
  })

  test("sends raw text unwrapped when the child never enabled bracketed paste", () => {
    expect(wrapForPaste("hello\nworld", false)).toBe("hello\nworld")
  })

  test("does not execute newlines eagerly — wrapped multi-line paste is one payload", () => {
    // Regression for AC: "accidental command execution outside the target".
    // A bash with readline bracketed-paste support treats everything between
    // the markers as literal input, not per-line Enter presses.
    const wrapped = wrapForPaste("echo one\necho two\n", true)
    expect(wrapped.startsWith("\x1b[200~")).toBe(true)
    expect(wrapped.endsWith("\x1b[201~")).toBe(true)
    expect(wrapped).toContain("echo one\necho two\n")
  })
})
