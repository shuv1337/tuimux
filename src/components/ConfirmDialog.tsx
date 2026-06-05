import { Component } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { ThemeConfig } from "../types"
import { DialogBox } from "./DialogBox"

export interface ConfirmDialogProps {
  theme: ThemeConfig
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
    <DialogBox theme={props.theme} top="35%" left="25%" width="50%" height={9}>
      {/* Title */}
      <box height={1} paddingLeft={1}>
        <text fg={props.theme.accent}>
          <b>{props.title}</b>
        </text>
      </box>

      <box height={1} />

      {/* Message */}
      <box height={1} paddingLeft={1} paddingRight={1}>
        <text fg={props.theme.foreground}>{props.message}</text>
      </box>

      {/* Optional detail line */}
      {props.detail ? (
        <box height={1} paddingLeft={1} paddingRight={1}>
          <text fg={props.theme.muted}>{props.detail}</text>
        </box>
      ) : null}

      <box flexGrow={1} />

      {/* Footer */}
      <box height={1} paddingLeft={1}>
        <text fg={props.theme.muted}>
          {props.confirmHint ?? "y:Confirm"}
          {"  |  "}
          {props.cancelHint ?? "n/Esc:Cancel"}
        </text>
      </box>
    </DialogBox>
  )
}
