export function getVisibleWindowOffset(
  selectedIndex: number,
  totalItems: number,
  visibleItems: number
): number {
  if (totalItems <= 0 || visibleItems <= 0 || totalItems <= visibleItems) {
    return 0
  }

  const clampedIndex = Math.max(0, Math.min(selectedIndex, totalItems - 1))
  const maxOffset = totalItems - visibleItems

  if (clampedIndex < visibleItems) {
    return 0
  }

  return Math.min(clampedIndex - visibleItems + 1, maxOffset)
}
