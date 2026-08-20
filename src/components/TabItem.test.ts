import { describe, expect, test } from "bun:test"
import { getStatusIndicator } from "./tab-status"

describe("getStatusIndicator", () => {
  test("uses a quiet rail only for running apps", () => {
    expect(getStatusIndicator("running")).toBe("▏")
    expect(getStatusIndicator("stopped")).toBe(" ")
  })

  test("keeps errors explicit", () => {
    expect(getStatusIndicator("error")).toBe("!")
  })
})
