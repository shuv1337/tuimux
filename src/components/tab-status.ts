import type { AppStatus } from "../types"
import type { Palette } from "../lib/palette"

/** Quiet one-column status mark: running is a slim rail, stopped recedes. */
export function getStatusIndicator(status: AppStatus): string {
  switch (status) {
    case "running":
      return "▏"
    case "stopped":
      return " "
    case "error":
      return "!"
  }
}

/** Status color, fully theme-driven (no hardcoded greens/reds). */
export function getStatusColor(status: AppStatus, theme: Palette): string {
  switch (status) {
    case "running":
      return theme.on
    case "stopped":
      return theme.off
    case "error":
      return theme.error
  }
}
