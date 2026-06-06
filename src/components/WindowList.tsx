import { Component, For } from "solid-js"
import type { WindowState } from "../types"
import type { Palette } from "../lib/palette"

export interface WindowListProps {
  windows: WindowState[]
  activeWindowId: string | null
  selectedIndex?: number
  isFocused: boolean
  width: number
  height: number
  theme: Palette
  onSelect: (id: string) => void
  onAddClick: () => void
}

export const WindowList: Component<WindowListProps> = (props) => {
  const visibleHeight = () => props.height - 2 // header band + footer add row

  const visibleWindows = () => props.windows.slice(0, visibleHeight())

  return (
    <box
      flexDirection="column"
      width={props.width}
      height={props.height}
      backgroundColor={props.theme.surface}
    >
      {/* Header band — color-separated, no border */}
      <box height={1} width={props.width} backgroundColor={props.theme.surfaceAlt} paddingLeft={1}>
        <text fg={props.theme.accent}>
          <b>Windows</b>
        </text>
      </box>

      {/* Window rows */}
      <box flexDirection="column" flexGrow={1}>
        <For each={visibleWindows()}>
          {(window, index) => {
            const isActive = () => window.id === props.activeWindowId
            const isSelected = () => props.isFocused && index() === (props.selectedIndex ?? -1)
            const highlighted = () => isActive() || isSelected()
            const rowBg = () => (highlighted() ? props.theme.surfaceAlt : props.theme.surface)
            const labelColor = () => (isActive() ? props.theme.accent : props.theme.text)
            const label = () => {
              const maxLen = props.width - 3 // rail + space + breathing room
              const title = `${index() + 1}:${window.title}`
              if (title.length > maxLen) {
                return title.slice(0, maxLen - 1) + "…"
              }
              return title
            }

            return (
              <box
                height={1}
                width={props.width}
                flexDirection="row"
                backgroundColor={rowBg()}
                onMouseDown={() => props.onSelect(window.id)}
              >
                {/* Accent rail — the primary "you are here" tell */}
                <box
                  width={1}
                  height={1}
                  backgroundColor={highlighted() ? props.theme.accent : undefined}
                />
                <text fg={labelColor()} bg={rowBg()}>
                  {isActive() ? <b>{` ${label()}`}</b> : ` ${label()}`}
                </text>
              </box>
            )
          }}
        </For>
      </box>

      {/* Footer add row */}
      <box height={1} width={props.width} paddingLeft={1} onMouseDown={props.onAddClick}>
        <text fg={props.theme.textDim}>+ New</text>
      </box>
    </box>
  )
}
