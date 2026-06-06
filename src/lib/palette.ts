import type { ThemeConfig } from "../types"

/**
 * The resolved palette consumed by every UI component.
 *
 * A theme on disk is only 5 tokens (primary/background/foreground/accent/muted).
 * At runtime we derive a richer "graphite" ramp from those — a tight dark surface
 * ladder (bg -> surface -> surfaceAlt are "whispers apart"), a sparse accent, and
 * desaturated pastel semantics. The 5 base tokens are kept as aliases so the
 * resolved palette is a superset of ThemeConfig (no migration, drop-in for old props).
 *
 * Design language ported from shuvbot-skills/tui/src/tui/theme.ts: "rich but calm".
 */
export interface Palette extends ThemeConfig {
  // surface ramp (keep the steps TIGHT — this is what reads as calm)
  bg: string // app background
  surface: string // panels, headers (1 shade up)
  surfaceAlt: string // chrome bars, selected row, modals (1 shade up again)
  // structure
  border: string // dim resting borders / separators
  borderFocus: string // focused pane / modal border (bright)
  accentMuted: string // selected-cell bg, desaturated accent
  // text
  text: string // primary text (= foreground)
  textDim: string // secondary / inactive text (= muted)
  // semantic status (desaturated on purpose)
  on: string // running / ok (soft green)
  off: string // stopped / recedes (= muted)
  warn: string // warning (muted amber)
  error: string // error / failed (soft red)
}

// Functional status colors. These carry meaning rather than brand, so they stay
// fixed pastels across every theme (replaces the old hardcoded greens/reds).
const SEMANTICS = {
  on: "#88d39b",
  warn: "#e6cf98",
  error: "#f0a0a0",
} as const

/**
 * Per-channel lerp between two hex colors. ratio=0 -> bg, ratio=1 -> fg.
 * Expects 6-digit `#rrggbb`. (ported from shuvbot-skills/tui/src/tui/theme.ts)
 */
export function blendHex(fg: string, bg: string, ratio: number): string {
  const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = channels(fg)
  const b = channels(bg)
  const m = a.map((x, i) => Math.round(b[i]! + (x - b[i]!) * ratio))
  return "#" + m.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")
}

// Cache resolved palettes by base-token identity so we don't re-derive per render.
const cache = new Map<string, Palette>()

/** Derive the full graphite-style ramp from a 5-token theme. */
export function resolveTheme(theme: ThemeConfig): Palette {
  const key = `${theme.primary}|${theme.background}|${theme.foreground}|${theme.accent}|${theme.muted}`
  const hit = cache.get(key)
  if (hit) return hit

  const bg = theme.background
  const fg = theme.foreground

  const palette: Palette = {
    ...theme,
    bg,
    surface: blendHex(fg, bg, 0.04),
    surfaceAlt: blendHex(fg, bg, 0.08),
    border: blendHex(fg, bg, 0.18),
    borderFocus: blendHex(fg, bg, 0.82),
    accentMuted: blendHex(theme.accent, bg, 0.3),
    text: fg,
    textDim: theme.muted,
    on: SEMANTICS.on,
    off: theme.muted,
    warn: SEMANTICS.warn,
    error: SEMANTICS.error,
  }

  cache.set(key, palette)
  return palette
}
