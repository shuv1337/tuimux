import { createStore } from "solid-js/store"
import type { FocusMode, PaneId, RunningPane, WindowId, WindowState } from "../types"

export interface WindowsStoreState {
  windows: WindowState[]
  activeWindowId: WindowId | null
  activePaneId: PaneId | null
  focusMode: FocusMode
  runningPanes: Map<PaneId, RunningPane>
}

export function createWindowsStore() {
  const [store, setStore] = createStore<WindowsStoreState>({
    windows: [],
    activeWindowId: null,
    activePaneId: null,
    focusMode: "tabs",
    runningPanes: new Map(),
  })

  const setSnapshot = (
    windows: WindowState[],
    panes: RunningPane[],
    activeWindowId: WindowId | null,
    activePaneId: PaneId | null
  ) => {
    setStore({
      windows,
      activeWindowId,
      activePaneId,
      runningPanes: new Map(panes.map((pane) => [pane.paneId, pane])),
    })
  }

  const setActiveWindow = (id: WindowId | null) => {
    setStore("activeWindowId", id)
  }

  const setActivePane = (id: PaneId | null) => {
    setStore("activePaneId", id)
  }

  const setFocusMode = (mode: FocusMode) => {
    setStore("focusMode", mode)
  }

  const toggleFocus = () => {
    setStore("focusMode", (current) => (current === "tabs" ? "terminal" : "tabs"))
  }

  const upsertWindow = (window: WindowState) => {
    setStore("windows", (current) => {
      const index = current.findIndex((item) => item.id === window.id)
      if (index === -1) {
        return [...current, window]
      }
      const next = current.slice()
      next[index] = window
      return next
    })
  }

  const removeWindow = (id: WindowId) => {
    setStore("windows", (current) => current.filter((window) => window.id !== id))
  }

  const addRunningPane = (pane: RunningPane) => {
    setStore("runningPanes", (current) => {
      const next = new Map(current)
      next.set(pane.paneId, pane)
      return next
    })
  }

  const setRunningPanes = (panes: RunningPane[]) => {
    setStore("runningPanes", () => new Map(panes.map((pane) => [pane.paneId, pane])))
  }

  const removeRunningPane = (paneId: PaneId) => {
    setStore("runningPanes", (current) => {
      const next = new Map(current)
      next.delete(paneId)
      return next
    })
  }

  const updatePaneStatus = (paneId: PaneId, status: RunningPane["status"]) => {
    setStore("runningPanes", (current) => {
      const pane = current.get(paneId)
      if (!pane) return current
      const next = new Map(current)
      next.set(paneId, { ...pane, status })
      return next
    })
  }

  const appendPaneBuffer = (paneId: PaneId, data: string) => {
    const MAX_BUFFER_CHARS = 200_000
    setStore("runningPanes", (current) => {
      const pane = current.get(paneId)
      if (!pane) return current
      const next = new Map(current)
      const nextBuffer = (pane.buffer + data).slice(-MAX_BUFFER_CHARS)
      const nextSeq = (pane.seq ?? pane.buffer.length) + data.length
      next.set(paneId, { ...pane, buffer: nextBuffer, seq: nextSeq })
      return next
    })
  }

  const getRunningPane = (paneId: PaneId) => store.runningPanes.get(paneId)

  return {
    store,
    setSnapshot,
    setActiveWindow,
    setActivePane,
    setFocusMode,
    toggleFocus,
    upsertWindow,
    removeWindow,
    addRunningPane,
    setRunningPanes,
    removeRunningPane,
    updatePaneStatus,
    appendPaneBuffer,
    getRunningPane,
  }
}
