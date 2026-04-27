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

  test("keeps the current offset when the selection remains visible", () => {
    expect(getVisibleWindowOffset(9, 20, 10, 1)).toBe(1)
    expect(getVisibleWindowOffset(11, 20, 10, 2)).toBe(2)
  })

  test("scrolls up only when the selection leaves the visible window", () => {
    expect(getVisibleWindowOffset(4, 20, 10, 5)).toBe(4)
  })

  test("clamps to the final visible page", () => {
    expect(getVisibleWindowOffset(99, 20, 10)).toBe(10)
  })
})
