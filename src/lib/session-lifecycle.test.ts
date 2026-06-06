import { describe, expect, test } from "bun:test"
import { handleTabsRunExit, type TabsExitedRunState } from "./session-lifecycle"

function makeRun(restartOnExit: boolean): TabsExitedRunState {
  return {
    status: "running",
    restartEntry: { restartOnExit },
  }
}

describe("handleTabsRunExit", () => {
  test("clears stale running state before auto-restart", () => {
    const runningApps = new Map([["app-1", makeRun(true)]])
    const pendingOutputs = new Map([["app-1", { data: "" }]])

    const result = handleTabsRunExit(runningApps, pendingOutputs, "app-1", 1, false)

    expect(result).toEqual({ status: "error", shouldRestart: true })
    expect(runningApps.has("app-1")).toBe(false)
    expect(pendingOutputs.has("app-1")).toBe(false)
  })

  test("preserves manual stops and does not restart", () => {
    const run = makeRun(true)
    const runningApps = new Map([["app-1", run]])
    const pendingOutputs = new Map([["app-1", { data: "" }]])

    const result = handleTabsRunExit(runningApps, pendingOutputs, "app-1", 1, true)

    expect(result).toEqual({ status: "error", shouldRestart: false })
    expect(runningApps.get("app-1")).toBe(run)
    expect(pendingOutputs.has("app-1")).toBe(true)
  })

  test("does not restart successful exits", () => {
    const run = makeRun(true)
    const runningApps = new Map([["app-1", run]])
    const pendingOutputs = new Map([["app-1", { data: "" }]])

    const result = handleTabsRunExit(runningApps, pendingOutputs, "app-1", 0, false)

    expect(result).toEqual({ status: "stopped", shouldRestart: false })
    expect(runningApps.get("app-1")?.status).toBe("stopped")
  })
})
