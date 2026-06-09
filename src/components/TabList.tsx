import { Component, For, createMemo, Show } from "solid-js"
import { TabItem, getStatusIndicator, getStatusColor } from "./TabItem"
import type { AppEntry, AppStatus } from "../types"
import type { Palette } from "../lib/palette"
import { horizontalWindow } from "../lib/list-window"

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
const ADD_W = 3 // trailing " + "
const IND_W = 2 // each overflow-marker box ("‹ " / " ›" / "  ") — exactly 2 cols

export const TabList: Component<TabListProps> = (props) => {
  // ── HORIZONTAL compact bar (height must be 1) ──────────────────────────────
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

  // Reactive window: recomputes when entries / width / selection / active tab
  // change, so navigating or resizing always keeps the active tab on-screen.
  const horizontalView = createMemo(() => {
    const segs = horizontalSegments()
    // Segment column width: leading space + 1-col status dot + name + trailing
    // space => name.length + 3.
    const widths = segs.map((seg) => seg.name.length + 3)
    // Active index to keep visible: when focused, follow the selection; else the
    // active tab. Clamp / fall back to 0.
    const rawActive = props.isFocused
      ? props.selectedIndex
      : segs.findIndex((s) => s.entry.id === props.activeTabId)
    const active = Math.max(0, rawActive)
    const avail0 = props.width - ADD_W
    const total = widths.reduce((s, w) => s + w, 0)
    const overflow = total > avail0
    // In the overflow path at least one side is always hidden, and each marker
    // box is exactly IND_W cols, so reserving 2*IND_W matches the rendered width.
    const win = overflow
      ? horizontalWindow(widths, avail0 - 2 * IND_W, active)
      : { start: 0, end: segs.length, hiddenBefore: 0, hiddenAfter: 0 }
    return {
      overflow,
      visible: segs.slice(win.start, win.end),
      showLeft: win.hiddenBefore > 0,
      showRight: win.hiddenAfter > 0,
    }
  })

  const renderHorizontal = () => (
    <box
      flexDirection="row"
      width={props.width}
      height={1}
      backgroundColor={props.theme.surface}
      overflow="hidden"
    >
      <Show when={horizontalView().overflow}>
        <box height={1} backgroundColor={props.theme.surface}>
          <text fg={props.theme.textDim} bg={props.theme.surface}>
            {horizontalView().showLeft ? "‹ " : "  "}
          </text>
        </box>
      </Show>
      <For each={horizontalView().visible}>
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
      <Show when={horizontalView().overflow}>
        <box height={1} backgroundColor={props.theme.surface}>
          <text fg={props.theme.textDim} bg={props.theme.surface}>
            {horizontalView().showRight ? " ›" : "  "}
          </text>
        </box>
      </Show>
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
