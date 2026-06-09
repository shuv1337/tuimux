import { describe, expect, test } from "bun:test"
import { getVisibleWindowOffset, horizontalWindow } from "./list-window"

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

describe("horizontalWindow", () => {
  test("returns the full range when everything fits", () => {
    const widths = [4, 5, 6, 3]
    const w = horizontalWindow(widths, 100, 2)
    expect(w).toEqual({ start: 0, end: 4, hiddenBefore: 0, hiddenAfter: 0 })
  })

  test("returns the full range when total exactly equals available", () => {
    const widths = [4, 5, 6, 3] // total 18
    const w = horizontalWindow(widths, 18, 0)
    expect(w).toEqual({ start: 0, end: 4, hiddenBefore: 0, hiddenAfter: 0 })
  })

  test("keeps the active item visible when active is in the middle", () => {
    const widths = Array(20).fill(5) // 100 total
    const active = 10
    const w = horizontalWindow(widths, 30, active)
    expect(active).toBeGreaterThanOrEqual(w.start)
    expect(active).toBeLessThan(w.end)
    // window must not exceed budget
    const used = widths.slice(w.start, w.end).reduce((s, x) => s + x, 0)
    expect(used).toBeLessThanOrEqual(30)
    expect(w.hiddenBefore).toBe(w.start)
    expect(w.hiddenAfter).toBe(20 - w.end)
  })

  test("keeps the active item visible when active is at index 0", () => {
    const widths = Array(20).fill(5)
    const w = horizontalWindow(widths, 30, 0)
    expect(w.start).toBe(0)
    expect(0).toBeLessThan(w.end)
    expect(w.hiddenBefore).toBe(0)
  })

  test("keeps the active item visible when active is at index n-1", () => {
    const widths = Array(20).fill(5)
    const active = 19
    const w = horizontalWindow(widths, 30, active)
    expect(w.end).toBe(20)
    expect(active).toBeGreaterThanOrEqual(w.start)
    expect(active).toBeLessThan(w.end)
    expect(w.hiddenAfter).toBe(0)
  })

  test("shows just the active item when it alone exceeds available", () => {
    const widths = [5, 50, 5]
    const w = horizontalWindow(widths, 10, 1)
    expect(w).toEqual({ start: 1, end: 2, hiddenBefore: 1, hiddenAfter: 1 })
  })

  test("returns an empty window for empty widths", () => {
    const w = horizontalWindow([], 10, 0)
    expect(w).toEqual({ start: 0, end: 0, hiddenBefore: 0, hiddenAfter: 0 })
  })

  test("handles uneven widths while keeping active visible", () => {
    const widths = [2, 20, 3, 8, 4, 15, 6, 9] // total 67
    const active = 4
    const w = horizontalWindow(widths, 20, active)
    expect(active).toBeGreaterThanOrEqual(w.start)
    expect(active).toBeLessThan(w.end)
    const used = widths.slice(w.start, w.end).reduce((s, x) => s + x, 0)
    expect(used).toBeLessThanOrEqual(20)
  })

  test("clamps an out-of-range active index", () => {
    const widths = Array(10).fill(5)
    const w = horizontalWindow(widths, 12, 99)
    // active clamps to 9, which must remain visible
    expect(9).toBeGreaterThanOrEqual(w.start)
    expect(9).toBeLessThan(w.end)
  })

  test("still returns a 1-item window when available is non-positive", () => {
    const widths = [5, 6, 7]
    const w = horizontalWindow(widths, 0, 1)
    expect(w.start).toBe(1)
    expect(w.end).toBe(2)
    expect(1).toBeGreaterThanOrEqual(w.start)
    expect(1).toBeLessThan(w.end)
  })
})
