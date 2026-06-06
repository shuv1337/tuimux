import { Component, Show, createEffect } from "solid-js"
import type { RunningApp, ThemeConfig } from "../types"
import { createTerminalFeeder, type TerminalFeedSource } from "../lib/terminal-feed"

export interface TerminalPaneProps {
  runningApp: RunningApp | undefined
  isFocused: boolean
  width: number
  height: number
  theme: ThemeConfig
  onInput?: (data: string) => void
}

export const TerminalPane: Component<TerminalPaneProps> = (props) => {
  const contentWidth = () => Math.max(1, props.width - 2)
  const contentHeight = () => Math.max(1, props.height - 3)

  const feeder = createTerminalFeeder()
  const source = (): TerminalFeedSource | undefined => {
    const app = props.runningApp
    if (!app) return undefined
    return { buffer: app.buffer, seq: app.seq, key: `${app.entry.id}:${app.runId}` }
  }
  // Feed new output as it arrives (source() reads buffer/seq reactively).
  createEffect(() => feeder.sync(source()))

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      height={props.height}
      borderStyle="single"
      borderColor={props.isFocused ? props.theme.primary : props.theme.muted}
    >
      <Show
        when={props.runningApp}
        fallback={
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text fg={props.theme.muted}>
              No app selected. Press 't' to add one.
            </text>
          </box>
        }
      >
        {(app) => (
          <box flexDirection="column" flexGrow={1}>
            {/* Terminal header */}
            <box height={1} flexDirection="row">
              <text fg={props.theme.accent}>
                <b>{app().entry.name}</b>
              </text>
              <text fg={props.theme.muted}>
                {" "}({app().status})
              </text>
            </box>

            {/* Terminal content — persistent mode, fed deltas via the feeder. */}
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
