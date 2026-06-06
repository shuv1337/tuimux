// Responsive width handling: a coarse layout mode + a self-fitting keybind bar.
// Modeled on shuvbot-skills/tui/src/tui/{layout.ts,Footer.tsx}. The status bar
// renders the widest hint tier that fits the terminal, downgrading as it narrows
// so hints never wrap onto a second line.

export type WidthMode = "full" | "compact" | "minimum"

// Below COMPACT_MAX -> compact; below MINIMUM_MAX -> minimum (sidebar collapses).
export const COMPACT_MAX = 80
export const MINIMUM_MAX = 56

export function widthMode(cols: number): WidthMode {
  if (cols < MINIMUM_MAX) return "minimum"
  if (cols < COMPACT_MAX) return "compact"
  return "full"
}

export interface Hint {
  key: string
  label: string
}

// Rendered width of a hint set: "key label" pairs joined by two spaces.
export function hintsWidth(hints: Hint[]): number {
  return hints.reduce(
    (sum, h, i) => sum + h.key.length + 1 + h.label.length + (i > 0 ? 2 : 0),
    0,
  )
}

/**
 * Pick the widest hint tier that fits within `cols` (minus a small reserve for
 * the center message + right focus tag). `tiers` is ordered widest-first; the
 * last tier is the floor when nothing else fits.
 */
export function fitHints(cols: number, tiers: Hint[][], reserve = 22): Hint[] {
  const budget = Math.max(0, cols - reserve)
  for (const tier of tiers) {
    if (hintsWidth(tier) <= budget) return tier
  }
  return tiers[tiers.length - 1] ?? []
}
