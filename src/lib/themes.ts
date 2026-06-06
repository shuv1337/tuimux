import type { ThemeConfig } from "../types"

export interface ThemePreset extends ThemeConfig {
  id: string
  name: string
}

/** Validates a hex color string (e.g., "#82aaff") */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color)
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "graphite",
    name: "Graphite",
    primary: "#7fd1ff",     // Cyan - selections, highlights
    background: "#111315",  // Near-black graphite
    foreground: "#f2f4f6",  // Neutral white text
    accent: "#7fd1ff",      // Cyan - active indicators
    muted: "#9aa4af",       // Cool gray for inactive elements
  },
  {
    id: "night-owl",
    name: "Night Owl",
    primary: "#82aaff",
    background: "#011627",
    foreground: "#d6deeb",
    accent: "#7fdbca",
    muted: "#637777",
  },
  {
    id: "dracula",
    name: "Dracula",
    primary: "#bd93f9",     // Purple
    background: "#282a36",  // Background
    foreground: "#f8f8f2",  // Foreground
    accent: "#50fa7b",      // Green
    muted: "#6272a4",       // Comment
  },
  {
    id: "nord",
    name: "Nord",
    primary: "#88c0d0",     // Nord8 - frost
    background: "#2e3440",  // Nord0 - polar night
    foreground: "#eceff4",  // Nord6 - snow storm
    accent: "#a3be8c",      // Nord14 - aurora green
    muted: "#4c566a",       // Nord3 - polar night
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    primary: "#268bd2",     // Blue
    background: "#002b36",  // Base03
    foreground: "#839496",  // Base0
    accent: "#2aa198",      // Cyan
    muted: "#586e75",       // Base01
  },
  {
    id: "one-dark",
    name: "One Dark",
    primary: "#61afef",     // Blue
    background: "#282c34",  // Background
    foreground: "#abb2bf",  // Foreground
    accent: "#98c379",      // Green
    muted: "#5c6370",       // Comment
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    primary: "#89b4fa",     // Blue
    background: "#1e1e2e",  // Base
    foreground: "#cdd6f4",  // Text
    accent: "#a6e3a1",      // Green
    muted: "#6c7086",       // Overlay0
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    primary: "#83a598",     // Aqua
    background: "#282828",  // bg0
    foreground: "#ebdbb2",  // fg1
    accent: "#b8bb26",      // Green
    muted: "#928374",       // Gray
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    primary: "#7aa2f7",     // Blue
    background: "#1a1b26",  // Background
    foreground: "#c0caf5",  // Foreground
    accent: "#9ece6a",      // Green
    muted: "#565f89",       // Comment
  },
]

export function getThemeById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(t => t.id === id)
}

export function getThemeByName(name: string): ThemePreset | undefined {
  return THEME_PRESETS.find(t => t.name.toLowerCase() === name.toLowerCase())
}

export function getCurrentThemeId(config: ThemeConfig): string {
  // Find matching preset by comparing ALL 5 color properties
  // This ensures we detect custom themes even if user only changed one color
  const match = THEME_PRESETS.find(
    t => t.primary === config.primary && 
         t.background === config.background &&
         t.foreground === config.foreground &&
         t.accent === config.accent &&
         t.muted === config.muted
  )
  return match?.id ?? "custom"
}

/** Get list of all theme names for display */
export function getThemeNames(): string[] {
  return THEME_PRESETS.map(t => t.name)
}
