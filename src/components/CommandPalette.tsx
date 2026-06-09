import { Component, For, createSignal, createMemo, createEffect } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { AppEntry, LayoutMode } from "../types"
import type { Palette } from "../lib/palette"
import { createAppSearch } from "../lib/fuzzy"
import { buildEntryCommand } from "../lib/command"
import { getVisibleWindowOffset } from "../lib/list-window"
import { DialogBox } from "./DialogBox"

export type CommandAction = "switch" | "start" | "stop" | "restart" | "edit" | "remove"
export type GlobalAction =
  | { type: "open_theme_picker" }
  | { type: "switch_layout" }
  | { type: "rotate_sidebar" }
  | { type: "open_onboarding" }

export interface CommandPaletteProps {
  entries: AppEntry[]
  theme: Palette
  onSelect: (entry: AppEntry, action: CommandAction) => void
  onGlobalAction?: (action: GlobalAction) => void
  onClose: () => void
  currentLayout?: LayoutMode
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

const VISIBLE_RESULTS = 10

export const CommandPalette: Component<CommandPaletteProps> = (props) => {
  const [query, setQuery] = createSignal("")
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [visibleOffset, setVisibleOffset] = createSignal(0)

  const search = createMemo(() => createAppSearch(props.entries))

  const commands = createMemo((): CommandEntry[] => [
    {
      id: "theme-picker",
      name: "Themes...",
      description: "Pick a color theme",
      keywords: ["theme", "color", "scheme", "palette"],
      action: { type: "open_theme_picker" },
    },
    {
      id: "switch-layout",
      name: props.currentLayout
        ? ("Switch to " + (props.currentLayout === "tabs" ? "panes" : "tabs") + " layout")
        : "Switch layout...",
      description: "Toggle between tabs and panes layout",
      keywords: ["layout", "switch", "tabs", "panes", "mode", "zellij", "classic"],
      action: { type: "switch_layout" },
    },
    {
      id: "rotate-sidebar",
      name: "Rotate sidebar position",
      description: "Cycle sidebar: left → top → right → bottom",
      keywords: ["sidebar", "rotate", "position", "left", "right", "top", "bottom", "move"],
      action: { type: "rotate_sidebar" },
    },
    {
      id: "run-setup-wizard",
      name: "Run setup wizard",
      description: "Re-run the onboarding app picker",
      keywords: ["onboarding", "wizard", "setup", "welcome", "presets", "getting started"],
      action: { type: "open_onboarding" },
    },
  ])

  // Combined results: commands + apps
  const results = createMemo((): ResultItem[] => {
    const trimmedQuery = query().trim()
    const appResults = search().search(query())

    const commandResults = (trimmedQuery ? commands().filter((command) => matchesCommandQuery(trimmedQuery, command)) : commands())
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

  createEffect(() => {
    const nextOffset = getVisibleWindowOffset(
      selectedIndex(),
      results().length,
      VISIBLE_RESULTS,
      visibleOffset()
    )
    if (nextOffset !== visibleOffset()) {
      setVisibleOffset(nextOffset)
    }
  })

  return (
    <DialogBox theme={props.theme} width="60%" height="60%">
      {/* Search input */}
      <box height={1} flexDirection="row" paddingLeft={2} paddingRight={2}>
        <text fg={props.theme.textDim}>{"› "}</text>
        <input
          height={1}
          flexGrow={1}
          value={query()}
          focused
          backgroundColor={props.theme.surface}
          textColor={props.theme.text}
          focusedBackgroundColor={props.theme.surface}
          focusedTextColor={props.theme.text}
          placeholder="Search apps or commands..."
          placeholderColor={props.theme.textDim}
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

      <box height={1} />

      {/* Results list */}
      <box flexDirection="column" flexGrow={1} overflow="hidden" paddingRight={2}>
        <For each={visibleResults()}>
          {(result, index) => {
            const actualIndex = () => visibleOffset() + index()
            const isSelected = () => actualIndex() === selectedIndex()
            const displayText = () => {
              if (result.type === "command") {
                return result.command.name
              }
              return `${result.item.name} — ${buildEntryCommand(result.item)}`
            }
            const isCommand = () => result.type === "command"

            return (
              <box
                height={1}
                width="100%"
                flexDirection="row"
                backgroundColor={isSelected() ? props.theme.surfaceAlt : undefined}
                onMouseDown={() => handleSelect(result, "switch")}
              >
                {/* accent rail */}
                <box width={1} height={1} backgroundColor={isSelected() ? props.theme.accent : undefined} />
                <text
                  width="100%"
                  fg={isCommand() ? props.theme.accent : (isSelected() ? props.theme.text : props.theme.textDim)}
                >
                  {(isCommand() ? " ⌘ " : " ")}{displayText()}
                </text>
              </box>
            )
          }}
        </For>
      </box>

      {/* Footer hints */}
      <box height={1} flexDirection="row" paddingLeft={2} paddingRight={2}>
        <Hint theme={props.theme} keyLabel="↵" desc="select" />
        <Hint theme={props.theme} keyLabel="x" desc="stop" />
        <Hint theme={props.theme} keyLabel="^E" desc="edit" />
        <Hint theme={props.theme} keyLabel="^R" desc="delete" />
        <Hint theme={props.theme} keyLabel="esc" desc="close" />
      </box>
    </DialogBox>
  )
}

const Hint: Component<{ theme: Palette; keyLabel: string; desc: string }> = (props) => (
  <>
    <text fg={props.theme.accent}>
      {"  "}
      <b>{props.keyLabel}</b>
    </text>
    <text fg={props.theme.textDim}>{" " + props.desc}</text>
  </>
)
