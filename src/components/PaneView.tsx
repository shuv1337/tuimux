import { Component, Show, createEffect } from "solid-js"
import type { RunningPane } from "../types"
import type { Palette } from "../lib/palette"
import { createTerminalFeeder, type TerminalFeedSource } from "../lib/terminal-feed"

export interface PaneViewProps {
  pane: RunningPane | undefined
  isActive: boolean
  width: number
  height: number
  theme: Palette
}

export const PaneView: Component<PaneViewProps> = (props) => {
  const contentWidth = () => Math.max(1, props.width - 2)
  const contentHeight = () => Math.max(1, props.height - 3)

  const feeder = createTerminalFeeder()
  const source = (): TerminalFeedSource | undefined => {
    const pane = props.pane
    if (!pane) return undefined
    return { buffer: pane.buffer, seq: pane.seq, key: `${pane.paneId}:${pane.runId}` }
  }
  createEffect(() => feeder.sync(source()))

  return (
    <box
      flexDirection="column"
      width={props.width}
      height={props.height}
      borderStyle="single"
      borderColor={props.isActive ? props.theme.borderFocus : props.theme.border}
    >
      <Show
        when={props.pane}
        fallback={
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text fg={props.theme.textDim}>Empty pane</text>
          </box>
        }
      >
        {(pane) => (
          <box flexDirection="column" flexGrow={1}>
            <box height={1} flexDirection="row" backgroundColor={props.theme.surface}>
              <text fg={props.theme.accent}>
                <b>{pane().entry.name}</b>
              </text>
              <text fg={props.theme.textDim}>{" "}({pane().status})</text>
            </box>
            <box width={contentWidth()} height={contentHeight()} overflow="hidden">
              <ghostty-terminal
                ref={(el: any) => feeder.attach(el, source())}
                cols={contentWidth()}
                rows={contentHeight()}
                showCursor
                style={{ width: contentWidth(), height: contentHeight() }}
              />
            </box>
          </box>
        )}
      </Show>
    </box>
  )
}
