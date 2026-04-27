import { describe, expect, test } from "bun:test"
import { getVisibleWindowOffset } from "./list-window"

describe("getVisibleWindowOffset", () => {
  test("keeps early selections at the start", () => {
    expect(getVisibleWindowOffset(0, 20, 10)).toBe(0)
    expect(getVisibleWindowOffset(9, 20, 10)).toBe(0)
  })

  test("scrolls just enough to keep the selection visible", () => {
    expect(getVisibleWindowOffset(10, 20, 10)).toBe(1)
    expect(getVisibleWindowOffset(15, 20, 10)).toBe(6)
  })

  test("clamps to the final visible page", () => {
    expect(getVisibleWindowOffset(99, 20, 10)).toBe(10)
  })
})
