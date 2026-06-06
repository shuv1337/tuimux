import { Component, For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { THEME_PRESETS, getCurrentThemeId, type ThemePreset } from "../lib/themes"
import { resolveTheme, type Palette } from "../lib/palette"
import { DialogBox } from "./DialogBox"

export interface ThemePickerProps {
  theme: Palette
  onSelect: (themeId: string) => void
  onClose: () => void
}

function matchesThemeQuery(query: string, theme: ThemePreset): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return theme.name.toLowerCase().includes(q) || theme.id.toLowerCase().includes(q)
}

export const ThemePicker: Component<ThemePickerProps> = (props) => {
  const [query, setQuery] = createSignal("")
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const DIALOG_HEIGHT = 14
  const HEADER_HEIGHT = 3
  const FOOTER_HEIGHT = 3
  const BORDER_HEIGHT = 2
  const VISIBLE_THEMES = DIALOG_HEIGHT - BORDER_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT

  const filteredThemes = createMemo(() => {
    return THEME_PRESETS.filter((theme) => matchesThemeQuery(query(), theme))
  })

  const currentThemeId = createMemo(() => getCurrentThemeId(props.theme))

  const scrollOffset = createMemo(() => {
    const idx = selectedIndex()
    const themes = filteredThemes()
    if (themes.length <= VISIBLE_THEMES) return 0
    const maxOffset = themes.length - VISIBLE_THEMES
    const centered = Math.floor(VISIBLE_THEMES / 2)
    return Math.min(Math.max(idx - centered, 0), maxOffset)
  })

  const handleSelect = (theme: ThemePreset | undefined) => {
    if (!theme) return
    props.onSelect(theme.id)
    props.onClose()
  }

  useKeyboard((event) => {
    if (event.name === "escape") {
      props.onClose()
      event.preventDefault()
      return
    }

    if (event.name === "up" || event.name === "k") {
      if (filteredThemes().length === 0) {
        return
      }
      setSelectedIndex((current) => Math.max(0, current - 1))
      event.preventDefault()
      return
    }

    if (event.name === "down" || event.name === "j") {
      const total = filteredThemes().length
      if (total === 0) {
        return
      }
      setSelectedIndex((current) => Math.min(total - 1, current + 1))
      event.preventDefault()
      return
    }
  })

  createEffect(() => {
    filteredThemes()
    setSelectedIndex(0)
  })

  return (
    <DialogBox theme={props.theme} width="50%" height={DIALOG_HEIGHT}>
      {/* Title */}
      <box height={1} paddingLeft={2}>
        <text fg={props.theme.accent}>
          <b>Themes</b>
        </text>
      </box>

      {/* Search input */}
      <box height={1} flexDirection="row" paddingLeft={2} paddingRight={2}>
        <text fg={props.theme.textDim}>{"› "}</text>
        <input
          height={1}
          flexGrow={1}
          value={query()}
          focused
          backgroundColor={props.theme.surface}
          textColor={props.theme.text}
          focusedBackgroundColor={props.theme.surface}
          focusedTextColor={props.theme.text}
          placeholder="Filter themes..."
          placeholderColor={props.theme.textDim}
          cursorColor={props.theme.accent}
          onInput={(value) => setQuery(value)}
          onSubmit={() => handleSelect(filteredThemes()[selectedIndex()])}
        />
      </box>

      {/* Theme list */}
      <box flexDirection="column" flexGrow={1} overflow="hidden" paddingRight={2}>
        <Show
          when={filteredThemes().length > 0}
          fallback={
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text fg={props.theme.textDim}>No matching themes.</text>
            </box>
          }
        >
          <For each={filteredThemes().slice(scrollOffset(), scrollOffset() + VISIBLE_THEMES)}>
            {(theme, index) => {
              const actualIndex = () => scrollOffset() + index()
              const isSelected = () => actualIndex() === selectedIndex()
              const isCurrent = () => theme.id === currentThemeId()
              const swatch = createMemo(() => resolveTheme(theme))
              return (
                <box height={1} flexDirection="row" backgroundColor={isSelected() ? props.theme.surfaceAlt : undefined}>
                  {/* accent rail */}
                  <box width={1} height={1} backgroundColor={isSelected() ? props.theme.accent : undefined} />
                  <text fg={isCurrent() ? props.theme.accent : props.theme.textDim}>
                    {isCurrent() ? " ✓ " : "   "}
                  </text>
                  <text fg={isSelected() || isCurrent() ? props.theme.text : props.theme.textDim}>
                    {theme.name.padEnd(18)}
                  </text>
                  {/* live swatch of the resolved ramp */}
                  <text fg={swatch().accent}>●</text>
                  <text fg={swatch().on}>●</text>
                  <text fg={swatch().warn}>●</text>
                  <text fg={swatch().error}>●</text>
                </box>
              )
            }}
          </For>
        </Show>
      </box>

      {/* Footer hints */}
      <box height={1} flexDirection="row" paddingLeft={2}>
        <Hint theme={props.theme} keyLabel="↵" desc="select" />
        <Hint theme={props.theme} keyLabel="↑↓" desc="nav" />
        <Hint theme={props.theme} keyLabel="esc" desc="close" />
      </box>
    </DialogBox>
  )
}

const Hint: Component<{ theme: Palette; keyLabel: string; desc: string }> = (props) => (
  <>
    <text fg={props.theme.accent}>
      {"  "}
      <b>{props.keyLabel}</b>
    </text>
    <text fg={props.theme.textDim}>{" " + props.desc}</text>
  </>
)
