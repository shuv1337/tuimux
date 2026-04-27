import { mkdir } from "fs/promises"
import { dirname } from "path"
import { paths } from "./xdg"
import type {
  AppEntry,
  AppStatus,
  LayoutMode,
  PaneId,
  PaneLayoutNode,
  PaneSplitDirection,
  WindowId,
} from "../types"

export const SOCKET_PATH = paths.socket

export async function ensureSocketDir(): Promise<void> {
  await mkdir(dirname(SOCKET_PATH), { recursive: true })
}

export interface RunningAppSnapshot {
  entry: AppEntry
  status: AppStatus
  buffer: string
  runId: number
}

export interface RunningPaneSnapshot {
  paneId: PaneId
  entry: AppEntry
  status: AppStatus
  buffer: string
  runId: number
}

export interface WindowSnapshot {
  id: WindowId
  title: string
  layout: PaneLayoutNode
  activePaneId: PaneId
}

export type ClientMessage =
  | { type: "start"; entry: AppEntry }
  | { type: "stop"; id: string }
  | { type: "stop_all" }
  | { type: "stop_entry"; id: string }
  | { type: "restart"; entry: AppEntry }
  | { type: "input"; id: string; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "set_active"; id: string | null }
  | { type: "update_entry"; id: string; updates: Partial<AppEntry> }
  | { type: "shutdown"; clearSession?: boolean }
  | { type: "create_window"; entry: AppEntry }
  | { type: "split_pane"; paneId: PaneId; direction: PaneSplitDirection; entry: AppEntry }
  | { type: "close_pane"; paneId: PaneId }
  | { type: "close_window"; windowId: WindowId }
  | { type: "set_active_window"; id: WindowId | null }
  | { type: "set_active_pane"; id: PaneId | null }
  | { type: "resize_pane"; paneId: PaneId; cols: number; rows: number }

export type ServerMessage =
  | {
      type: "snapshot"
      layout: LayoutMode
      runningApps?: RunningAppSnapshot[]
      activeTabId?: string | null
      windows?: WindowSnapshot[]
      panes?: RunningPaneSnapshot[]
      activeWindowId?: WindowId | null
      activePaneId?: PaneId | null
    }
  | { type: "started"; app: RunningAppSnapshot }
  | { type: "stopped"; id: string }
  | { type: "status"; id: string; status: AppStatus }
  | { type: "output"; id: string; data: string }
  | { type: "active"; id: string | null }
  | { type: "pane_started"; pane: RunningPaneSnapshot }
  | { type: "pane_stopped"; paneId: PaneId }
  | { type: "pane_status"; paneId: PaneId; status: AppStatus }
  | { type: "pane_output"; paneId: PaneId; data: string }
  | { type: "window_changed"; window: WindowSnapshot }
  | { type: "window_closed"; windowId: WindowId }
  | { type: "active_window"; id: WindowId | null }
  | { type: "active_pane"; id: PaneId | null }
  | { type: "error"; message: string }

export function serializeMessage(message: ClientMessage | ServerMessage): string {
  return `${JSON.stringify(message)}\n`
}
