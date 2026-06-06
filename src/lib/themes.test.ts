import { describe, expect, test } from "bun:test"
import {
  THEME_PRESETS,
  getThemeById,
  getThemeByName,
  getCurrentThemeId,
  getThemeNames,
  isValidHexColor,
  type ThemePreset,
} from "./themes"

describe("isValidHexColor", () => {
  test("returns true for valid 6-digit hex colors", () => {
    expect(isValidHexColor("#82aaff")).toBe(true)
    expect(isValidHexColor("#FFFFFF")).toBe(true)
    expect(isValidHexColor("#000000")).toBe(true)
    expect(isValidHexColor("#AbCdEf")).toBe(true)
  })

  test("returns false for invalid colors", () => {
    expect(isValidHexColor("82aaff")).toBe(false) // Missing #
    expect(isValidHexColor("#82aaf")).toBe(false) // Too short
    expect(isValidHexColor("#82aaffff")).toBe(false) // Too long
    expect(isValidHexColor("#gggggg")).toBe(false) // Invalid chars
    expect(isValidHexColor("")).toBe(false)
    expect(isValidHexColor("#fff")).toBe(false) // 3-digit not allowed
  })
})

describe("THEME_PRESETS", () => {
  test("contains 9 theme presets", () => {
    expect(THEME_PRESETS.length).toBe(9)
  })

  test("all presets have valid hex colors for all 5 required properties", () => {
    const colorProps = ["primary", "background", "foreground", "accent", "muted"] as const
    
    for (const theme of THEME_PRESETS) {
      for (const prop of colorProps) {
        expect(isValidHexColor(theme[prop])).toBe(true)
      }
    }
  })

  test("all presets have unique ids", () => {
    const ids = THEME_PRESETS.map(t => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  test("all presets have unique names", () => {
    const names = THEME_PRESETS.map(t => t.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })

  test("graphite is the first (default) preset", () => {
    expect(THEME_PRESETS[0].id).toBe("graphite")
    expect(THEME_PRESETS[0].name).toBe("Graphite")
  })

  test("includes expected popular themes", () => {
    const expectedThemes = [
      "graphite",
      "night-owl",
      "dracula",
      "nord",
      "solarized-dark",
      "one-dark",
      "catppuccin-mocha",
      "gruvbox-dark",
      "tokyo-night",
    ]
    const themeIds = THEME_PRESETS.map(t => t.id)
    
    for (const expected of expectedThemes) {
      expect(themeIds).toContain(expected)
    }
  })
})

describe("getThemeById", () => {
  test("returns correct theme for valid id", () => {
    const dracula = getThemeById("dracula")
    expect(dracula).toBeDefined()
    expect(dracula?.name).toBe("Dracula")
    expect(dracula?.primary).toBe("#bd93f9")
  })

  test("returns night-owl theme", () => {
    const nightOwl = getThemeById("night-owl")
    expect(nightOwl).toBeDefined()
    expect(nightOwl?.name).toBe("Night Owl")
    expect(nightOwl?.primary).toBe("#82aaff")
    expect(nightOwl?.background).toBe("#011627")
  })

  test("returns undefined for unknown id", () => {
    expect(getThemeById("nonexistent")).toBeUndefined()
    expect(getThemeById("")).toBeUndefined()
  })
})

describe("getThemeByName", () => {
  test("returns correct theme for exact name match", () => {
    const dracula = getThemeByName("Dracula")
    expect(dracula).toBeDefined()
    expect(dracula?.id).toBe("dracula")
  })

  test("is case-insensitive", () => {
    const dracula1 = getThemeByName("DRACULA")
    const dracula2 = getThemeByName("dracula")
    const dracula3 = getThemeByName("DrAcUlA")
    
    expect(dracula1?.id).toBe("dracula")
    expect(dracula2?.id).toBe("dracula")
    expect(dracula3?.id).toBe("dracula")
  })

  test("returns undefined for unknown name", () => {
    expect(getThemeByName("Unknown Theme")).toBeUndefined()
    expect(getThemeByName("")).toBeUndefined()
  })
})

describe("getCurrentThemeId", () => {
  test("returns correct id when all colors match a preset", () => {
    const nightOwlConfig = {
      primary: "#82aaff",
      background: "#011627",
      foreground: "#d6deeb",
      accent: "#7fdbca",
      muted: "#637777",
    }
    expect(getCurrentThemeId(nightOwlConfig)).toBe("night-owl")
  })

  test("returns custom when one color differs", () => {
    const almostNightOwl = {
      primary: "#82aaff",
      background: "#011627",
      foreground: "#d6deeb",
      accent: "#7fdbca",
      muted: "#999999", // Changed from default
    }
    expect(getCurrentThemeId(almostNightOwl)).toBe("custom")
  })

  test("returns custom for completely custom colors", () => {
    const customConfig = {
      primary: "#ff0000",
      background: "#000000",
      foreground: "#ffffff",
      accent: "#00ff00",
      muted: "#888888",
    }
    expect(getCurrentThemeId(customConfig)).toBe("custom")
  })

  test("identifies all preset themes correctly", () => {
    for (const theme of THEME_PRESETS) {
      const config = {
        primary: theme.primary,
        background: theme.background,
        foreground: theme.foreground,
        accent: theme.accent,
        muted: theme.muted,
      }
      expect(getCurrentThemeId(config)).toBe(theme.id)
    }
  })
})

describe("getThemeNames", () => {
  test("returns array of all theme names", () => {
    const names = getThemeNames()
    expect(names.length).toBe(THEME_PRESETS.length)
    expect(names).toContain("Night Owl")
    expect(names).toContain("Dracula")
    expect(names).toContain("Nord")
  })

  test("returns names in same order as presets", () => {
    const names = getThemeNames()
    for (let i = 0; i < THEME_PRESETS.length; i++) {
      expect(names[i]).toBe(THEME_PRESETS[i].name)
    }
  })
})
