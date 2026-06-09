import { Component, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { LayoutMode } from "../types"
import type { Palette } from "../lib/palette"
import { DialogBox } from "./DialogBox"

export interface HelpModalProps {
  theme: Palette
  layoutMode?: LayoutMode
  onClose: () => void
}

interface Shortcut {
  keys: string
  label: string
}

interface Group {
  title: string
  shortcuts: Shortcut[]
}

const TABS_GROUPS: Group[] = [
  {
    title: "Navigate",
    shortcuts: [
      { keys: "j / k  ↑ / ↓", label: "Move selection" },
      { keys: "gg / G", label: "Jump to top / bottom" },
      { keys: "Enter", label: "Open / select app" },
      { keys: "Ctrl+A", label: "Toggle terminal focus" },
    ],
  },
  {
    title: "Manage apps",
    shortcuts: [
      { keys: "t", label: "Add new app" },
      { keys: "e", label: "Edit app  (Ctrl+D deletes)" },
      { keys: "x", label: "Stop running app" },
      { keys: "r", label: "Restart running app" },
      { keys: "K", label: "Kill all apps" },
      { keys: "Space", label: "Command palette" },
    ],
  },
  {
    title: "Session",
    shortcuts: [
      { keys: "q", label: "Detach session" },
      { keys: "Q", label: "Quit / shutdown" },
      { keys: "Shift+L", label: "Switch layout" },
      { keys: "Shift+B", label: "Rotate sidebar" },
      { keys: "?", label: "Toggle this help" },
    ],
  },
]

const PANES_GROUPS: Group[] = [
  {
    title: "Panes",
    shortcuts: [
      { keys: "v", label: "Split vertical" },
      { keys: "s", label: "Split horizontal" },
      { keys: "x", label: "Close pane" },
      { keys: "p", label: "Next pane" },
    ],
  },
  {
    title: "Windows",
    shortcuts: [
      { keys: "n", label: "New window" },
      { keys: "w", label: "Close window" },
      { keys: "[ / ]", label: "Prev / next window" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: "t", label: "Add new app" },
      { keys: "Space", label: "Command palette" },
      { keys: "Ctrl+A", label: "Toggle terminal focus" },
      { keys: "Shift+L", label: "Switch layout" },
      { keys: "Shift+B", label: "Rotate sidebar" },
      { keys: "q / Q", label: "Detach / quit" },
      { keys: "?", label: "Toggle this help" },
    ],
  },
]

const MODAL_GROUPS: Group[] = [
  {
    title: "Command palette",
    shortcuts: [
      { keys: "Ctrl+E", label: "Edit selected app" },
      { keys: "Ctrl+R", label: "Delete selected app" },
      { keys: "x", label: "Stop selected app" },
    ],
  },
  {
    title: "Edit app",
    shortcuts: [
      { keys: "Ctrl+D", label: "Delete this app" },
      { keys: "Tab", label: "Next field" },
    ],
  },
]

export const HelpModal: Component<HelpModalProps> = (props) => {
  useKeyboard((event) => {
    if (event.name === "escape" || event.name === "?" || event.name === "q") {
      props.onClose()
      event.preventDefault()
    }
  })

  const allGroups = () => [
    ...(props.layoutMode === "panes" ? PANES_GROUPS : TABS_GROUPS),
    ...MODAL_GROUPS,
  ]
  const modeLabel = () =>
    props.layoutMode === "panes" ? "Panes" : "Tabs"

  // Split groups across two balanced columns.
  const leftColumn = () => allGroups().filter((_, i) => i % 2 === 0)
  const rightColumn = () => allGroups().filter((_, i) => i % 2 === 1)

  return (
    <DialogBox theme={props.theme} width="80%" height="80%">
      {/* Title */}
      <box height={1} paddingLeft={2} flexDirection="row">
        <text fg={props.theme.accent}>
          <b>Keyboard Shortcuts</b>
        </text>
        <text fg={props.theme.textDim}>{`   (${modeLabel()} mode)`}</text>
      </box>

      <box height={1} />

      {/* Two-column shortcut grid */}
      <box flexDirection="row" flexGrow={1} paddingLeft={2} paddingRight={2}>
        <box flexDirection="column" flexGrow={1} marginRight={2}>
          <For each={leftColumn()}>
            {(group) => <ShortcutGroup group={group} theme={props.theme} />}
          </For>
        </box>
        <box flexDirection="column" flexGrow={1}>
          <For each={rightColumn()}>
            {(group) => <ShortcutGroup group={group} theme={props.theme} />}
          </For>
        </box>
      </box>

      {/* Footer */}
      <box height={1} paddingLeft={2}>
        <text fg={props.theme.textDim}>? · q · Esc to close</text>
      </box>
    </DialogBox>
  )
}

const ShortcutGroup: Component<{ group: Group; theme: Palette }> = (props) => {
  return (
    <box flexDirection="column">
      <box height={1}>
        <text fg={props.theme.accent}>
          <b>{props.group.title}</b>
        </text>
      </box>
      <For each={props.group.shortcuts}>
        {(shortcut) => (
          <box height={1} flexDirection="row" paddingLeft={1}>
            <box width={14}>
              <text fg={props.theme.accent}>
                <b>{shortcut.keys}</b>
              </text>
            </box>
            <text fg={props.theme.text}>{shortcut.label}</text>
          </box>
        )}
      </For>
      <box height={1} />
    </box>
  )
}
