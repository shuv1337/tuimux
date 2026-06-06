import { Component } from "solid-js"
import type { JSX } from "solid-js"
import type { PaneLayoutNode, RunningPane } from "../types"
import type { Palette } from "../lib/palette"
import { PaneView } from "./PaneView"

export interface PaneLayoutProps {
  layout: PaneLayoutNode | null
  panes: Map<string, RunningPane>
  activePaneId: string | null
  width: number
  height: number
  theme: Palette
}

function splitSize(total: number): [number, number] {
  const first = Math.floor(total / 2)
  const second = total - first
  return [first, second]
}

export const PaneLayout: Component<PaneLayoutProps> = (props) => {
  const renderNode = (node: PaneLayoutNode, width: number, height: number): JSX.Element => {
    if (node.type === "leaf") {
      const pane = props.panes.get(node.paneId)
      return (
        <PaneView
          pane={pane}
          isActive={node.paneId === props.activePaneId}
          width={width}
          height={height}
          theme={props.theme}
        />
      )
    }

    if (node.direction === "vertical") {
      const [leftWidth, rightWidth] = splitSize(width)
      const first = renderNode(node.children[0], leftWidth, height)
      const second = renderNode(node.children[1], rightWidth, height)
      return (
        <box flexDirection="row" width={width} height={height}>
          <box width={leftWidth} height={height}>
            {first}
          </box>
          <box width={rightWidth} height={height}>
            {second}
          </box>
        </box>
      )
    }

    const [topHeight, bottomHeight] = splitSize(height)
    const first = renderNode(node.children[0], width, topHeight)
    const second = renderNode(node.children[1], width, bottomHeight)
    return (
      <box flexDirection="column" width={width} height={height}>
        <box width={width} height={topHeight}>
          {first}
        </box>
        <box width={width} height={bottomHeight}>
          {second}
        </box>
      </box>
    )
  }

  return (
    <box width={props.width} height={props.height}>
      {props.layout ? (
        renderNode(props.layout, props.width, props.height)
      ) : (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={props.theme.textDim}>No panes running</text>
        </box>
      )}
    </box>
  )
}
