import { describe, expect, test } from "bun:test"
import { mkdtemp, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { stringify } from "yaml"
import { clearSession, initSessionPath, restoreSession, saveSession } from "./session"
import { defaultTheme } from "./theme"
import type { Config, SessionData } from "../types"

describe("session persistence", () => {
  test("saves and restores session data, including legacy format", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tuimux-session-"))
    const sessionFile = join(dir, "session.yaml")
    const config: Config = {
      version: 2,
      theme: defaultTheme,
      tab_width: 20,
      layout: "tabs",
      sidebar_position: "left",
      focus_on_launch: true,
      onboarding_completed: false,
      apps: [],
      session: { persist: true, file: sessionFile },
    }

    initSessionPath(config)

    const data: SessionData = {
      runningApps: [
        {
          id: "app-1",
          name: "Shell",
          command: "bash",
          cwd: "~",
        },
      ],
      activeTab: {
        id: "app-1",
        name: "Shell",
        command: "bash",
        cwd: "~",
      },
      timestamp: Date.now(),
    }

    await saveSession(data)
    const restored = await restoreSession()

    expect(restored).not.toBeNull()
    expect(restored?.runningApps.length).toBe(1)
    expect(restored?.activeTab && typeof restored.activeTab !== "string").toBe(true)

    const legacy = {
      runningApps: ["legacy-1", "legacy-2"],
      activeTab: "legacy-1",
      timestamp: Date.now(),
    }

    await writeFile(sessionFile, stringify(legacy), "utf-8")
    const legacyRestored = await restoreSession()
    expect(legacyRestored?.runningApps).toEqual(["legacy-1", "legacy-2"])
    expect(legacyRestored?.activeTab).toBe("legacy-1")
  })

  test("clears session data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tuimux-session-"))
    const sessionFile = join(dir, "session.yaml")
    const config: Config = {
      version: 2,
      theme: defaultTheme,
      tab_width: 20,
      layout: "tabs",
      sidebar_position: "left",
      focus_on_launch: true,
      onboarding_completed: false,
      apps: [],
      session: { persist: true, file: sessionFile },
    }

    initSessionPath(config)

    const data: SessionData = {
      runningApps: [
        {
          id: "app-1",
          name: "Shell",
          command: "bash",
          cwd: "~",
        },
      ],
      activeTab: "app-1",
      timestamp: Date.now(),
    }

    await saveSession(data)
    await clearSession()
    const restored = await restoreSession()

    expect(restored).toBeNull()
  })
})
