import { describe, expect, test } from "bun:test"
import { extractOsc52 } from "./osc52"

describe("extractOsc52", () => {
  test("extracts a BEL-terminated set sequence and strips it from output", () => {
    const result = extractOsc52("before\x1b]52;c;aGVsbG8=\x07after")
    expect(result.sequences).toEqual(["\x1b]52;c;aGVsbG8=\x07"])
    expect(result.output).toBe("beforeafter")
    expect(result.pending).toBe("")
  })

  test("extracts an ST-terminated (ESC \\\\) sequence", () => {
    const result = extractOsc52("before\x1b]52;c;aGVsbG8=\x1b\\after")
    expect(result.sequences).toEqual(["\x1b]52;c;aGVsbG8=\x1b\\"])
    expect(result.output).toBe("beforeafter")
  })

  test("leaves plain output with no OSC 52 untouched", () => {
    const result = extractOsc52("just some regular terminal output\n")
    expect(result.sequences).toEqual([])
    expect(result.output).toBe("just some regular terminal output\n")
  })

  test("carries over a sequence split across chunk boundaries", () => {
    const first = extractOsc52("plain text\x1b]52;c;aGVs")
    expect(first.output).toBe("plain text")
    expect(first.pending).toBe("\x1b]52;c;aGVs")
    expect(first.sequences).toEqual([])

    const second = extractOsc52(first.pending + "bG8=\x07tail")
    expect(second.sequences).toEqual(["\x1b]52;c;aGVsbG8=\x07"])
    expect(second.output).toBe("tail")
    expect(second.pending).toBe("")
  })

  test("carries over even a lone partial ESC ] 5 2 ; prefix", () => {
    const first = extractOsc52("x\x1b]5")
    expect(first.output).toBe("x")
    expect(first.pending).toBe("\x1b]5")
  })

  test("handles multiple sequences in one chunk", () => {
    const result = extractOsc52("\x1b]52;c;AA==\x07mid\x1b]52;c;Bg==\x07")
    expect(result.sequences).toEqual(["\x1b]52;c;AA==\x07", "\x1b]52;c;Bg==\x07"])
    expect(result.output).toBe("mid")
  })

  test("passes through the query form (?) as a sequence too — forwarding, not answering, it", () => {
    const result = extractOsc52("\x1b]52;c;?\x07")
    expect(result.sequences).toEqual(["\x1b]52;c;?\x07"])
    expect(result.output).toBe("")
  })
})
