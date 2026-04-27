import { Component, For, createSignal, createMemo, createEffect } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { AppEntry, ThemeConfig } from "../types"
import { createAppSearch } from "../lib/fuzzy"
import { buildEntryCommand } from "../lib/command"
import { getVisibleWindowOffset } from "../lib/list-window"
import { DialogBox } from "./DialogBox"

export type CommandAction = "switch" | "start" | "stop" | "restart" | "edit" | "remove"
export type GlobalAction = { type: "open_theme_picker" }

export interface CommandPaletteProps {
  entries: AppEntry[]
  theme: ThemeConfig
  onSelect: (entry: AppEntry, action: CommandAction) => void
  onGlobalAction?: (action: GlobalAction) => void
  onClose: () => void
}

interface CommandEntry {
  id: string
  name: string
  description?: string
  keywords: string[]
  action: GlobalAction
}

function matchesCommandQuery(query: string, command: CommandEntry): boolean {
  if (!query.trim()) return false
  const haystack = [
    command.name,
    command.description ?? "",
    command.id,
    ...command.keywords,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

type ResultItem = 
  | { type: "app"; item: AppEntry }
  | { type: "command"; command: CommandEntry }

export const CommandPalette: Component<CommandPaletteProps> = (props) => {
  const [query, setQuery] = createSignal("")
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const VISIBLE_RESULTS = 10

  const search = createMemo(() => createAppSearch(props.entries))

  const commands: CommandEntry[] = [
    {
      id: "theme-picker",
      name: "Themes...",
      description: "Pick a color theme",
      keywords: ["theme", "color", "scheme", "palette"],
      action: { type: "open_theme_picker" },
    },
  ]

  // Combined results: commands + apps
  const results = createMemo((): ResultItem[] => {
    const trimmedQuery = query().trim()
    const appResults = search().search(query())

    const commandResults = (trimmedQuery ? commands.filter((command) => matchesCommandQuery(trimmedQuery, command)) : commands)
      .map((command): ResultItem => ({ type: "command", command }))

    // Combine results: commands first, then apps
    const combined: ResultItem[] = [
      ...commandResults,
      ...appResults.map((r): ResultItem => ({ type: "app", item: r.item })),
    ]
    
    return combined
  })

  const handleSelect = (result: ResultItem, action: CommandAction) => {
    if (result.type === "command") {
      props.onGlobalAction?.(result.command.action)
    } else {
      props.onSelect(result.item, action)
    }
  }

  const visibleOffset = createMemo(() =>
    getVisibleWindowOffset(selectedIndex(), results().length, VISIBLE_RESULTS)
  )

  const visibleResults = createMemo(() =>
    results().slice(visibleOffset(), visibleOffset() + VISIBLE_RESULTS)
  )

  useKeyboard((event) => {
    if (event.name === "escape") {
      props.onClose()
      event.preventDefault()
      return
    }

    if (event.name === "x") {
      const selected = results()[selectedIndex()]
      if (selected && selected.type === "app") {
        props.onSelect(selected.item, "stop")
      }
      event.preventDefault()
      return
    }

    if ((event.ctrl && event.name === "e") || event.sequence === "\u0005") {
      const selected = results()[selectedIndex()]
      if (selected && selected.type === "app") {
        props.onSelect(selected.item, "edit")
      }
      event.preventDefault()
      return
    }

    if ((event.ctrl && event.name === "r") || event.sequence === "\u0012") {
      const selected = results()[selectedIndex()]
      if (selected && selected.type === "app") {
        props.onSelect(selected.item, "remove")
      }
      event.preventDefault()
      return
    }

    if (event.name === "up" || event.name === "k") {
      setSelectedIndex((current) => Math.max(0, current - 1))
      event.preventDefault()
      return
    }

    if (event.name === "down" || event.name === "j") {
      const total = results().length
      setSelectedIndex((current) => total === 0 ? 0 : Math.min(total - 1, current + 1))
      event.preventDefault()
      return
    }

  })

  // Reset selection when results change
  createEffect(() => {
    results()
    setSelectedIndex(0)
  })

  return (
    <DialogBox
      theme={props.theme}
      top="20%"
      left="20%"
      width="60%"
      height="60%"
    >
      {/* Search input */}
      <box
        height={3}
        flexDirection="row"
        borderStyle="single"
        borderColor={props.theme.muted}
        paddingLeft={1}
        paddingRight={1}
      >
        <box height={1} flexDirection="row" flexGrow={1}>
          <text fg={props.theme.muted}>{"> "}</text>
          <input
            height={1}
            flexGrow={1}
            value={query()}
            focused
            backgroundColor={props.theme.background}
            textColor={props.theme.foreground}
            focusedBackgroundColor={props.theme.background}
            focusedTextColor={props.theme.foreground}
            placeholder="Search apps or commands..."
            placeholderColor={props.theme.muted}
            cursorColor={props.theme.accent}
            onInput={(value) => setQuery(value)}
            onSubmit={() => {
              const selected = results()[selectedIndex()]
              if (selected) {
                handleSelect(selected, "switch")
              }
            }}
          />
        </box>
      </box>

      {/* Results list */}
      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <For each={visibleResults()}>
          {(result, index) => {
            const actualIndex = () => visibleOffset() + index()
            const isSelected = () => actualIndex() === selectedIndex()
            const displayText = () => {
              if (result.type === "command") {
                return `[Cmd] ${result.command.name}`
              }
              return `${result.item.name} - ${buildEntryCommand(result.item)}`
            }
            const isCommand = () => result.type === "command"
            
            return (
              <box
                height={1}
                width="100%"
                flexDirection="row"
                backgroundColor={isSelected() ? props.theme.primary : props.theme.background}
                onMouseDown={() => handleSelect(result, "switch")}
              >
                <text
                  width="100%"
                  fg={isSelected() ? props.theme.background : (isCommand() ? props.theme.accent : props.theme.foreground)}
                  bg={isSelected() ? props.theme.primary : props.theme.background}
                >
                  {" "}{displayText()}
                </text>
              </box>
            )
          }}
        </For>
      </box>

      {/* Footer hints */}
      <box
        height={3}
        borderStyle="single"
        borderColor={props.theme.muted}
        paddingLeft={1}
        paddingRight={1}
      >
        <box height={1}>
          <text fg={props.theme.muted}>
            Enter:Select | x:Stop | Ctrl+E:Edit | Ctrl+R:Remove | Esc:Close | ↑↓:Navigate
          </text>
        </box>
      </box>
    </DialogBox>
  )
}
