import { Component, For } from "solid-js"
import type { WindowState } from "../types"
import type { Palette } from "../lib/palette"

export interface WindowBarProps {
  windows: WindowState[]
  activeWindowId: string | null
  theme: Palette
  onSelect: (id: string) => void
}

export const WindowBar: Component<WindowBarProps> = (props) => {
  return (
    <box height={1} flexDirection="row" backgroundColor={props.theme.surfaceAlt}>
      <For each={props.windows}>
        {(window, index) => {
          const isActive = () => window.id === props.activeWindowId
          const label = () => ` ${index() + 1}:${window.title} `
          return (
            <box onMouseDown={() => props.onSelect(window.id)} backgroundColor={isActive() ? props.theme.surface : undefined}>
              <text fg={isActive() ? props.theme.accent : props.theme.textDim}>
                {isActive() ? <b>{label()}</b> : label()}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}
