import { describe, expect, test } from "bun:test"
import { ensureAppEntryIds } from "./config"
import { defaultTheme } from "./theme"
import type { Config } from "../types"

function makeConfig(apps: Config["apps"]): Config {
  return {
    version: 2,
    theme: defaultTheme,
    tab_width: 20,
    layout: "classic",
    apps,
    session: { persist: true },
  }
}

describe("ensureAppEntryIds", () => {
  test("preserves existing ids and reports no update", () => {
    const config = makeConfig([
      {
        id: "app-1",
        name: "Shell",
        command: "bash",
        cwd: "~",
      },
    ])

    const result = ensureAppEntryIds(config)
    expect(result.updated).toBe(false)
    expect(result.config.apps[0].id).toBe("app-1")
  })

  test("fills missing ids and resolves duplicates", () => {
    const config = makeConfig([
      {
        id: "dup",
        name: "Shell",
        command: "bash",
        cwd: "~",
      },
      {
        id: "dup",
        name: "htop",
        command: "htop",
        cwd: "~",
      },
      {
        name: "btop",
        command: "btop",
        cwd: "~",
      },
    ])

    const result = ensureAppEntryIds(config)
    const ids = result.config.apps.map((app) => app.id)

    expect(result.updated).toBe(true)
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.config.apps[0].id).toBe("dup")
  })
})
