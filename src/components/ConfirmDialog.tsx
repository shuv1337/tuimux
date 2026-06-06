import { Component } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { Palette } from "../lib/palette"
import { DialogBox } from "./DialogBox"

export interface ConfirmDialogProps {
  theme: Palette
  title: string
  message: string
  detail?: string
  confirmHint?: string
  cancelHint?: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  useKeyboard((event) => {
    // Require an explicit "y" to confirm a destructive action.
    if (event.name === "y") {
      props.onConfirm()
      event.preventDefault()
      return
    }

    if (event.name === "n" || event.name === "escape") {
      props.onCancel()
      event.preventDefault()
      return
    }
  })

  return (
    <DialogBox theme={props.theme} width="50%" height={9}>
      {/* Title */}
      <box height={1} paddingLeft={2}>
        <text fg={props.theme.error}>
          <b>{props.title}</b>
        </text>
      </box>

      <box height={1} />

      {/* Message */}
      <box height={1} paddingLeft={2} paddingRight={2}>
        <text fg={props.theme.text}>{props.message}</text>
      </box>

      {/* Optional detail line */}
      {props.detail ? (
        <box height={1} paddingLeft={2} paddingRight={2}>
          <text fg={props.theme.textDim}>{props.detail}</text>
        </box>
      ) : null}

      <box flexGrow={1} />

      {/* Footer */}
      <box height={1} paddingLeft={2}>
        <text fg={props.theme.textDim}>
          {props.confirmHint ?? "y:Confirm"}
          {"   "}
          {props.cancelHint ?? "n/Esc:Cancel"}
        </text>
      </box>
    </DialogBox>
  )
}
