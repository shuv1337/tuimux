import net from "node:net"
import { existsSync, unlinkSync } from "fs"
import { unlink } from "fs/promises"
import { loadConfig } from "./config"
import { clearSession, initSessionPath, restoreSession, saveSession } from "./session"
import { spawnPty, killPty, resizePty, type PtyProcess } from "./pty"
import { debugLog } from "./debug"
import { ensureSocketDir, SOCKET_PATH, serializeMessage, type ClientMessage, type RunningAppSnapshot, type ServerMessage } from "./ipc"
import type {
  AppEntry,
  AppEntryConfig,
  AppStatus,
  Config,
  LayoutMode,
  PaneId,
  PaneSplitDirection,
  SessionAppRef,
  SessionPaneData,
  SessionWindowData,
  WindowId,
  WindowState,
} from "../types"
import { generateId } from "./id"
import { buildSplitNode, collectPaneIds, removePaneLeaf, replacePaneLeaf } from "./layout"
import { handleTabsRunExit } from "./session-lifecycle"

const MAX_BUFFER_CHARS = 200_000

interface ServerRunningApp {
  entry: AppEntry
  restartEntry: AppEntry
  pty: PtyProcess
  status: AppStatus
  buffer: string
  runId: number
}

interface ServerRunningPane {
  paneId: PaneId
  entry: AppEntry
  restartEntry: AppEntry
  pty: PtyProcess
  status: AppStatus
  buffer: string
  runId: number
}

interface PendingOutput {
  data: string
  flushTimer: ReturnType<typeof setTimeout> | null
}

function configToEntry(config: AppEntryConfig): AppEntry {
  return {
    id: config.id ?? generateId(),
    name: config.name,
    command: config.command,
    args: config.args,
    cwd: config.cwd,
    env: config.env,
    autostart: config.autostart ?? false,
    restartOnExit: config.restart_on_exit ?? false,
  }
}

function buildDefaultShellEntry(): AppEntry {
  const shell = process.env.SHELL || "/bin/bash"
  return {
    id: "shell",
    name: "Shell",
    command: shell,
    args: undefined,
    cwd: process.env.HOME || process.cwd(),
    env: undefined,
    autostart: false,
    restartOnExit: false,
  }
}

function buildSnapshot(app: ServerRunningApp): RunningAppSnapshot {
  return {
    entry: app.entry,
    status: app.status,
    buffer: app.buffer,
    runId: app.runId,
  }
}

function resolveSessionEntry(ref: string | SessionAppRef, entries: AppEntry[]): AppEntry | undefined {
  const id = typeof ref === "string" ? ref : ref.id
  const direct = entries.find((entry) => entry.id === id)
  if (direct) {
    return direct
  }

  if (typeof ref === "string") {
    return undefined
  }

  const matchesArgs = (candidate?: string, incoming?: string) => (candidate ?? "") === (incoming ?? "")

  return entries.find(
    (entry) =>
      entry.name === ref.name &&
      entry.command === ref.command &&
      matchesArgs(entry.args, ref.args) &&
      entry.cwd === ref.cwd
  )
}

