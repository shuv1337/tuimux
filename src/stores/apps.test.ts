import { describe, expect, test } from "bun:test"
import { createAppsStore } from "./apps"

describe("createAppsStore", () => {
  test("removes app entries by id", () => {
    const store = createAppsStore([
      {
        id: "shell",
        name: "Shell",
        command: "bash",
        cwd: "~",
      },
      {
        id: "btop",
        name: "btop",
        command: "btop",
        cwd: "~",
      },
    ])

    store.removeEntry("shell")

    expect(store.store.entries.map((entry) => entry.id)).toEqual(["btop"])
  })
})
