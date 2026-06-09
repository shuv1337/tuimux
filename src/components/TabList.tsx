import { Component, For, createMemo, Show } from "solid-js"
import { TabItem, getStatusIndicator, getStatusColor } from "./TabItem"
import type { AppEntry, AppStatus } from "../types"
import type { Palette } from "../lib/palette"

export interface TabListProps {
  entries: AppEntry[]
  activeTabId: string | null
  selectedIndex: number
  getStatus: (id: string) => AppStatus
  isFocused: boolean
  width: number
  height: number
  scrollOffset: number
  theme: Palette
  onSelect: (id: string) => void
  onAddClick: () => void
  orientation?: "vertical" | "horizontal"
}

const HORIZONTAL_NAME_MAX = 12

export const TabList: Component<TabListProps> = (props) => {
  // ── HORIZONTAL compact bar (height must be 1) ──────────────────────────────
  // Memo hoisted to component scope so it's created once (not inside the render
  // helper) and the orientation branch below can stay reactive.
  const horizontalSegments = createMemo(() =>
    props.entries.map((entry, index) => {
      const status = props.getStatus(entry.id)
      const isActive = entry.id === props.activeTabId
      const isFocused = props.isFocused && index === props.selectedIndex
      const highlighted = isActive || isFocused
      const dot = getStatusIndicator(status)
      const dotColor = getStatusColor(status, props.theme)
      const name =
        entry.name.length > HORIZONTAL_NAME_MAX
          ? entry.name.slice(0, HORIZONTAL_NAME_MAX - 1) + "…"
          : entry.name
      return { entry, isActive, isFocused, highlighted, dot, dotColor, name, index }
    })
  )

  const renderHorizontal = () => (
    <box
      flexDirection="row"
      width={props.width}
      height={1}
      backgroundColor={props.theme.surface}
      overflow="hidden"
    >
      <For each={horizontalSegments()}>
        {(seg) => (
          <box
            flexDirection="row"
            height={1}
            backgroundColor={seg.highlighted ? props.theme.surfaceAlt : props.theme.surface}
            onMouseDown={() => props.onSelect(seg.entry.id)}
          >
            <text> </text>
            <text fg={seg.dotColor}>{seg.dot}</text>
            <text
              fg={seg.isActive ? props.theme.accent : props.theme.text}
              bg={seg.highlighted ? props.theme.surfaceAlt : props.theme.surface}
            >
              {seg.isActive ? <b>{seg.name}</b> : seg.name}
            </text>
            <text> </text>
          </box>
        )}
      </For>
      {/* Trailing add affordance */}
      <box height={1} onMouseDown={props.onAddClick}>
        <text fg={props.theme.textDim}> + </text>
      </box>
    </box>
  )

  // ── VERTICAL (existing behavior, byte-for-byte unchanged) ──────────────────
  const visibleHeight = () => props.height - 2 // header band + add button

  const visibleEntries = createMemo(() => {
    const start = props.scrollOffset
    const end = start + visibleHeight()
    return props.entries.slice(start, end)
  })

  const hasScrollUp = () => props.scrollOffset > 0
  const hasScrollDown = () => props.scrollOffset + visibleHeight() < props.entries.length

  const renderVertical = () => (
    <box
      flexDirection="column"
      width={props.width}
      height={props.height}
      backgroundColor={props.theme.surface}
    >
      {/* Header band — color-separated, no border */}
      <box height={1} width={props.width} backgroundColor={props.theme.surfaceAlt} paddingLeft={1}>
        <text fg={props.theme.accent}>
          <b>Apps {hasScrollUp() ? "▲" : " "}{hasScrollDown() ? "▼" : " "}</b>
        </text>
      </box>

      {/* Tab entries */}
      <box flexDirection="column" flexGrow={1}>
        <For each={visibleEntries()}>
          {(entry, index) => {
            const actualIndex = () => props.scrollOffset + index()
            return (
              <TabItem
                entry={entry}
                status={props.getStatus(entry.id)}
                isActive={entry.id === props.activeTabId}
                isFocused={props.isFocused && actualIndex() === props.selectedIndex}
                width={props.width - 1}
                theme={props.theme}
                onSelect={() => props.onSelect(entry.id)}
              />
            )
          }}
        </For>
      </box>

      {/* Add button */}
      <box height={1} width={props.width} paddingLeft={1} onMouseDown={props.onAddClick}>
        <text fg={props.theme.textDim}>+ Add</text>
      </box>
    </box>
  )

  // Reactive branch: <Show> re-evaluates when props.orientation changes, so a
  // runtime sidebar rotation (Shift+B) into top/bottom actually re-renders the
  // horizontal bar instead of keeping a frozen vertical layout.
  return (
    <Show when={props.orientation === "horizontal"} fallback={renderVertical()}>
      {renderHorizontal()}
    </Show>
  )
}
