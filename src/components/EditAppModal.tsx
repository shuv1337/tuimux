import { Component, createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { ThemeConfig, AppEntry } from "../types"
import { DialogBox } from "./DialogBox"

export interface EditAppModalProps {
  theme: ThemeConfig
  entry: Pick<AppEntry, "id" | "name" | "command" | "args" | "cwd">
  onSave: (updates: { name: string; command: string; args?: string; cwd: string }) => void
  onDelete: () => void
  onClose: () => void
}

type Field = "name" | "command" | "args" | "cwd"

export const EditAppModal: Component<EditAppModalProps> = (props) => {
  // Initialize directly from props
  const [name, setName] = createSignal(props.entry.name ?? "")
  const [command, setCommand] = createSignal(props.entry.command ?? "")
  const [args, setArgs] = createSignal(props.entry.args ?? "")
  const [cwd, setCwd] = createSignal(props.entry.cwd ?? "")
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
      props.onSave({
        name: name(),
        command: command(),
        args: args().trim() || undefined,
        cwd: cwd() || "~",
      })
    }
  }

  useKeyboard((event) => {
    if (event.name === "escape") {
      props.onClose()
      event.preventDefault()
      return
    }

    if (event.name === "tab") {
      const direction = event.shift ? -1 : 1
      setFocusByIndex(focusIndex() + direction)
      event.preventDefault()
      return
    }

    if (event.name === "return" || event.name === "enter") {
      handleSubmit()
      event.preventDefault()
      return
    }

    // Ctrl+D: delete this app (parent shows a confirmation first)
    if ((event.ctrl && event.name === "d") || event.sequence === "\u0004") {
      props.onDelete()
      event.preventDefault()
      return
    }

    const focused = fields[focusIndex()]
    if (!focused) {
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

  return (
    <DialogBox
      theme={props.theme}
      top="30%"
      left="25%"
      width="50%"
      height={12}
    >
      {/* Title */}
      <box height={1}>
        <text fg={props.theme.accent}>
          <b> Edit App</b>
        </text>
      </box>

      {/* Fields */}
      {fields.map((field) => {
        const isFocused = () => focusedField() === field.key
        return (
          <box height={1} flexDirection="row">
            <box width={12}>
              <text fg={isFocused() ? props.theme.accent : props.theme.muted}>{field.label}:</text>
            </box>
            <text
              fg={isFocused() ? props.theme.foreground : props.theme.muted}
              bg={isFocused() ? props.theme.primary : undefined}
            >
              {" "}{field.value()}{isFocused() ? "█" : " "}
            </text>
          </box>
        )
      })}

      {/* Footer */}
      <box height={1}>
        <text fg={props.theme.muted}>
          Enter:Save | Ctrl+D:Delete | Esc:Cancel | Tab:Next field
        </text>
      </box>
    </DialogBox>
  )
}
