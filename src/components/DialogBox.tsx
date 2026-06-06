import { Component } from "solid-js"
import type { JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { Palette } from "../lib/palette"

type DimensionValue = number | `${number}%`

export interface DialogBoxProps {
  theme: Palette
  /** Desired width — a column count or a `%` of the terminal. Default 60%. */
  width?: DimensionValue
  /** Desired height — a row count or a `%` of the terminal. Default 50%. */
  height?: DimensionValue
  children?: JSX.Element
}

function resolveDim(value: DimensionValue | undefined, total: number, fallbackPct: number): number {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.endsWith("%")) {
    return Math.round((parseFloat(value) / 100) * total)
  }
  return Math.round((fallbackPct / 100) * total)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const DialogBox: Component<DialogBoxProps> = (props) => {
  const dims = useTerminalDimensions()

  const w = () => clamp(resolveDim(props.width, dims().width, 60), 24, Math.max(24, dims().width - 2))
  const h = () => clamp(resolveDim(props.height, dims().height, 50), 5, Math.max(5, dims().height - 2))
  const left = () => Math.max(0, Math.floor((dims().width - w()) / 2))
  const top = () => Math.max(0, Math.floor((dims().height - h()) / 2))

  return (
    <box
      position="absolute"
      top={top()}
      left={left()}
      width={w()}
      height={h()}
      flexDirection="column"
      paddingTop={1}
      paddingBottom={1}
      borderStyle="rounded"
      borderColor={props.theme.borderFocus}
      backgroundColor={props.theme.surface}
    >
      {props.children}
    </box>
  )
}
