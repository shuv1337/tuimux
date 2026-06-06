import { Component } from "solid-js"
import type { AppEntry, AppStatus } from "../types"
import type { Palette } from "../lib/palette"

export interface TabItemProps {
  entry: AppEntry
  status: AppStatus
  isActive: boolean
  isFocused: boolean
  width: number
  theme: Palette
  onSelect: () => void
}

/** Status indicator glyph. */
function getStatusIndicator(status: AppStatus): string {
  switch (status) {
    case "running":
      return "●"
    case "stopped":
      return "○"
    case "error":
      return "✖"
  }
}

/** Status color, fully theme-driven (no hardcoded greens/reds). */
function getStatusColor(status: AppStatus, theme: Palette): string {
  switch (status) {
    case "running":
      return theme.on
    case "stopped":
      return theme.off
    case "error":
      return theme.error
  }
}

export const TabItem: Component<TabItemProps> = (props) => {
  const truncatedName = () => {
    const maxLen = props.width - 4 // rail + dot + space + breathing room
    if (props.entry.name.length > maxLen) {
      return props.entry.name.slice(0, maxLen - 1) + "…"
    }
    return props.entry.name
  }

  // Selection reads as: a 1-col bright accent rail + a slightly lighter row bg.
  const highlighted = () => props.isActive || props.isFocused
  const rowBg = () => (highlighted() ? props.theme.surfaceAlt : undefined)
  const nameColor = () => (props.isActive ? props.theme.accent : props.theme.text)

  return (
    <box
      height={1}
      width={props.width}
      flexDirection="row"
      backgroundColor={rowBg()}
      onMouseDown={props.onSelect}
    >
      {/* Accent rail — the primary "you are here" tell */}
      <box width={1} height={1} backgroundColor={props.isFocused ? props.theme.accent : undefined} />
      <text fg={getStatusColor(props.status, props.theme)}>
        {getStatusIndicator(props.status)}
      </text>
      <text> </text>
      <text fg={nameColor()} bg={rowBg()}>
        {props.isActive ? <b>{truncatedName()}</b> : truncatedName()}
      </text>
    </box>
  )
}
