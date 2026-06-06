import { Component, For, createMemo } from "solid-js"
import { TabItem } from "./TabItem"
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
}

export const TabList: Component<TabListProps> = (props) => {
  const visibleHeight = () => props.height - 2 // header band + add button

  const visibleEntries = createMemo(() => {
    const start = props.scrollOffset
    const end = start + visibleHeight()
    return props.entries.slice(start, end)
  })

  const hasScrollUp = () => props.scrollOffset > 0
  const hasScrollDown = () => props.scrollOffset + visibleHeight() < props.entries.length

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
}