export async function startSessionServer(layoutOverride?: LayoutMode): Promise<void> {
  const { config } = await loadConfig()
  if (layoutOverride) {
    config.layout = layoutOverride
  }
  if (config.layout === "panes") {
    await startPanesSessionServer(config)
    return
  }
  initSessionPath(config)

  const entries = config.apps.map(configToEntry)
  const runningApps = new Map<string, ServerRunningApp>()
  const pendingOutputs = new Map<string, PendingOutput>()
  const clients = new Set<net.Socket>()
  const manualStopRuns = new Set<number>()
  let nextRunId = 1
  let activeTabId: string | null = null
  let lastCols = 80
  let lastRows = 24
  let server!: net.Server
  let suppressSessionUpdates = false
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let persistPromise: Promise<void> | null = null
  let shuttingDown = false

  const persistSession = async () => {
    if (!config.session.persist) {
      return
    }

    if (persistPromise) {
      await persistPromise
      return
    }

    const runningRefs = Array.from(runningApps.values()).map((app) => ({
      id: app.entry.id,
      name: app.entry.name,
      command: app.entry.command,
      args: app.entry.args,
      cwd: app.entry.cwd,
    }))

    const activeApp = activeTabId ? runningApps.get(activeTabId) : undefined
    const activeRef = activeApp
      ? {
          id: activeApp.entry.id,
          name: activeApp.entry.name,
          command: activeApp.entry.command,
          args: activeApp.entry.args,
          cwd: activeApp.entry.cwd,
        }
      : null

    persistPromise = (async () => {
      try {
        await saveSession({
          runningApps: runningRefs,
          activeTab: activeRef,
          timestamp: Date.now(),
        })
      } catch (error) {
        debugLog(`[server] Failed to save session: ${error}`)
      }
    })()

    try {
      await persistPromise
    } finally {
      persistPromise = null
    }
  }

  const persistIfNeeded = () => {
    if (suppressSessionUpdates || shuttingDown || !config.session.persist) {
      return
    }

    // Debounce frequent updates (output/status changes, tab changes, etc.) into fewer disk writes.
    if (persistTimer) {
      return
    }

    persistTimer = setTimeout(() => {
      persistTimer = null
      void persistSession()
    }, 100)
  }

  const broadcast = (message: ServerMessage) => {
    const payload = serializeMessage(message)
    for (const client of clients) {
      if (!client.destroyed) {
        client.write(payload)
      }
    }
  }

  const flushOutput = (id: string) => {
    const pending = pendingOutputs.get(id)
    if (!pending || pending.data.length === 0) {
      if (pending) {
        pending.flushTimer = null
      }
      return
    }

    const chunk = pending.data
    pending.data = ""
    pending.flushTimer = null

    const app = runningApps.get(id)
    if (app) {
      app.buffer = (app.buffer + chunk).slice(-MAX_BUFFER_CHARS)
    }

    broadcast({ type: "output", id, data: chunk })
  }

  const updateActiveTab = (id: string | null) => {
    activeTabId = id
    broadcast({ type: "active", id })
    persistIfNeeded()
  }

  const startApp = (entry: AppEntry) => {
    if (runningApps.has(entry.id)) {
      return
    }

    const ptyProcess = spawnPty(entry, { cols: lastCols, rows: lastRows })
    const runId = nextRunId++

    const app: ServerRunningApp = {
      entry,
      restartEntry: entry,
      pty: ptyProcess,
      status: "running",
      buffer: "",
      runId,
    }

    runningApps.set(entry.id, app)
    pendingOutputs.set(entry.id, { data: "", flushTimer: null })

    ptyProcess.onData((data) => {
      const pending = pendingOutputs.get(entry.id)
      if (!pending) {
        return
      }
      pending.data += data
      if (!pending.flushTimer) {
        pending.flushTimer = setTimeout(() => flushOutput(entry.id), 50)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      flushOutput(entry.id)
      const wasManualStop = manualStopRuns.has(runId)
      if (wasManualStop) {
        manualStopRuns.delete(runId)
      }

      const result = handleTabsRunExit(
        runningApps,
        pendingOutputs,
        entry.id,
        exitCode,
        wasManualStop
      )
      if (result.status) {
        broadcast({ type: "status", id: entry.id, status: result.status })
      }

      if (result.shouldRestart) {
        setTimeout(() => startApp(app.restartEntry), 1000)
      }
    })

    broadcast({ type: "started", app: buildSnapshot(app) })
    updateActiveTab(entry.id)
    persistIfNeeded()
  }

  const stopApp = (id: string) => {
    const app = runningApps.get(id)
    if (!app) {
      return
    }

    manualStopRuns.add(app.runId)
    killPty(app.pty)
    runningApps.delete(id)
    pendingOutputs.delete(id)
    broadcast({ type: "stopped", id })
    persistIfNeeded()
  }

  const stopAllApps = () => {
    const ids = Array.from(runningApps.keys())
    for (const id of ids) {
      stopApp(id)
    }
    updateActiveTab(null)
  }

  const stopEntry = (id: string) => {
    stopApp(id)
    if (activeTabId === id) {
      updateActiveTab(null)
    }
  }

  const restartApp = (entry: AppEntry) => {
    const app = runningApps.get(entry.id)
    if (!app) {
      return
    }

    stopApp(entry.id)
    setTimeout(() => startApp(entry), 500)
  }

  const resizeAll = (cols: number, rows: number) => {
    lastCols = cols
    lastRows = rows

    for (const [, app] of runningApps) {
      if (app.status === "running") {
        resizePty(app.pty, cols, rows)
      }
    }
  }

  const updateEntry = (id: string, updates: Partial<AppEntry>) => {
    const app = runningApps.get(id)
    if (!app) {
      return
    }
    app.entry = { ...app.entry, ...updates }
    broadcast({ type: "started", app: buildSnapshot(app) })
    persistIfNeeded()
  }

  const shutdown = async (options?: { clearSession?: boolean }) => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }

    if (options?.clearSession) {
      if (persistPromise) {
        await persistPromise
      }
      try {
        await clearSession()
      } catch (error) {
        debugLog(`[server] Failed to clear session: ${error}`)
      }
    } else {
      await persistSession()
    }
    suppressSessionUpdates = true
    stopAllApps()
    for (const client of clients) {
      client.end()
    }

    await new Promise<void>((resolve) => server.close(() => resolve()))

    // Best-effort cleanup so subsequent clients don't trip over stale socket paths.
    try {
      if (existsSync(SOCKET_PATH)) {
        await unlink(SOCKET_PATH)
      }
    } catch (error) {
      debugLog(`[server] Failed to remove socket on shutdown: ${error}`)
    }

    process.exit(0)
  }

  const handleMessage = (message: ClientMessage) => {
    switch (message.type) {
      case "start":
        startApp(message.entry)
        break
      case "stop":
        stopApp(message.id)
        break
      case "stop_all":
        stopAllApps()
        break
      case "stop_entry":
        stopEntry(message.id)
        break
      case "restart":
        restartApp(message.entry)
        break
      case "input": {
        const app = runningApps.get(message.id)
        if (app) {
          app.pty.write(message.data)
        }
        break
      }
      case "resize":
        resizeAll(message.cols, message.rows)
        break
      case "set_active":
        updateActiveTab(message.id)
        break
      case "update_entry":
        updateEntry(message.id, message.updates)
        break
      case "shutdown":
        void shutdown({ clearSession: message.clearSession })
        break
      default:
        break
    }
  }

  await ensureSocketDir()

  if (existsSync(SOCKET_PATH)) {
    try {
      await unlink(SOCKET_PATH)
    } catch (error) {
      debugLog(`[server] Failed to remove stale socket: ${error}`)
    }
  }

  server = net.createServer((socket) => {
    socket.setEncoding("utf8")
    clients.add(socket)

    const snapshot: RunningAppSnapshot[] = Array.from(runningApps.values()).map(buildSnapshot)
    socket.write(
      serializeMessage({
        type: "snapshot",
        layout: "tabs",
        runningApps: snapshot,
        activeTabId,
      })
    )

    let buffer = ""
    socket.on("data", (data) => {
      buffer += data
      let newlineIndex = buffer.indexOf("\n")
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf("\n")
        if (!line) {
          continue
        }
        try {
          const message = JSON.parse(line) as ClientMessage
          handleMessage(message)
        } catch (error) {
          socket.write(
            serializeMessage({
              type: "error",
              message: `Invalid message: ${error instanceof Error ? error.message : "parse error"}`,
            })
          )
        }
      }
    })

    socket.on("close", () => {
      clients.delete(socket)
    })

    socket.on("error", () => {
      clients.delete(socket)
    })
  })

  server.listen(SOCKET_PATH, () => {
    debugLog(`[server] Listening on ${SOCKET_PATH}`)
  })

  // If the process exits without running the async shutdown handler (hard kill/crash),
  // try to remove the socket file to avoid confusing future clients.
  process.on("exit", () => {
    try {
      if (existsSync(SOCKET_PATH)) {
        unlinkSync(SOCKET_PATH)
      }
    } catch {
      // ignore
    }
  })

  if (config.session.persist) {
    const session = await restoreSession()

    for (const entry of entries) {
      if (entry.autostart) {
        startApp(entry)
      }
    }

    if (session) {
      for (const ref of session.runningApps) {
        const entry = resolveSessionEntry(ref, entries)
        if (entry && !entry.autostart) {
          startApp(entry)
        }
      }

      if (session.activeTab) {
        const entry = resolveSessionEntry(session.activeTab, entries)
        if (entry) {
          activeTabId = entry.id
        }
      }
    }
  } else {
    for (const entry of entries) {
      if (entry.autostart) {
        startApp(entry)
      }
    }
  }

  process.on("SIGTERM", () => void shutdown())
  process.on("SIGINT", () => void shutdown())
}

