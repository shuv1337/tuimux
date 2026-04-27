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
