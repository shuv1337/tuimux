export function getVisibleWindowOffset(
  selectedIndex: number,
  totalItems: number,
  visibleItems: number,
  currentOffset = 0
): number {
  if (totalItems <= 0 || visibleItems <= 0 || totalItems <= visibleItems) {
    return 0
  }

  const clampedIndex = Math.max(0, Math.min(selectedIndex, totalItems - 1))
  const maxOffset = totalItems - visibleItems
  const clampedOffset = Math.max(0, Math.min(currentOffset, maxOffset))

  if (clampedIndex < clampedOffset) {
    return clampedIndex
  }

  if (clampedIndex >= clampedOffset + visibleItems) {
    return Math.min(clampedIndex - visibleItems + 1, maxOffset)
  }

  return clampedOffset
}

export interface HWindow {
  start: number
  end: number
  hiddenBefore: number
  hiddenAfter: number
}

/**
 * Choose a contiguous run of items that fits within `available` columns and
 * ALWAYS includes `active`. `widths[i]` is the rendered column width of item i.
 * Greedily packs around `active`, alternating between adding to the left first
 * then the right. If everything fits, returns the full range.
 */
export function horizontalWindow(
  widths: number[],
  available: number,
  active: number
): HWindow {
  const n = widths.length
  if (n === 0) {
    return { start: 0, end: 0, hiddenBefore: 0, hiddenAfter: 0 }
  }

  const a = Math.max(0, Math.min(active, n - 1))

  let total = 0
  for (const w of widths) total += w
  if (total <= available) {
    return { start: 0, end: n, hiddenBefore: 0, hiddenAfter: 0 }
  }

  // Active is always shown, even if it alone exceeds `available`.
  let start = a
  let end = a + 1
  let used = Math.min(widths[a], available)
  let preferLeft = true

  while (true) {
    const canLeft = start > 0 && used + widths[start - 1] <= available
    const canRight = end < n && used + widths[end] <= available
    if (!canLeft && !canRight) break

    if (canLeft && (preferLeft || !canRight)) {
      used += widths[start - 1]
      start--
    } else if (canRight) {
      used += widths[end]
      end++
    }
    preferLeft = !preferLeft
  }

  return { start, end, hiddenBefore: start, hiddenAfter: n - end }
}
