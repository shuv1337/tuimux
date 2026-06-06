import { Component, For, Show } from "solid-js"
import type { FocusMode, LayoutMode } from "../types"
import type { Palette } from "../lib/palette"
import { fitHints, type Hint, type WidthMode } from "../lib/width-layout"

export interface StatusBarProps {
  appName: string | null
  appStatus: string | null
  focusMode: FocusMode
  message: string | null
  theme: Palette
  layoutMode?: LayoutMode
  widthMode?: WidthMode
  termWidth?: number
}

// Hint tiers, ordered widest-first. fitHints() picks the largest set that fits.
const TABS_HINTS: Hint[][] = [
  [
    { key: "j/k", label: "nav" },
    { key: "↵", label: "open" },
    { key: "space", label: "palette" },
    { key: "t", label: "new" },
    { key: "e", label: "edit" },
    { key: "^A", label: "term" },
    { key: "?", label: "help" },
  ],
  [
    { key: "j/k", label: "nav" },
    { key: "↵", label: "open" },
    { key: "space", label: "cmd" },
    { key: "?", label: "help" },
  ],
  [
    { key: "space", label: "cmd" },
    { key: "?", label: "help" },
  ],
]

const PANES_HINTS: Hint[][] = [
  [
    { key: "space", label: "palette" },
    { key: "n", label: "win" },
    { key: "v/s", label: "split" },
    { key: "p", label: "pane" },
    { key: "^A", label: "term" },
    { key: "?", label: "help" },
  ],
  [
    { key: "space", label: "cmd" },
    { key: "v/s", label: "split" },
    { key: "?", label: "help" },
  ],
  [{ key: "?", label: "help" }],
]

export const StatusBar: Component<StatusBarProps> = (props) => {
  const isPanes = () => props.layoutMode === "panes"

  const hints = (): Hint[] => {
    if (props.focusMode === "terminal") {
      return [{ key: "^A", label: isPanes() ? "panes" : "tabs" }]
    }
    const tiers = isPanes() ? PANES_HINTS : TABS_HINTS
    return fitHints(props.termWidth ?? 100, tiers)
  }

  const modeTag = () =>
    props.focusMode === "terminal" ? "TERMINAL" : isPanes() ? "PANES" : "TABS"

  return (
    <box height={1} flexDirection="row" backgroundColor={props.theme.surfaceAlt} paddingLeft={1} paddingRight={1}>
      {/* Left: self-fitting keybind hints (key bright/bold, label dim) */}
      <box flexDirection="row" flexGrow={1}>
        <For each={hints()}>
          {(hint, index) => (
            <>
              <text fg={props.theme.accent}>
                {index() > 0 ? "  " : ""}
                <b>{hint.key}</b>
              </text>
              <text fg={props.theme.textDim}>{" " + hint.label}</text>
            </>
          )}
        </For>
      </box>

      {/* Center: transient message or active app info */}
      <box flexDirection="row">
        <Show
          when={props.message}
          fallback={
            <Show when={props.appName}>
              <text fg={props.theme.accent}>{props.appName}</text>
              <text fg={props.theme.textDim}>
                {props.appStatus ? ` (${props.appStatus})` : ""}
              </text>
            </Show>
          }
        >
          <text fg={props.theme.accent}>
            <b>{props.message}</b>
          </text>
        </Show>
      </box>

      {/* Right: focus mode indicator */}
      <box>
        <text fg={props.focusMode === "terminal" ? props.theme.accent : props.theme.textDim}>
          {"  " + modeTag()}
        </text>
      </box>
    </box>
  )
}
