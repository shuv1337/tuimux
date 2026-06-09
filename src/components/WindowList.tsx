import { Component, For, createMemo, Show } from "solid-js"
import type { WindowState } from "../types"
import type { Palette } from "../lib/palette"
import { horizontalWindow } from "../lib/list-window"

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
  orientation?: "vertical" | "horizontal"
}

const HORIZONTAL_MAX_TITLE = 12
const ADD_W = 3 // trailing " + "
const IND_W = 2 // each overflow-marker box ("‹ " / " ›" / "  ") — exactly 2 cols

export const WindowList: Component<WindowListProps> = (props) => {
  const isHorizontal = () => props.orientation === "horizontal"

  const truncateTitle = (window: WindowState, index: number) => {
    const raw = `${index + 1}:${window.title}`
    if (raw.length > HORIZONTAL_MAX_TITLE) {
      return raw.slice(0, HORIZONTAL_MAX_TITLE - 1) + "…"
    }
    return raw
  }

  // --- HORIZONTAL rendering ---
  // Reactive window: recomputes on windows / width / active-window change so the
  // active window stays on-screen in the compact bar. (Window navigation tracks
  // activeWindowId; there's no separate selection index for the window bar.)
  const horizontalView = createMemo(() => {
    const wins = props.windows
    // Segment markup is ` ${title} ` => width = title.length + 2 (<= 14).
    const widths = wins.map((w, i) => truncateTitle(w, i).length + 2)
    const rawActive = wins.findIndex((w) => w.id === props.activeWindowId)
    const active = Math.max(0, rawActive)
    const avail0 = props.width - ADD_W
    const total = widths.reduce((s, w) => s + w, 0)
    const overflow = total > avail0
    const win = overflow
      ? horizontalWindow(widths, avail0 - 2 * IND_W, active)
      : { start: 0, end: wins.length, hiddenBefore: 0, hiddenAfter: 0 }
    return {
      overflow,
      start: win.start,
      visible: wins.slice(win.start, win.end),
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
        {(window, i) => {
          const actualIndex = () => horizontalView().start + i()
          const isActive = () => window.id === props.activeWindowId
          const segBg = () => (isActive() ? props.theme.surfaceAlt : props.theme.surface)
          const segFg = () => (isActive() ? props.theme.accent : props.theme.text)
          const segment = () => ` ${truncateTitle(window, actualIndex())} `

          return (
            <box
              height={1}
              backgroundColor={segBg()}
              onMouseDown={() => props.onSelect(window.id)}
            >
              <text fg={segFg()} bg={segBg()}>
                {isActive() ? <b>{segment()}</b> : segment()}
              </text>
            </box>
          )
        }}
      </For>
      <Show when={horizontalView().overflow}>
        <box height={1} backgroundColor={props.theme.surface}>
          <text fg={props.theme.textDim} bg={props.theme.surface}>
            {horizontalView().showRight ? " ›" : "  "}
          </text>
        </box>
      </Show>

      {/* Trailing add affordance */}
      <box height={1} backgroundColor={props.theme.surface} onMouseDown={props.onAddClick}>
        <text fg={props.theme.textDim} bg={props.theme.surface}>{" + "}</text>
      </box>
    </box>
  )

  // --- VERTICAL rendering (unchanged) ---
  const visibleHeight = () => props.height - 2 // header band + footer add row
  const visibleWindows = () => props.windows.slice(0, visibleHeight())

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

  // Reactive branch (see TabList): keeps the horizontal/vertical choice live so
  // a runtime sidebar rotation into top/bottom re-renders the horizontal bar.
  return (
    <Show when={isHorizontal()} fallback={renderVertical()}>
      {renderHorizontal()}
    </Show>
  )
}
