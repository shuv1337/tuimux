import type { ThemeConfig } from "../types"

// Default Graphite theme: a tight dark surface ramp + sparse cyan accent.
// See src/lib/palette.ts for how the rich ramp is derived from these 5 tokens.
export const defaultTheme: ThemeConfig = {
  primary: "#7fd1ff",     // Cyan - selections, highlights
  background: "#111315",  // Near-black graphite
  foreground: "#f2f4f6",  // Neutral white text
  accent: "#7fd1ff",      // Cyan - active indicators
  muted: "#9aa4af",       // Cool gray for inactive elements
}

/**
 * Parse a hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Create ANSI escape code for a hex color (foreground)
 */
export function hexToAnsiFg(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return ""
  return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`
}

/**
 * Create ANSI escape code for a hex color (background)
 */
export function hexToAnsiBg(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return ""
  return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`
}

/**
 * Reset ANSI styling
 */
export const ansiReset = "\x1b[0m"

/**
 * Apply theme colors to text
 */
export function styled(text: string, fg?: string, bg?: string): string {
  let result = ""
  if (fg) result += hexToAnsiFg(fg)
  if (bg) result += hexToAnsiBg(bg)
  result += text
  result += ansiReset
  return result
}
