import { Component, Show, createSignal, createEffect, onCleanup, createMemo, onMount } from "solid-js"
import { useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/solid"
import { TabList } from "./components/TabList"
import { TerminalPane } from "./components/TerminalPane"
import { PaneLayout } from "./components/PaneLayout"
import { WindowBar } from "./components/WindowBar"
import { StatusBar } from "./components/StatusBar"
import { CommandPalette, type GlobalAction } from "./components/CommandPalette"
import { AddTabModal } from "./components/AddTabModal"
import { EditAppModal } from "./components/EditAppModal"
import { ThemePicker } from "./components/ThemePicker"

import { createAppsStore } from "./stores/apps"
import { createTabsStore } from "./stores/tabs"
import { createWindowsStore } from "./stores/windows"
import { createUIStore } from "./stores/ui"
import { saveConfig } from "./lib/config"
import { matchesKeybind } from "./lib/keybinds"
import { debugLog } from "./lib/debug"
import { getThemeById } from "./lib/themes"
import { computePaneRects, collectPaneIds } from "./lib/layout"
import type { SessionClient } from "./lib/session-client"
import type { RunningAppSnapshot, RunningPaneSnapshot, ServerMessage, WindowSnapshot } from "./lib/ipc"
import type { AppStatus, AppEntry, AppEntryConfig, Config, ThemeConfig } from "./types"

export interface AppProps {
  config: Config
  sessionClient: SessionClient
  startWithAddModal?: boolean
}

export const App: Component<AppProps> = (props) => {
  const renderer = useRenderer()

  // Initialize stores
  const appsStore = createAppsStore(props.config.apps)
  const tabsStore = createTabsStore()
  const windowsStore = createWindowsStore()
  const uiStore = createUIStore()

  const pendingPaneBuffers = new Map<string, string>()

  // Get terminal dimensions from opentui
  const terminalDims = useTerminalDimensions()

  // Tab list selection (separate from active tab for keyboard navigation)
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const [isDisconnecting, setIsDisconnecting] = createSignal(false)
  const [editingEntryId, setEditingEntryId] = createSignal<string | null>(null)
  const [lastGTime, setLastGTime] = createSignal(0)
  const [currentTheme, setCurrentTheme] = createSignal<ThemeConfig>(props.config.theme)

  // Double-tap Ctrl+A detection for passthrough
  let lastCtrlATime = 0

  const [layoutMode, setLayoutMode] = createSignal(props.config.layout)
  let warnedLayoutMismatch = false

  const isZellijLayout = () => layoutMode() === "zellij"

  const getClassicPtyDimensions = () => {
    const dims = terminalDims()
    const cols = dims.width - props.config.tab_width - 2
    const rows = dims.height - 4
    return { cols, rows }
  }

  const setActiveTab = (id: string | null, options: { broadcast?: boolean } = {}) => {
    tabsStore.setActiveTab(id)
    if (options.broadcast) {
      props.sessionClient.setActiveTab(id)
    }
  }

  // Start an app
  const startApp = (entry: AppEntry) => {
    // Don't start if already running
    if (tabsStore.store.runningApps.has(entry.id)) {
      return
    }

    const { cols, rows } = getClassicPtyDimensions()

    // Don't start with invalid dimensions
    if (cols < 10 || rows < 3) {
      console.warn(`Skipping start for ${entry.name}: invalid dimensions ${cols}x${rows}`)
      return
    }

    props.sessionClient.start(entry)
    setActiveTab(entry.id, { broadcast: true })
    uiStore.showTemporaryMessage(`Started: ${entry.name}`)
  }

  // Stop an app
  const stopApp = (id: string, options: { silent?: boolean } = {}) => {
    const app = tabsStore.getRunningApp(id)
    if (app) {
      props.sessionClient.stop(id)
      if (!options.silent) {
        uiStore.showTemporaryMessage(`Stopped: ${app.entry.name}`)
      }
    }
  }

  const stopAllApps = (options: { showMessage?: boolean } = {}) => {
    const runningIds = Array.from(tabsStore.store.runningApps.keys())
    if (runningIds.length === 0) {
      if (options.showMessage) {
        uiStore.showTemporaryMessage("No running apps")
      }
      return
    }

    props.sessionClient.stopAll()
    setActiveTab(null, { broadcast: true })

    if (options.showMessage) {
      uiStore.showTemporaryMessage(
        `Stopped ${runningIds.length} app${runningIds.length === 1 ? "" : "s"}`
      )
    }
  }

  // Restart an app
  const restartApp = (id: string) => {
    const app = tabsStore.getRunningApp(id)
    const entry = appsStore.getEntry(id)
    if (app && entry) {
      props.sessionClient.restart(entry)
    }
  }

  // Get app status
  const getAppStatus = (id: string) => {
    const app = tabsStore.getRunningApp(id)
    return app?.status ?? "stopped"
  }

  // Handle keyboard navigation in tab list
  const handleTabNavigation = (direction: "up" | "down") => {
    const entries = appsStore.store.entries
    if (entries.length === 0) return

    setSelectedIndex((current) => {
      if (direction === "up") {
        return Math.max(0, current - 1)
      } else {
        return Math.min(entries.length - 1, current + 1)
      }
    })

    // Update scroll offset if needed
    const tabListHeight = terminalDims().height - 1
    const visibleHeight = Math.max(1, tabListHeight - 2)
    const currentOffset = tabsStore.store.scrollOffset
    const newIndex = selectedIndex()

    if (newIndex < currentOffset) {
      tabsStore.setScrollOffset(newIndex)
    } else if (newIndex >= currentOffset + visibleHeight) {
      tabsStore.setScrollOffset(newIndex - visibleHeight + 1)
    }
  }

  // Handle app selection
  const handleSelectApp = (id: string) => {
    const entry = appsStore.getEntry(id)
    if (!entry) return

    if (isZellijLayout()) {
      props.sessionClient.createWindow(entry)
      return
    }

    // If not running, start it
    if (!tabsStore.store.runningApps.has(id)) {
      startApp(entry)
    } else {
      setActiveTab(id, { broadcast: true })
    }
  }

  const persistAppsConfig = async (): Promise<boolean> => {
    const nextApps: AppEntryConfig[] = appsStore.store.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      command: entry.command,
      args: entry.args?.trim() || undefined,
      cwd: entry.cwd,
      autostart: entry.autostart,
      restart_on_exit: entry.restartOnExit,
      env: entry.env,
    }))

    const nextConfig: Config = {
      ...props.config,
      apps: nextApps,
    }
    props.config.apps = nextApps

    try {
      await saveConfig(nextConfig)
      return true
    } catch (error) {
      console.error("Failed to save config:", error)
      return false
    }
  }

  // Theme change handler
  const handleThemeChange = async (themeId: string) => {
    const theme = getThemeById(themeId)
    if (!theme) {
      uiStore.showTemporaryMessage(`Unknown theme: ${themeId}`)
      return
    }
    
    // Update reactive state (immediate UI update)
    const newTheme: ThemeConfig = {
      primary: theme.primary,
      background: theme.background,
      foreground: theme.foreground,
      accent: theme.accent,
      muted: theme.muted,
    }
    setCurrentTheme(newTheme)
    
    // Persist to config (mutate props.config to match existing pattern)
    props.config.theme = newTheme
    try {
      await saveConfig(props.config)
      uiStore.showTemporaryMessage(`Theme: ${theme.name}`)
    } catch (error) {
      uiStore.showTemporaryMessage(`Failed to save theme`)
    }
  }

  // Add a new app
  const openEditModal = (id: string) => {
    setEditingEntryId(id)
    uiStore.openModal("edit-app")
  }

  const handleAddApp = (config: AppEntryConfig) => {
    const entry = appsStore.addEntry(config)
    uiStore.closeModal()
    uiStore.showTemporaryMessage(`Added: ${entry.name}`)
    void persistAppsConfig()
  }

  const handleEditApp = (id: string, updates: Pick<AppEntryConfig, "name" | "command" | "args" | "cwd">) => {
    appsStore.updateEntry(id, updates)
    tabsStore.updateRunningEntry(id, updates)
    props.sessionClient.updateEntry(id, updates)
    uiStore.closeModal()
    setEditingEntryId(null)

    const updatedName = appsStore.getEntry(id)?.name ?? updates.name
    if (tabsStore.store.runningApps.has(id)) {
      uiStore.showTemporaryMessage(`Updated: ${updatedName} (restart to apply)`)
    } else {
      uiStore.showTemporaryMessage(`Updated: ${updatedName}`)
    }

    void persistAppsConfig()
  }

  const handleDisconnect = () => {
    if (isDisconnecting()) {
      return
    }
    setIsDisconnecting(true)
    props.sessionClient.disconnect()
    renderer.destroy()
    setTimeout(() => process.exit(0), 50)
  }

  const handleShutdown = () => {
    if (isDisconnecting()) {
      return
    }
    setIsDisconnecting(true)
    void (async () => {
      await props.sessionClient.shutdownAndWait(1500, { clearSession: true })
      renderer.destroy()
      process.exit(0)
    })()
  }

  const getActivePaneEntry = () => {
    const paneId = windowsStore.store.activePaneId
    const pane = paneId ? windowsStore.getRunningPane(paneId) : undefined
    return pane?.entry
  }

  const activateWindow = (windowId: string) => {
    const window = windowsStore.store.windows.find((item) => item.id === windowId)
    props.sessionClient.setActiveWindow(windowId)
    if (window) {
      props.sessionClient.setActivePane(window.activePaneId)
    }
  }

  const activatePane = (paneId: string) => {
    props.sessionClient.setActivePane(paneId)
  }

  const splitActivePane = (direction: "horizontal" | "vertical") => {
    const paneId = windowsStore.store.activePaneId
    const entry = getActivePaneEntry()
    if (!paneId || !entry) {
      uiStore.showTemporaryMessage("No active pane to split")
      return
    }
    props.sessionClient.splitPane(paneId, direction, entry)
  }

  const createWindowFromActive = () => {
    const entry = getActivePaneEntry()
    if (!entry) {
      uiStore.showTemporaryMessage("No active pane to clone")
      return
    }
    props.sessionClient.createWindow(entry)
  }

  const closeActivePane = () => {
    const paneId = windowsStore.store.activePaneId
    if (!paneId) {
      uiStore.showTemporaryMessage("No active pane")
      return
    }
    props.sessionClient.closePane(paneId)
  }

  const closeActiveWindow = () => {
    const windowId = windowsStore.store.activeWindowId
    if (!windowId) {
      uiStore.showTemporaryMessage("No active window")
      return
    }
    props.sessionClient.closeWindow(windowId)
  }

  const cycleWindow = (direction: "next" | "prev") => {
    const windows = windowsStore.store.windows
    if (!windows.length) {
      return
    }
    const currentIndex = windows.findIndex((window) => window.id === windowsStore.store.activeWindowId)
    const nextIndex =
      direction === "next"
        ? (currentIndex + 1 + windows.length) % windows.length
        : (currentIndex - 1 + windows.length) % windows.length
    const nextWindow = windows[nextIndex]
    if (nextWindow) {
      activateWindow(nextWindow.id)
    }
  }

  const cyclePane = () => {
    const paneIds = activeWindowPaneIds()
    if (!paneIds.length) {
      return
    }
    const currentIndex = paneIds.findIndex((paneId) => paneId === windowsStore.store.activePaneId)
    const nextIndex = (currentIndex + 1 + paneIds.length) % paneIds.length
    activatePane(paneIds[nextIndex])
  }

  // Hook up keyboard events from opentui
  useKeyboard((event) => {
    debugLog(`[App] key: ${event.name} modal: ${uiStore.store.activeModal} prevented: ${event.defaultPrevented}`)

    // If a modal is open, let modal handle keys (except Escape)
    if (uiStore.store.activeModal) {
      if (event.name === "escape") {
        if (uiStore.store.activeModal === "edit-app") {
          setEditingEntryId(null)
        }
        uiStore.closeModal()
        event.preventDefault()
      }
      // Don't preventDefault for other events - let the modal handle them
      return
    }

    const isZellij = isZellijLayout()

    // Get active app/pane for PTY operations
    const activeApp = tabsStore.store.activeTabId
      ? tabsStore.getRunningApp(tabsStore.store.activeTabId)
      : undefined
    const activePaneId = windowsStore.store.activePaneId
    const activePane = activePaneId ? windowsStore.getRunningPane(activePaneId) : undefined

    // === CTRL+A TOGGLE (works in both modes) ===
    if (matchesKeybind(event, "ctrl+a")) {
      const now = Date.now()
      const isTerminalFocus = isZellij
        ? windowsStore.store.focusMode === "terminal"
        : tabsStore.store.focusMode === "terminal"
      // Double-tap detection: if in terminal mode and within 500ms, send \x01 to PTY
      if (isTerminalFocus && now - lastCtrlATime < 500) {
        if (isZellij && activePane) {
          props.sessionClient.sendInput(activePane.paneId, "\x01")
        }
        if (!isZellij && activeApp) {
          props.sessionClient.sendInput(activeApp.entry.id, "\x01")
        }
        lastCtrlATime = 0
        event.preventDefault()
        return
      }
      // Otherwise toggle focus mode
      lastCtrlATime = now
      if (isZellij) {
        windowsStore.toggleFocus()
      } else {
        tabsStore.toggleFocus()
      }
      event.preventDefault()
      return
    }

    if (isZellij) {
      if (windowsStore.store.focusMode === "terminal") {
        if (activePane && event.sequence) {
          props.sessionClient.sendInput(activePane.paneId, event.sequence)
          event.preventDefault()
        }
        return
      }

      // Manager focus mode
      if (event.sequence === "\x03" || (event.ctrl && event.name === "c")) {
        event.preventDefault()
        return
      }

      if (event.name === "Q" || (event.shift && event.name === "q")) {
        handleShutdown()
        event.preventDefault()
        return
      }

      switch (event.name) {
        case "v":
          splitActivePane("vertical")
          event.preventDefault()
          return
        case "s":
          splitActivePane("horizontal")
          event.preventDefault()
          return
        case "n":
          createWindowFromActive()
          event.preventDefault()
          return
        case "x":
          closeActivePane()
          event.preventDefault()
          return
        case "w":
          closeActiveWindow()
          event.preventDefault()
          return
        case "[":
          cycleWindow("prev")
          event.preventDefault()
          return
        case "]":
          cycleWindow("next")
          event.preventDefault()
          return
        case "p":
          cyclePane()
          event.preventDefault()
          return
        case " ":
        case "space":
          uiStore.openModal("command-palette")
          event.preventDefault()
          return
        case "t":
          uiStore.openModal("add-tab")
          event.preventDefault()
          return
        case "q":
          if (!event.shift) {
            handleDisconnect()
            event.preventDefault()
            return
          }
          break
      }

      return
    }

    // === TERMINAL FOCUS MODE ===
    if (tabsStore.store.focusMode === "terminal") {
      // Pass raw input to terminal
      if (activeApp && event.sequence) {
        props.sessionClient.sendInput(activeApp.entry.id, event.sequence)
        event.preventDefault()
      }
      return
    }

    // === TABS FOCUS MODE ===
    // Ctrl+C in tabs mode - just ignore silently
    if (event.sequence === "\x03" || (event.ctrl && event.name === "c")) {
      event.preventDefault()
      return
    }

    // Direct navigation keys (vim-style)
    // gg: go to top
    if (event.name === "g" && !event.ctrl && !event.option && !event.shift) {
      const now = Date.now()
      if (now - lastGTime() < 500) {
        setSelectedIndex(0)
        setLastGTime(0)
      } else {
        setLastGTime(now)
      }
      event.preventDefault()
      return
    }

    // G: go to bottom
    if (event.name === "G" || (event.shift && event.name === "g")) {
      const entries = appsStore.store.entries
      if (entries.length > 0) {
        setSelectedIndex(entries.length - 1)
      }
      setLastGTime(0)
      event.preventDefault()
      return
    }

    // Reset gg timer on other keys
    setLastGTime(0)

    // Q (shift+q): shutdown session
    if (event.name === "Q" || (event.shift && event.name === "q")) {
      handleShutdown()
      event.preventDefault()
      return
    }

    // Single-key commands in tabs mode
    switch (event.name) {
      case "j":
      case "down":
        handleTabNavigation("down")
        event.preventDefault()
        return

      case "k":
      case "up":
        handleTabNavigation("up")
        event.preventDefault()
        return

      case "return":
      case "enter": {
        const entries = appsStore.store.entries
        if (entries.length > 0 && selectedIndex() < entries.length) {
          handleSelectApp(entries[selectedIndex()].id)
        }
        event.preventDefault()
        return
      }

      case "space":
      case " ":
        uiStore.openModal("command-palette")
        event.preventDefault()
        return

      case "t":
        uiStore.openModal("add-tab")
        event.preventDefault()
        return

      case "e": {
        const entry = appsStore.store.entries[selectedIndex()]
        if (entry) {
          openEditModal(entry.id)
        } else {
          uiStore.showTemporaryMessage("No app selected")
        }
        event.preventDefault()
        return
      }

      case "x": {
        const entry = appsStore.store.entries[selectedIndex()]
        if (!entry) {
          uiStore.showTemporaryMessage("No app selected")
        } else if (tabsStore.store.runningApps.has(entry.id)) {
          stopApp(entry.id)
        } else {
          uiStore.showTemporaryMessage(`Not running: ${entry.name}`)
        }
        event.preventDefault()
        return
      }

      case "r": {
        const entry = appsStore.store.entries[selectedIndex()]
        if (!entry) {
          uiStore.showTemporaryMessage("No app selected")
        } else if (tabsStore.store.runningApps.has(entry.id)) {
          restartApp(entry.id)
        } else {
          uiStore.showTemporaryMessage(`Not running: ${entry.name}`)
        }
        event.preventDefault()
        return
      }

      case "q":
        if (event.shift) {
          break
        }
        handleDisconnect()
        event.preventDefault()
        return
    }

    // K (shift+k): kill all apps
    if (event.name === "K" || (event.shift && event.name === "k")) {
      stopAllApps({ showMessage: true })
      event.preventDefault()
      return
    }
  })

  // Handle --add flag: open add modal on startup
  onMount(() => {
    if (props.startWithAddModal) {
      uiStore.openModal("add-tab")
    }
  })

  onMount(() => {
    const handleSnapshot = (message: ServerMessage) => {
      if (message.type !== "snapshot") {
        return
      }

    if (message.layout === "zellij") {
      setLayoutMode("zellij")
      if (!warnedLayoutMismatch && props.config.layout !== "zellij") {
        warnedLayoutMismatch = true
        uiStore.showTemporaryMessage("Server is in zellij layout (restart to switch)")
      }
      const panes = (message.panes ?? []).map((pane) => ({
        paneId: pane.paneId,
        entry: pane.entry,
        status: pane.status,
        buffer: pane.buffer,
        runId: pane.runId,
      }))
        const windows = (message.windows ?? []).map((window) => ({
          id: window.id,
          title: window.title,
          layout: window.layout,
          activePaneId: window.activePaneId,
        }))
        windowsStore.setSnapshot(
          windows,
          panes,
          message.activeWindowId ?? null,
          message.activePaneId ?? null
        )
        if (pendingPaneBuffers.size > 0) {
          for (const [paneId, data] of pendingPaneBuffers.entries()) {
            if (windowsStore.getRunningPane(paneId)) {
              windowsStore.appendPaneBuffer(paneId, data)
              pendingPaneBuffers.delete(paneId)
            }
          }
        }
        return
      }

      setLayoutMode("classic")
      if (!warnedLayoutMismatch && props.config.layout !== "classic") {
        warnedLayoutMismatch = true
        uiStore.showTemporaryMessage("Server is in classic layout (restart to switch)")
      }
      const apps = (message.runningApps ?? []).map((app) => ({
        entry: app.entry,
        status: app.status,
        buffer: app.buffer,
        runId: app.runId,
      }))
      tabsStore.setRunningApps(apps)
      setActiveTab(message.activeTabId ?? null)
    }

    const handleStarted = (message: { app: RunningAppSnapshot }) => {
      tabsStore.addRunningApp({
        entry: message.app.entry,
        status: message.app.status,
        buffer: message.app.buffer,
        runId: message.app.runId,
      })
    }

    const handleStopped = (message: { id: string }) => {
      tabsStore.removeRunningApp(message.id)
    }

    const handleStatus = (message: { id: string; status: AppStatus }) => {
      tabsStore.updateAppStatus(message.id, message.status)
    }

    const handleOutput = (message: { id: string; data: string }) => {
      tabsStore.appendToBuffer(message.id, message.data)
    }

    const handleActive = (message: { id: string | null }) => {
      setActiveTab(message.id)
    }

    const handlePaneStarted = (message: { pane: RunningPaneSnapshot }) => {
      windowsStore.addRunningPane({
        paneId: message.pane.paneId,
        entry: message.pane.entry,
        status: message.pane.status,
        buffer: message.pane.buffer,
        runId: message.pane.runId,
      })
      const pending = pendingPaneBuffers.get(message.pane.paneId)
      if (pending) {
        windowsStore.appendPaneBuffer(message.pane.paneId, pending)
        pendingPaneBuffers.delete(message.pane.paneId)
      }
    }

    const handlePaneStopped = (message: { paneId: string }) => {
      windowsStore.removeRunningPane(message.paneId)
    }

    const handlePaneStatus = (message: { paneId: string; status: AppStatus }) => {
      windowsStore.updatePaneStatus(message.paneId, message.status)
    }

    const handlePaneOutput = (message: { paneId: string; data: string }) => {
      if (windowsStore.getRunningPane(message.paneId)) {
        windowsStore.appendPaneBuffer(message.paneId, message.data)
        return
      }
      const existing = pendingPaneBuffers.get(message.paneId) ?? ""
      pendingPaneBuffers.set(message.paneId, existing + message.data)
    }

    const handleWindowChanged = (message: { window: WindowSnapshot }) => {
      windowsStore.upsertWindow({
        id: message.window.id,
        title: message.window.title,
        layout: message.window.layout,
        activePaneId: message.window.activePaneId,
      })
    }

    const handleWindowClosed = (message: { windowId: string }) => {
      windowsStore.removeWindow(message.windowId)
    }

    const handleActiveWindow = (message: { id: string | null }) => {
      windowsStore.setActiveWindow(message.id)
    }

    const handleActivePane = (message: { id: string | null }) => {
      windowsStore.setActivePane(message.id)
    }

    const handleDisconnectEvent = () => {
      if (isDisconnecting()) {
        return
      }
      setIsDisconnecting(true)
      renderer.destroy()
      setTimeout(() => process.exit(0), 50)
    }

    props.sessionClient.on("snapshot", handleSnapshot)
    props.sessionClient.on("started", handleStarted)
    props.sessionClient.on("stopped", handleStopped)
    props.sessionClient.on("status", handleStatus)
    props.sessionClient.on("output", handleOutput)
    props.sessionClient.on("active", handleActive)
    props.sessionClient.on("pane_started", handlePaneStarted)
    props.sessionClient.on("pane_stopped", handlePaneStopped)
    props.sessionClient.on("pane_status", handlePaneStatus)
    props.sessionClient.on("pane_output", handlePaneOutput)
    props.sessionClient.on("window_changed", handleWindowChanged)
    props.sessionClient.on("window_closed", handleWindowClosed)
    props.sessionClient.on("active_window", handleActiveWindow)
    props.sessionClient.on("active_pane", handleActivePane)
    props.sessionClient.on("disconnect", handleDisconnectEvent)

    onCleanup(() => {
      props.sessionClient.off("snapshot", handleSnapshot)
      props.sessionClient.off("started", handleStarted)
      props.sessionClient.off("stopped", handleStopped)
      props.sessionClient.off("status", handleStatus)
      props.sessionClient.off("output", handleOutput)
      props.sessionClient.off("active", handleActive)
      props.sessionClient.off("pane_started", handlePaneStarted)
      props.sessionClient.off("pane_stopped", handlePaneStopped)
      props.sessionClient.off("pane_status", handlePaneStatus)
      props.sessionClient.off("pane_output", handlePaneOutput)
      props.sessionClient.off("window_changed", handleWindowChanged)
      props.sessionClient.off("window_closed", handleWindowClosed)
      props.sessionClient.off("active_window", handleActiveWindow)
      props.sessionClient.off("active_pane", handleActivePane)
      props.sessionClient.off("disconnect", handleDisconnectEvent)
    })
  })

  // Get the currently active running app/pane
  const activeRunningApp = createMemo(() => {
    const activeId = tabsStore.store.activeTabId
    return activeId ? tabsStore.getRunningApp(activeId) : undefined
  })

  const activeWindow = createMemo(() => {
    const activeId = windowsStore.store.activeWindowId
    return windowsStore.store.windows.find((window) => window.id === activeId) ?? null
  })

  const activeRunningPane = createMemo(() => {
    const paneId = windowsStore.store.activePaneId
    return paneId ? windowsStore.getRunningPane(paneId) : undefined
  })

  const activeWindowPaneIds = createMemo(() => {
    const window = activeWindow()
    return window ? collectPaneIds(window.layout) : []
  })

  // Handle terminal resize based on terminal dimensions
  createEffect(() => {
    if (isZellijLayout()) {
      const window = activeWindow()
      if (!window) {
        return
      }

      const dims = terminalDims()
      const contentWidth = dims.width
      const contentHeight = dims.height - 2
      if (contentWidth < 10 || contentHeight < 3) {
        return
      }

      const rects = computePaneRects(window.layout, contentWidth, contentHeight)
      for (const [paneId, rect] of rects.entries()) {
        const cols = Math.max(1, rect.width - 2)
        const rows = Math.max(1, rect.height - 3)
        if (cols < 10 || rows < 3) {
          continue
        }
        props.sessionClient.resizePane(paneId, cols, rows)
      }
      return
    }

    const { cols: termWidth, rows: termHeight } = getClassicPtyDimensions()

    // Only resize with valid dimensions
    if (termWidth < 10 || termHeight < 3) {
      return
    }

    props.sessionClient.resize(termWidth, termHeight)
  })

  // Handle input to terminal
  const handleTerminalInput = (data: string) => {
    if (isZellijLayout()) {
      const paneId = windowsStore.store.activePaneId
      if (paneId) {
        props.sessionClient.sendInput(paneId, data)
      }
      return
    }

    const activeApp = tabsStore.store.activeTabId
      ? tabsStore.getRunningApp(tabsStore.store.activeTabId)
      : undefined

    if (activeApp) {
      props.sessionClient.sendInput(activeApp.entry.id, data)
    }
  }

  // Cleanup on unmount
  onCleanup(() => {
    props.sessionClient.disconnect()
  })

  const editingEntry = createMemo(() => {
    const id = editingEntryId()
    const entry = id ? appsStore.getEntry(id) : undefined
    return entry
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Show
        when={isZellijLayout()}
        fallback={
          <box flexDirection="row" flexGrow={1}>
            <TabList
              entries={appsStore.store.entries}
              activeTabId={tabsStore.store.activeTabId}
              selectedIndex={selectedIndex()}
              getStatus={getAppStatus}
              isFocused={tabsStore.store.focusMode === "tabs"}
              width={props.config.tab_width}
              height={terminalDims().height - 1}
              scrollOffset={tabsStore.store.scrollOffset}
              theme={currentTheme()}
              onSelect={handleSelectApp}
              onAddClick={() => uiStore.openModal("add-tab")}
            />

            <TerminalPane
              runningApp={activeRunningApp()}
              isFocused={tabsStore.store.focusMode === "terminal"}
              width={terminalDims().width - props.config.tab_width}
              height={terminalDims().height - 1}
              theme={currentTheme()}
              onInput={handleTerminalInput}
            />
          </box>
        }
      >
        <box flexDirection="column" flexGrow={1}>
          <PaneLayout
            layout={activeWindow()?.layout ?? null}
            panes={windowsStore.store.runningPanes}
            activePaneId={windowsStore.store.activePaneId}
            width={terminalDims().width}
            height={terminalDims().height - 2}
            theme={currentTheme()}
          />
          <WindowBar
            windows={windowsStore.store.windows}
            activeWindowId={windowsStore.store.activeWindowId}
            theme={currentTheme()}
            onSelect={activateWindow}
          />
        </box>
      </Show>

      {/* Status bar */}
      <StatusBar
        appName={
          isZellijLayout()
            ? activeRunningPane()?.entry.name ?? null
            : activeRunningApp()?.entry.name ?? null
        }
        appStatus={isZellijLayout() ? activeRunningPane()?.status ?? null : activeRunningApp()?.status ?? null}
        focusMode={isZellijLayout() ? windowsStore.store.focusMode : tabsStore.store.focusMode}
        message={uiStore.store.statusMessage}
        theme={currentTheme()}
        layoutMode={layoutMode()}
      />

      {/* Modals */}
      <Show when={uiStore.store.activeModal === "command-palette"}>
        <CommandPalette
          entries={appsStore.store.entries}
          theme={currentTheme()}
          onSelect={(entry, action) => {
            if (action === "edit") {
              openEditModal(entry.id)
              return
            }

            uiStore.closeModal()
            if (isZellijLayout()) {
              if (action === "switch") {
                props.sessionClient.createWindow(entry)
                return
              }
              if (action === "stop") {
                const activePane = activeRunningPane()
                if (activePane && activePane.entry.id === entry.id) {
                  props.sessionClient.closePane(activePane.paneId)
                  return
                }
                uiStore.showTemporaryMessage("Stop applies to active pane only")
                return
              }
              return
            }

            if (action === "switch") {
              handleSelectApp(entry.id)
            } else if (action === "stop") {
              if (tabsStore.store.runningApps.has(entry.id)) {
                stopApp(entry.id)
              } else {
                uiStore.showTemporaryMessage(`Not running: ${entry.name}`)
              }
            }
          }}
          onGlobalAction={(action: GlobalAction) => {
            if (action.type === "open_theme_picker") {
              uiStore.openModal("theme-picker")
            }
          }}
          onClose={() => uiStore.closeModal()}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "add-tab"}>
        <AddTabModal
          theme={currentTheme()}
          onAdd={handleAddApp}
          onClose={() => uiStore.closeModal()}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "edit-app" && editingEntry()}>
        <EditAppModal
          theme={currentTheme()}
          entry={editingEntry()!}
          onSave={(updates) => handleEditApp(editingEntry()!.id, updates)}
          onClose={() => {
            uiStore.closeModal()
            setEditingEntryId(null)
          }}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "theme-picker"}>
        <ThemePicker
          theme={currentTheme()}
          onSelect={(themeId) => {
            void handleThemeChange(themeId)
          }}
          onClose={() => uiStore.closeModal()}
        />
      </Show>
    </box>
  )
}
