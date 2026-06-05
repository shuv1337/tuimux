import { Component, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { LayoutMode, ThemeConfig } from "../types"
import { DialogBox } from "./DialogBox"

export interface HelpModalProps {
  theme: ThemeConfig
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
      { keys: "?", label: "Toggle this help" },
    ],
  },
]

const ZELLIJ_GROUPS: Group[] = [
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

  const primaryGroups = () =>
    props.layoutMode === "zellij" ? ZELLIJ_GROUPS : TABS_GROUPS
  const modeLabel = () =>
    props.layoutMode === "zellij" ? "Manager" : "Tabs"

  return (
    <DialogBox theme={props.theme} top="8%" left="18%" width="64%" height="84%">
      {/* Title */}
      <box height={1} paddingLeft={1} flexDirection="row">
        <text fg={props.theme.accent}>
          <b>Keyboard Shortcuts</b>
        </text>
        <text fg={props.theme.muted}>{`   (${modeLabel()} mode)`}</text>
      </box>

      <box height={1} />

      {/* Mode-specific groups */}
      <For each={primaryGroups()}>
        {(group) => <ShortcutGroup group={group} theme={props.theme} />}
      </For>

      {/* Shortcuts that live inside modals */}
      <For each={MODAL_GROUPS}>
        {(group) => <ShortcutGroup group={group} theme={props.theme} />}
      </For>

      <box flexGrow={1} />

      {/* Footer */}
      <box height={1} paddingLeft={1}>
        <text fg={props.theme.muted}>?, q or Esc to close</text>
      </box>
    </DialogBox>
  )
}

const ShortcutGroup: Component<{ group: Group; theme: ThemeConfig }> = (props) => {
  return (
    <box flexDirection="column">
      <box height={1} paddingLeft={1}>
        <text fg={props.theme.primary}>
          <b>{props.group.title}</b>
        </text>
      </box>
      <For each={props.group.shortcuts}>
        {(shortcut) => (
          <box height={1} flexDirection="row" paddingLeft={2}>
            <box width={16}>
              <text fg={props.theme.accent}>{shortcut.keys}</text>
            </box>
            <text fg={props.theme.foreground}>{shortcut.label}</text>
          </box>
        )}
      </For>
      <box height={1} />
    </box>
  )
}
