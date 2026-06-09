import { describe, expect, test } from "bun:test"
import { parseArgs } from "./cli"

// parseArgs slices off the first two argv entries (runtime + script path).
const parse = (...args: string[]) => parseArgs(["bun", "index.tsx", ...args])

describe("parseArgs", () => {
  test("defaults: internal flags off, no unknowns", () => {
    const o = parse()
    expect(o.server).toBe(false)
    expect(o.noDefaultWindow).toBe(false)
    expect(o.noAutostart).toBe(false)
    expect(o.layout).toBeUndefined()
    expect(o.unknown).toEqual([])
  })

  test("--server", () => {
    expect(parse("--server").server).toBe(true)
  })

  // Internal flags used by the client when respawning the server during a
  // layout switch — must parse and must NOT land in unknown[].
  test("--no-default-window sets the flag and is not unknown", () => {
    const o = parse("--no-default-window")
    expect(o.noDefaultWindow).toBe(true)
    expect(o.unknown).toEqual([])
  })

  test("--no-autostart sets the flag and is not unknown", () => {
    const o = parse("--no-autostart")
    expect(o.noAutostart).toBe(true)
    expect(o.unknown).toEqual([])
  })

  test("--layout accepts current values", () => {
    expect(parse("--layout", "tabs").layout).toBe("tabs")
    expect(parse("--layout", "panes").layout).toBe("panes")
  })

  test("--layout normalizes legacy aliases", () => {
    expect(parse("--layout", "classic").layout).toBe("tabs")
    expect(parse("--layout", "zellij").layout).toBe("panes")
  })

  test("--layout=value form works", () => {
    expect(parse("--layout=panes").layout).toBe("panes")
    expect(parse("--layout=zellij").layout).toBe("panes")
  })

  test("invalid --layout value is reported as unknown", () => {
    const o = parse("--layout", "sideways")
    expect(o.layout).toBeUndefined()
    expect(o.unknown).toContain("--layout")
  })

  test("unknown flags are collected", () => {
    expect(parse("--bogus").unknown).toContain("--bogus")
  })

  test("a full switch-respawn invocation parses cleanly", () => {
    const o = parse("--server", "--layout", "panes", "--no-default-window", "--no-autostart")
    expect(o.server).toBe(true)
    expect(o.layout).toBe("panes")
    expect(o.noDefaultWindow).toBe(true)
    expect(o.noAutostart).toBe(true)
    expect(o.unknown).toEqual([])
  })
})
