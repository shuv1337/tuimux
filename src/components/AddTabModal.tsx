import { Component, createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { AppEntryConfig } from "../types"
import type { Palette } from "../lib/palette"
import { APP_PRESETS, type AppPreset } from "../lib/presets"
import { commandExists } from "../lib/command"
import { DialogBox } from "./DialogBox"

export interface AddTabModalProps {
  theme: Palette
  onAdd: (entry: AppEntryConfig) => void
  onClose: () => void
}

type Field = "name" | "command" | "args" | "cwd"

export const AddTabModal: Component<AddTabModalProps> = (props) => {
  const [mode, setMode] = createSignal<"preset" | "custom">("preset")
  const [selectedPresetIndex, setSelectedPresetIndex] = createSignal(0)

  const [presetsWithAvailability, setPresetsWithAvailability] = createSignal<AppPreset[]>(APP_PRESETS)

  createEffect(() => {
    let cancelled = false

    const loadAvailability = async () => {
      const presets = await Promise.all(
        APP_PRESETS.map(async (preset) => ({
          ...preset,
          available: await commandExists(preset.command),
        }))
      )
      presets.sort((a, b) => {
        if (a.available !== b.available) {
          return a.available ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      if (!cancelled) {
        setPresetsWithAvailability(presets)
      }
    }

    void loadAvailability()

    onCleanup(() => {
      cancelled = true
    })
  })

  const [name, setName] = createSignal("")
  const [command, setCommand] = createSignal("")
  const [args, setArgs] = createSignal("")
  const [cwd, setCwd] = createSignal("~")
  const [focusedField, setFocusedField] = createSignal<Field>("name")

  const fields: { key: Field; label: string; value: () => string; setValue: (v: string) => void }[] = [
    { key: "name", label: "Name", value: name, setValue: setName },
    { key: "command", label: "Command", value: command, setValue: setCommand },
    { key: "args", label: "Arguments", value: args, setValue: setArgs },
    { key: "cwd", label: "Directory", value: cwd, setValue: setCwd },
  ]

  const focusIndex = () => fields.findIndex((field) => field.key === focusedField())
  const setFocusByIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(fields.length - 1, index))
    setFocusedField(fields[clamped].key)
  }

  const handleSubmit = () => {
    if (name() && command()) {
      props.onAdd({
        name: name(),
        command: command(),
        args: args().trim() || undefined,
        cwd: cwd() || "~",
        autostart: false,
      })
    }
  }

  const handlePresetSelect = (preset: AppPreset) => {
    props.onAdd({
      name: preset.name,
      command: preset.command,
      cwd: "~",
      autostart: false,
    })
  }

  useKeyboard((event) => {
    if (event.name === "escape") {
      props.onClose()
      event.preventDefault()
      return
    }

    // Tab key toggles between preset and custom mode
    if (event.name === "tab") {
      setMode(mode() === "preset" ? "custom" : "preset")
      event.preventDefault()
      return
    }

    // Handle preset mode navigation
    if (mode() === "preset") {
      const presets = presetsWithAvailability()
      if (event.name === "return" || event.name === "enter") {
        const selectedPreset = presets[selectedPresetIndex()]
        if (selectedPreset && selectedPreset.available !== false) {
          handlePresetSelect(selectedPreset)
        }
        event.preventDefault()
        return
      }

      if (event.sequence === "j" || event.name === "down") {
        setSelectedPresetIndex(Math.min(selectedPresetIndex() + 1, presets.length - 1))
        event.preventDefault()
        return
      }

      if (event.sequence === "k" || event.name === "up") {
        setSelectedPresetIndex(Math.max(selectedPresetIndex() - 1, 0))
        event.preventDefault()
        return
      }
      return
    }

    // Handle custom mode
    if (event.name === "return" || event.name === "enter") {
      handleSubmit()
      event.preventDefault()
      return
    }

    const focused = fields[focusIndex()]
    if (!focused) {
      return
    }

    // Up/Down for field navigation in custom mode
    if (event.name === "down") {
      setFocusByIndex(focusIndex() + 1)
      event.preventDefault()
      return
    }

    if (event.name === "up") {
      setFocusByIndex(focusIndex() - 1)
      event.preventDefault()
      return
    }

    if (event.name === "backspace") {
      focused.setValue(focused.value().slice(0, -1))
      event.preventDefault()
      return
    }

    if (!event.ctrl && !event.meta && !event.option && event.sequence && event.sequence.length === 1) {
      focused.setValue(focused.value() + event.sequence)
      event.preventDefault()
    }
  })

  // Calculate scroll offset for preset list
  const VISIBLE_PRESETS = 12
  const scrollOffset = createMemo(() => {
    const idx = selectedPresetIndex()
    const presets = presetsWithAvailability()
    if (presets.length <= VISIBLE_PRESETS) return 0
    // Keep selected item in view
    const maxOffset = presets.length - VISIBLE_PRESETS
    if (idx < 3) return 0
    if (idx > presets.length - 4) return maxOffset
    return Math.min(idx - 3, maxOffset)
  })

  return (
    <DialogBox theme={props.theme} width="60%" height={20}>
      {/* Title */}
      <box height={1} paddingLeft={2}>
        <text fg={props.theme.accent}>
          <b>Add New App</b>
        </text>
      </box>

      {/* Mode tabs */}
      <box height={1} flexDirection="row" paddingLeft={2}>
        <text
          fg={mode() === "preset" ? props.theme.accent : props.theme.textDim}
          bg={mode() === "preset" ? props.theme.surfaceAlt : undefined}
        >
          {" Presets "}
        </text>
        <text> </text>
        <text
          fg={mode() === "custom" ? props.theme.accent : props.theme.textDim}
          bg={mode() === "custom" ? props.theme.surfaceAlt : undefined}
        >
          {" Custom "}
        </text>
      </box>

      <box height={1} />

      {/* Preset list - show when mode is preset */}
      {mode() === "preset" && (
        <box flexDirection="column" flexGrow={1} paddingRight={2}>
          {presetsWithAvailability()
            .slice(scrollOffset(), scrollOffset() + VISIBLE_PRESETS)
            .map((preset, index) => {
              const actualIndex = () => scrollOffset() + index
              const isSelected = () => selectedPresetIndex() === actualIndex()
              const unavailable = () => preset.available === false
              const dot = () =>
                preset.available === true ? "●" : preset.available === false ? "·" : "?"
              const dotColor = () =>
                preset.available === true
                  ? props.theme.on
                  : preset.available === false
                    ? props.theme.off
                    : props.theme.warn
              return (
                <box height={1} flexDirection="row" backgroundColor={isSelected() ? props.theme.surfaceAlt : undefined}>
                  <box width={1} height={1} backgroundColor={isSelected() ? props.theme.accent : undefined} />
                  <text fg={dotColor()}>{" " + dot() + " "}</text>
                  <text fg={unavailable() ? props.theme.textDim : (isSelected() ? props.theme.text : props.theme.textDim)}>
                    {preset.name.padEnd(18)}
                  </text>
                  <text fg={props.theme.textDim}>
                    {preset.command.padEnd(18)}
                    {preset.description}
                  </text>
                </box>
              )
            })}
          {/* Scroll indicator */}
          {presetsWithAvailability().length > VISIBLE_PRESETS && (
            <box height={1} paddingLeft={2}>
              <text fg={props.theme.textDim}>
                {scrollOffset() > 0 ? "↑ " : "  "}
                {selectedPresetIndex() + 1}/{presetsWithAvailability().length}
                {scrollOffset() + VISIBLE_PRESETS < presetsWithAvailability().length ? " ↓" : ""}
              </text>
            </box>
          )}
        </box>
      )}

      {/* Custom form fields - show when mode is custom */}
      {mode() === "custom" && (
        <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
          {fields.map((field) => {
            const isFocused = () => focusedField() === field.key
            return (
              <box height={1} flexDirection="row">
                <box width={12}>
                  <text fg={isFocused() ? props.theme.accent : props.theme.textDim}>{field.label}:</text>
                </box>
                <text
                  fg={props.theme.text}
                  bg={isFocused() ? props.theme.surfaceAlt : undefined}
                >
                  {" "}{field.value()}{isFocused() ? "█" : " "}
                </text>
              </box>
            )
          })}
        </box>
      )}

      {/* Footer - different hints based on mode */}
      <box height={1} flexDirection="row" paddingLeft={2}>
        {mode() === "preset" ? (
          <>
            <Hint theme={props.theme} keyLabel="↵" desc="add" />
            <Hint theme={props.theme} keyLabel="tab" desc="custom" />
            <Hint theme={props.theme} keyLabel="j/k" desc="nav" />
            <Hint theme={props.theme} keyLabel="esc" desc="cancel" />
          </>
        ) : (
          <>
            <Hint theme={props.theme} keyLabel="↵" desc="add" />
            <Hint theme={props.theme} keyLabel="tab" desc="presets" />
            <Hint theme={props.theme} keyLabel="↑↓" desc="field" />
            <Hint theme={props.theme} keyLabel="esc" desc="cancel" />
          </>
        )}
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