async function startPanesSessionServer(config: Config): Promise<void> {
  initSessionPath(config)

  const entries = config.apps.map(configToEntry)
  const runningPanes = new Map<PaneId, ServerRunningPane>()
  const pendingOutputs = new Map<PaneId, PendingOutput>()
  const windows = new Map<WindowId, WindowState>()
  const clients = new Set<net.Socket>()
  const manualStopRuns = new Set<number>()
  const lastPaneSizes = new Map<PaneId, { cols: number; rows: number }>()
  let nextRunId = 1
  let activeWindowId: WindowId | null = null
  let activePaneId: PaneId | null = null
  let server!: net.Server
  let suppressSessionUpdates = false
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let persistPromise: Promise<void> | null = null
  let shuttingDown = false

  const persistSession = async () => {
    if (!config.session.persist) {
      return
    }

    if (persistPromise) {
      await persistPromise
      return
    }

    const paneRefs: SessionPaneData[] = Array.from(runningPanes.values()).map((pane) => ({
      paneId: pane.paneId,
      entry: {
        id: pane.entry.id,
        name: pane.entry.name,
        command: pane.entry.command,
        args: pane.entry.args,
        cwd: pane.entry.cwd,
      },
    }))

    const runningRefs: SessionAppRef[] = paneRefs.map((pane) => pane.entry)
    const activePane = activePaneId ? runningPanes.get(activePaneId) : undefined
    const activeRef = activePane
      ? {
          id: activePane.entry.id,
          name: activePane.entry.name,
          command: activePane.entry.command,
          args: activePane.entry.args,
          cwd: activePane.entry.cwd,
        }
      : null

    const windowRefs: SessionWindowData[] = Array.from(windows.values()).map((window) => ({
      id: window.id,
      title: window.title,
      layout: window.layout,
      activePaneId: window.activePaneId,
    }))

    persistPromise = (async () => {
      try {
        await saveSession({
          runningApps: runningRefs,
          activeTab: activeRef,
          windows: windowRefs,
          panes: paneRefs,
          activeWindowId,
          activePaneId,
          timestamp: Date.now(),
        })
      } catch (error) {
        debugLog(`[server] Failed to save session: ${error}`)
      }
    })()

    try {
      await persistPromise
    } finally {
      persistPromise = null
    }
  }

  const persistIfNeeded = () => {
    if (suppressSessionUpdates || shuttingDown || !config.session.persist) {
      return
    }

    if (persistTimer) {
      return
    }

    persistTimer = setTimeout(() => {
      persistTimer = null
      void persistSession()
    }, 100)
  }

  const broadcast = (message: ServerMessage) => {
    const payload = serializeMessage(message)
    for (const client of clients) {
      if (!client.destroyed) {
        client.write(payload)
      }
    }
  }

  const buildPaneSnapshot = (pane: ServerRunningPane) => ({
    paneId: pane.paneId,
    entry: pane.entry,
    status: pane.status,
    buffer: pane.buffer,
    runId: pane.runId,
  })

  const buildWindowSnapshot = (window: WindowState) => ({
    id: window.id,
    title: window.title,
    layout: window.layout,
    activePaneId: window.activePaneId,
  })

  const findWindowByPane = (paneId: PaneId) => {
    for (const window of windows.values()) {
      if (collectPaneIds(window.layout).includes(paneId)) {
        return window
      }
    }
    return undefined
  }

  const flushOutput = (paneId: PaneId) => {
    const pending = pendingOutputs.get(paneId)
    if (!pending || pending.data.length === 0) {
      if (pending) {
        pending.flushTimer = null
      }
      return
    }

    const chunk = pending.data
    pending.data = ""
    pending.flushTimer = null

    const pane = runningPanes.get(paneId)
    if (pane) {
      pane.buffer = (pane.buffer + chunk).slice(-MAX_BUFFER_CHARS)
    }

    broadcast({ type: "pane_output", paneId, data: chunk })
  }

  const updateActiveWindow = (id: WindowId | null) => {
    activeWindowId = id
    broadcast({ type: "active_window", id })
    persistIfNeeded()
  }

  const updateActivePane = (paneId: PaneId | null) => {
    activePaneId = paneId
    if (paneId) {
      const window = findWindowByPane(paneId)
      if (window) {
        window.activePaneId = paneId
        windows.set(window.id, window)
        updateActiveWindow(window.id)
        broadcast({ type: "window_changed", window: buildWindowSnapshot(window) })
      }
    }
    broadcast({ type: "active_pane", id: paneId })
    persistIfNeeded()
  }

  // After windows/panes are removed, make sure activeWindowId/activePaneId still point at
  // live state: the active pane must exist in runningPanes AND live in a remaining window.
  // If not, fall back to the first available window's active pane (or null if none remain).
  const ensureActiveStateValid = () => {
    const activeWindow = activeWindowId ? windows.get(activeWindowId) : undefined
    const activePaneAlive =
      activePaneId !== null &&
      runningPanes.has(activePaneId) &&
      findWindowByPane(activePaneId) !== undefined

    if (activeWindow && activePaneAlive && findWindowByPane(activePaneId!)?.id === activeWindow.id) {
      return
    }

    const fallbackWindow = windows.values().next().value as WindowState | undefined
    if (!fallbackWindow) {
      if (activeWindowId !== null) {
        updateActiveWindow(null)
      }
      if (activePaneId !== null) {
        updateActivePane(null)
      }
      return
    }

    updateActiveWindow(fallbackWindow.id)
    updateActivePane(fallbackWindow.activePaneId)
  }

  const startPane = (entry: AppEntry, paneId: PaneId = generateId()) => {
    const existing = runningPanes.get(paneId)
    if (existing && existing.status === "running") {
      return paneId
    }
    if (existing) {
      runningPanes.delete(paneId)
      pendingOutputs.delete(paneId)
    }

    const size = lastPaneSizes.get(paneId) ?? { cols: 80, rows: 24 }
    // Seed the size map so every live pane always has an entry — splitPane's
    // min-size check reads it before the first resize event can populate it.
    lastPaneSizes.set(paneId, size)
    const ptyProcess = spawnPty(entry, { cols: size.cols, rows: size.rows })
    const runId = nextRunId++

    const pane: ServerRunningPane = {
      paneId,
      entry,
      restartEntry: entry,
      pty: ptyProcess,
      status: "running",
      buffer: "",
      runId,
    }

    runningPanes.set(paneId, pane)
    pendingOutputs.set(paneId, { data: "", flushTimer: null })

    ptyProcess.onData((data) => {
      const pending = pendingOutputs.get(paneId)
      if (!pending) {
        return
      }
      pending.data += data
      if (!pending.flushTimer) {
        pending.flushTimer = setTimeout(() => flushOutput(paneId), 50)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      flushOutput(paneId)
      const wasManualStop = manualStopRuns.has(runId)
      if (wasManualStop) {
        manualStopRuns.delete(runId)
      }

      const current = runningPanes.get(paneId)
      if (current) {
        current.status = exitCode === 0 ? "stopped" : "error"
        broadcast({ type: "pane_status", paneId, status: current.status })
      }

      if (!wasManualStop && pane.restartEntry.restartOnExit && exitCode !== 0) {
        setTimeout(() => startPane(pane.restartEntry, paneId), 1000)
      }
    })

    broadcast({ type: "pane_started", pane: buildPaneSnapshot(pane) })
    persistIfNeeded()
    return paneId
  }

  const stopPane = (paneId: PaneId) => {
    const pane = runningPanes.get(paneId)
    if (!pane) {
      return
    }

    manualStopRuns.add(pane.runId)
    killPty(pane.pty)
    runningPanes.delete(paneId)
    pendingOutputs.delete(paneId)
    lastPaneSizes.delete(paneId)
    broadcast({ type: "pane_stopped", paneId })
    persistIfNeeded()
  }

  const createWindow = (entry: AppEntry, options: { makeActive?: boolean } = {}) => {
    const paneId = startPane(entry)
    const windowId = generateId()
    const window: WindowState = {
      id: windowId,
      title: entry.name,
      layout: { type: "leaf", paneId },
      activePaneId: paneId,
    }
    windows.set(windowId, window)
    broadcast({ type: "window_changed", window: buildWindowSnapshot(window) })
    if (options.makeActive !== false) {
      updateActiveWindow(windowId)
      updateActivePane(paneId)
    }
    persistIfNeeded()
  }

  const MIN_PANE_COLS = 10
  const MIN_PANE_ROWS = 3

  const splitPane = (paneId: PaneId, direction: PaneSplitDirection, entry: AppEntry) => {
    const window = findWindowByPane(paneId)
    if (!window) {
      return
    }

    // Reject the split if either resulting sub-pane would be too small to be usable.
    // lastPaneSizes holds the pane's *content* dimensions (outer rect minus the -2 cols /
    // -3 rows borders applied in app.tsx resize). Reconstruct the outer size, halve it along
    // the split axis, then re-subtract the borders to estimate each child's content size.
    const size = lastPaneSizes.get(paneId) ?? { cols: 80, rows: 24 }
    if (direction === "vertical") {
      const childCols = Math.floor((size.cols + 2) / 2) - 2
      if (childCols < MIN_PANE_COLS) {
        return
      }
    } else {
      const childRows = Math.floor((size.rows + 3) / 2) - 3
      if (childRows < MIN_PANE_ROWS) {
        return
      }
    }

    const newPaneId = startPane(entry)
    const nextLayout = replacePaneLeaf(
      window.layout,
      paneId,
      buildSplitNode(direction, paneId, newPaneId)
    )
    const nextWindow: WindowState = {
      ...window,
      layout: nextLayout,
      activePaneId: newPaneId,
    }
    windows.set(window.id, nextWindow)
    broadcast({ type: "window_changed", window: buildWindowSnapshot(nextWindow) })
    updateActivePane(newPaneId)
  }

  const closePane = (paneId: PaneId) => {
    const window = findWindowByPane(paneId)
    if (!window) {
      return
    }

    stopPane(paneId)
    const removal = removePaneLeaf(window.layout, paneId)
    if (!removal.removed) {
      return
    }

    if (!removal.layout) {
      windows.delete(window.id)
      broadcast({ type: "window_closed", windowId: window.id })
      ensureActiveStateValid()
      persistIfNeeded()
      return
    }

    const remainingPaneIds = collectPaneIds(removal.layout)
    const nextActivePane = remainingPaneIds[0]
    const nextWindow: WindowState = {
      ...window,
      layout: removal.layout,
      activePaneId: nextActivePane,
    }
    windows.set(window.id, nextWindow)
    broadcast({ type: "window_changed", window: buildWindowSnapshot(nextWindow) })
    if (activePaneId === paneId) {
      updateActivePane(nextActivePane)
    }
    ensureActiveStateValid()
    persistIfNeeded()
  }

  const closeWindow = (windowId: WindowId) => {
    const window = windows.get(windowId)
    if (!window) {
      return
    }

    const paneIds = collectPaneIds(window.layout)
    for (const paneId of paneIds) {
      stopPane(paneId)
    }

    windows.delete(windowId)
    broadcast({ type: "window_closed", windowId })

    ensureActiveStateValid()
    persistIfNeeded()
  }

  const closeEntryPanes = (entryId: string) => {
    const paneIds = Array.from(runningPanes.values())
      .filter((pane) => pane.entry.id === entryId)
      .map((pane) => pane.paneId)

    for (const paneId of paneIds) {
      if (findWindowByPane(paneId)) {
        closePane(paneId)
      } else {
        stopPane(paneId)
      }
    }
  }

  const resizePane = (paneId: PaneId, cols: number, rows: number) => {
    lastPaneSizes.set(paneId, { cols, rows })
    const pane = runningPanes.get(paneId)
    if (pane && pane.status === "running") {
      resizePty(pane.pty, cols, rows)
    }
  }

  const shutdown = async (options?: { clearSession?: boolean }) => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }

    if (options?.clearSession) {
      if (persistPromise) {
        await persistPromise
      }
      try {
        await clearSession()
      } catch (error) {
        debugLog(`[server] Failed to clear session: ${error}`)
      }
    } else {
      await persistSession()
    }

    suppressSessionUpdates = true
    for (const window of windows.values()) {
      for (const paneId of collectPaneIds(window.layout)) {
        stopPane(paneId)
      }
    }
    windows.clear()

    for (const client of clients) {
      client.end()
    }

    await new Promise<void>((resolve) => server.close(() => resolve()))

    try {
      if (existsSync(SOCKET_PATH)) {
        await unlink(SOCKET_PATH)
      }
    } catch (error) {
      debugLog(`[server] Failed to remove socket on shutdown: ${error}`)
    }

    process.exit(0)
  }

  const handleMessage = (message: ClientMessage) => {
    switch (message.type) {
      case "create_window":
        createWindow(message.entry)
        break
      case "split_pane":
        splitPane(message.paneId, message.direction, message.entry)
        break
      case "close_pane":
        closePane(message.paneId)
        break
      case "close_window":
        closeWindow(message.windowId)
        break
      case "stop_entry":
        closeEntryPanes(message.id)
        break
      case "set_active_window":
        if (message.id) {
          const window = windows.get(message.id)
          updateActivePane(window?.activePaneId ?? null)
        } else {
          updateActivePane(null)
          updateActiveWindow(null)
        }
        break
      case "set_active_pane":
        updateActivePane(message.id)
        break
      case "resize_pane":
        resizePane(message.paneId, message.cols, message.rows)
        break
      case "input": {
        const pane = runningPanes.get(message.id)
        if (pane) {
          pane.pty.write(message.data)
        }
        break
      }
      case "shutdown":
        void shutdown({ clearSession: message.clearSession })
        break
      default:
        break
    }
  }

  await ensureSocketDir()

  if (existsSync(SOCKET_PATH)) {
    try {
      await unlink(SOCKET_PATH)
    } catch (error) {
      debugLog(`[server] Failed to remove stale socket: ${error}`)
    }
  }

  server = net.createServer((socket) => {
    socket.setEncoding("utf8")
    clients.add(socket)

    const snapshotWindows = Array.from(windows.values()).map(buildWindowSnapshot)
    const snapshotPanes = Array.from(runningPanes.values()).map(buildPaneSnapshot)
    socket.write(
      serializeMessage({
        type: "snapshot",
        layout: "panes",
        windows: snapshotWindows,
        panes: snapshotPanes,
        activeWindowId,
        activePaneId,
      })
    )

    let buffer = ""
    socket.on("data", (data) => {
      buffer += data
      let newlineIndex = buffer.indexOf("\n")
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf("\n")
        if (!line) {
          continue
        }
        try {
          const message = JSON.parse(line) as ClientMessage
          handleMessage(message)
        } catch (error) {
          socket.write(
            serializeMessage({
              type: "error",
              message: `Invalid message: ${error instanceof Error ? error.message : "parse error"}`,
            })
          )
        }
      }
    })

    socket.on("close", () => {
      clients.delete(socket)
    })

    socket.on("error", () => {
      clients.delete(socket)
    })
  })

  server.listen(SOCKET_PATH, () => {
    debugLog(`[server] Listening on ${SOCKET_PATH}`)
  })

  process.on("exit", () => {
    try {
      if (existsSync(SOCKET_PATH)) {
        unlinkSync(SOCKET_PATH)
      }
    } catch {
      // ignore
    }
  })

  if (config.session.persist) {
    const session = await restoreSession()

    const startedEntries = new Set<string>()
    if (session?.panes && session.windows?.length) {
      for (const pane of session.panes) {
        const entry = resolveSessionEntry(pane.entry, entries)
        if (entry) {
          startPane(entry, pane.paneId)
          startedEntries.add(entry.id)
        }
      }

      for (const window of session.windows) {
        const paneIds = collectPaneIds(window.layout)
        const livePaneIds = paneIds.filter((paneId) => runningPanes.has(paneId))
        if (livePaneIds.length === 0) {
          continue
        }

        // The persisted activePaneId may reference a pane that no longer exists (failed to
        // restart) or that isn't part of this window's layout; fall back to the first live pane.
        const activePaneId =
          paneIds.includes(window.activePaneId) && runningPanes.has(window.activePaneId)
            ? window.activePaneId
            : livePaneIds[0]

        windows.set(window.id, {
          id: window.id,
          title: window.title,
          layout: window.layout,
          activePaneId,
        })
      }

      // Validate the top-level active pointers against the live, restored state; otherwise
      // fall back to the first restored window and its (validated) active pane.
      const firstWindow = windows.values().next().value as WindowState | undefined
      const restoredActiveWindow =
        session.activeWindowId && windows.has(session.activeWindowId)
          ? windows.get(session.activeWindowId)
          : undefined
      const activeWindow = restoredActiveWindow ?? firstWindow

      if (activeWindow) {
        activeWindowId = activeWindow.id
        const candidatePane = session.activePaneId
        const candidateWindow = candidatePane ? findWindowByPane(candidatePane) : undefined
        if (
          candidatePane &&
          runningPanes.has(candidatePane) &&
          candidateWindow !== undefined
        ) {
          activePaneId = candidatePane
          activeWindowId = candidateWindow.id
        } else {
          activePaneId = activeWindow.activePaneId
        }
      } else {
        activeWindowId = null
        activePaneId = null
      }
    }

    for (const entry of entries) {
      if (entry.autostart && !startedEntries.has(entry.id)) {
        createWindow(entry, { makeActive: false })
      }
    }

    if (!windows.size && session?.runningApps?.length) {
      for (const ref of session.runningApps) {
        const entry = resolveSessionEntry(ref, entries)
        if (entry) {
          createWindow(entry, { makeActive: false })
        }
      }
    }
  } else {
    for (const entry of entries) {
      if (entry.autostart) {
        createWindow(entry, { makeActive: false })
      }
    }
  }

  if (!windows.size) {
    const shellEntry = entries.find((entry) => entry.id === "shell") ?? buildDefaultShellEntry()
    createWindow(shellEntry)
  }

  if (!activeWindowId && windows.size > 0) {
    const firstWindow = windows.values().next().value as WindowState | undefined
    if (firstWindow) {
      updateActiveWindow(firstWindow.id)
      updateActivePane(firstWindow.activePaneId)
    }
  }

  process.on("SIGTERM", () => void shutdown())
  process.on("SIGINT", () => void shutdown())
}
