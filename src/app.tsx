import { Component, Show, createSignal, createEffect, onCleanup, createMemo, onMount } from "solid-js"
import { useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/solid"
import { TabList } from "./components/TabList"
import { TerminalPane } from "./components/TerminalPane"
import { PaneLayout } from "./components/PaneLayout"
import { WindowList } from "./components/WindowList"
import { StatusBar } from "./components/StatusBar"
import { CommandPalette, type GlobalAction } from "./components/CommandPalette"
import { AddTabModal } from "./components/AddTabModal"
import { EditAppModal } from "./components/EditAppModal"
import { ThemePicker } from "./components/ThemePicker"
import { ConfirmDialog } from "./components/ConfirmDialog"
import { HelpModal } from "./components/HelpModal"

import { createAppsStore } from "./stores/apps"
import { createTabsStore } from "./stores/tabs"
import { createWindowsStore } from "./stores/windows"
import { createUIStore } from "./stores/ui"
import { saveConfig } from "./lib/config"
import { matchesKeybind } from "./lib/keybinds"
import { debugLog } from "./lib/debug"
import { getThemeById } from "./lib/themes"
import { resolveTheme } from "./lib/palette"
import { widthMode } from "./lib/width-layout"
import { computePaneRects, collectPaneIds } from "./lib/layout"
import { type SessionClient, reconnectSessionClient } from "./lib/session-client"
import type { RunningAppSnapshot, RunningPaneSnapshot, ServerMessage, WindowSnapshot } from "./lib/ipc"
import type { AppStatus, AppEntry, AppEntryConfig, Config, LayoutMode, ThemeConfig } from "./types"

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

  const [client, setClient] = createSignal(props.sessionClient)
  const [isSwitching, setIsSwitching] = createSignal(false)

  const [isDisconnecting, setIsDisconnecting] = createSignal(false)
  const [editingEntryId, setEditingEntryId] = createSignal<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = createSignal<string | null>(null)
  const [lastGTime, setLastGTime] = createSignal(0)
  const [currentTheme, setCurrentTheme] = createSignal<ThemeConfig>(props.config.theme)

  // Derive the rich graphite-style palette from the 5-token theme (memoized).
  const palette = createMemo(() => resolveTheme(currentTheme()))

  // Responsive width mode (full / compact / minimum) drives chrome + sidebar collapse.
  const layoutWidthMode = createMemo(() => widthMode(terminalDims().width))

  // Double-tap Ctrl+A detection for passthrough
  let lastCtrlATime = 0

  const [layoutMode, setLayoutMode] = createSignal(props.config.layout)
  let warnedLayoutMismatch = false

  const isPanesLayout = () => layoutMode() === "panes"

  const tabsSidebarWidth = () =>
    layoutWidthMode() === "minimum" ? 0 : props.config.tab_width

  const getTabsPtyDimensions = () => {
    const dims = terminalDims()
    const cols = dims.width - tabsSidebarWidth() - 2
    const rows = dims.height - 4
    return { cols, rows }
  }

  const setActiveTab = (id: string | null, options: { broadcast?: boolean } = {}) => {
    tabsStore.setActiveTab(id)
    if (options.broadcast) {
      client().setActiveTab(id)
    }
  }

  // When an app launches, optionally jump focus straight into its pane so the
  // user can start typing immediately (configurable via focus_on_launch).
  const focusPaneOnLaunch = () => {
    if (!props.config.focus_on_launch) return
    if (isPanesLayout()) {
      windowsStore.setFocusMode("terminal")
    } else {
      tabsStore.setFocusMode("terminal")
    }
  }

  // Start an app
  const startApp = (entry: AppEntry) => {
    // Don't start if already running
    if (tabsStore.store.runningApps.has(entry.id)) {
      return
    }

    const { cols, rows } = getTabsPtyDimensions()

    // Don't start with invalid dimensions
    if (cols < 10 || rows < 3) {
      console.warn(`Skipping start for ${entry.name}: invalid dimensions ${cols}x${rows}`)
      return
    }

    client().start(entry)
    setActiveTab(entry.id, { broadcast: true })
    focusPaneOnLaunch()
    uiStore.showTemporaryMessage(`Started: ${entry.name}`)
  }

  // Stop an app
  const stopApp = (id: string, options: { silent?: boolean } = {}) => {
    const app = tabsStore.getRunningApp(id)
    if (app) {
      client().stop(id)
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

    client().stopAll()
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
      client().restart(entry)
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

    if (isPanesLayout()) {
      client().createWindow(entry)
      focusPaneOnLaunch()
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
    client().updateEntry(id, updates)
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

  const handleRemoveApp = async (entry: AppEntry) => {
    if (tabsStore.store.activeTabId === entry.id) {
      setActiveTab(null, { broadcast: true })
    }
    client().stopEntry(entry.id)
    appsStore.removeEntry(entry.id)
    tabsStore.removeRunningApp(entry.id)
    uiStore.closeModal()

    const didPersist = await persistAppsConfig()
    uiStore.showTemporaryMessage(
      didPersist ? `Removed: ${entry.name}` : `Failed to remove: ${entry.name}`
    )
  }

  // Ask before deleting: open the confirmation dialog for the given app.
  const requestDelete = (id: string) => {
    setPendingDeleteId(id)
    uiStore.openModal("confirm-delete")
  }

  const cancelDelete = () => {
    setPendingDeleteId(null)
    uiStore.closeModal()
  }

  const confirmDelete = () => {
    const id = pendingDeleteId()
    const entry = id ? appsStore.getEntry(id) : undefined
    setPendingDeleteId(null)
    if (entry) {
      void handleRemoveApp(entry)
    } else {
      uiStore.closeModal()
    }
  }

  const deletingEntry = createMemo(() => {
    const id = pendingDeleteId()
    return id ? appsStore.getEntry(id) : undefined
  })

  const handleDisconnect = () => {
    if (isDisconnecting()) {
      return
    }
    setIsDisconnecting(true)
    client().disconnect()
    renderer.destroy()
    setTimeout(() => process.exit(0), 50)
  }

  const handleShutdown = () => {
    if (isDisconnecting()) {
      return
    }
    setIsDisconnecting(true)
    void (async () => {
      await client().shutdownAndWait(1500, { clearSession: true })
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
    client().setActiveWindow(windowId)
    if (window) {
      client().setActivePane(window.activePaneId)
    }
  }

  const activatePane = (paneId: string) => {
    client().setActivePane(paneId)
  }

  const splitActivePane = (direction: "horizontal" | "vertical") => {
    const paneId = windowsStore.store.activePaneId
    const entry = getActivePaneEntry()
    if (!paneId || !entry) {
      uiStore.showTemporaryMessage("No active pane to split")
      return
    }
    client().splitPane(paneId, direction, entry)
  }

  const createWindowFromActive = () => {
    const entry = getActivePaneEntry()
    if (!entry) {
      uiStore.showTemporaryMessage("No active pane to clone")
      return
    }
    client().createWindow(entry)
  }

  const closeActivePane = () => {
    const paneId = windowsStore.store.activePaneId
    if (!paneId) {
      uiStore.showTemporaryMessage("No active pane")
      return
    }
    client().closePane(paneId)
  }

  const closeActiveWindow = () => {
    const windowId = windowsStore.store.activeWindowId
    if (!windowId) {
      uiStore.showTemporaryMessage("No active window")
      return
    }
    client().closeWindow(windowId)
  }

  const cycleWindow = (direction: "next" | "prev") => {
    const windows = windowsStore.store.windows
    if (windows.length === 0) {
      return
    }
    const foundIndex = windows.findIndex((window) => window.id === windowsStore.store.activeWindowId)
    const currentIndex = foundIndex === -1 ? 0 : foundIndex
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
    if (paneIds.length === 0) {
      return
    }
    const foundIndex = paneIds.findIndex((paneId) => paneId === windowsStore.store.activePaneId)
    const currentIndex = foundIndex === -1 ? 0 : foundIndex
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
        if (uiStore.store.activeModal === "confirm-delete") {
          setPendingDeleteId(null)
        }
        uiStore.closeModal()
        event.preventDefault()
      }
      // Don't preventDefault for other events - let the modal handle them
      return
    }

    const isPanes = isPanesLayout()

    // Get active app/pane for PTY operations
    const activeApp = tabsStore.store.activeTabId
      ? tabsStore.getRunningApp(tabsStore.store.activeTabId)
      : undefined
    const activePaneId = windowsStore.store.activePaneId
    const activePane = activePaneId ? windowsStore.getRunningPane(activePaneId) : undefined

    // === CTRL+A TOGGLE (works in both modes) ===
    if (matchesKeybind(event, "ctrl+a")) {
      const now = Date.now()
      const isTerminalFocus = isPanes
        ? windowsStore.store.focusMode === "terminal"
        : tabsStore.store.focusMode === "terminal"
      // Double-tap detection: if in terminal mode and within 500ms, send \x01 to PTY
      if (isTerminalFocus && now - lastCtrlATime < 500) {
        if (isPanes && activePane) {
          client().sendInput(activePane.paneId, "\x01")
        }
        if (!isPanes && activeApp) {
          client().sendInput(activeApp.entry.id, "\x01")
        }
        lastCtrlATime = 0
        event.preventDefault()
        return
      }
      // Otherwise toggle focus mode
      lastCtrlATime = now
      if (isPanes) {
        windowsStore.toggleFocus()
      } else {
        tabsStore.toggleFocus()
      }
      event.preventDefault()
      return
    }

    // === HELP CHEATSHEET (?) ===
    // Available from tabs/panes focus, but not while typing into a terminal.
    const inTerminalFocus = isPanes
      ? windowsStore.store.focusMode === "terminal"
      : tabsStore.store.focusMode === "terminal"
    if (!inTerminalFocus && (event.name === "?" || event.sequence === "?")) {
      uiStore.openModal("help")
      event.preventDefault()
      return
    }

    if (isPanes) {
      if (windowsStore.store.focusMode === "terminal") {
        if (activePane && event.sequence) {
          client().sendInput(activePane.paneId, event.sequence)
          event.preventDefault()
        }
        return
      }

      // Panes control focus mode
      if (event.sequence === "\x03" || (event.ctrl && event.name === "c")) {
        event.preventDefault()
        return
      }

      if (event.name === "Q" || (event.shift && event.name === "q")) {
        handleShutdown()
        event.preventDefault()
        return
      }

      // Shift+L: toggle layout (tabs <-> panes)
      if (matchesKeybind(event, "shift+l") || (event.shift && event.name === "l")) {
        void switchLayout(isPanesLayout() ? "tabs" : "panes")
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
        client().sendInput(activeApp.entry.id, event.sequence)
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

    // Shift+L: toggle layout (tabs <-> panes)
    if (matchesKeybind(event, "shift+l") || (event.shift && event.name === "l")) {
      void switchLayout(isPanesLayout() ? "tabs" : "panes")
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

  const bindClient = (c: SessionClient) => {
    const handleSnapshot = (message: ServerMessage) => {
      if (message.type !== "snapshot") {
        return
      }

      if (message.layout === "panes") {
        setLayoutMode("panes")
        warnedLayoutMismatch = props.config.layout !== "panes"
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

      setLayoutMode("tabs")
      warnedLayoutMismatch = props.config.layout !== "tabs"
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
      if (isDisconnecting() || isSwitching()) {
        return
      }
      setIsDisconnecting(true)
      renderer.destroy()
      setTimeout(() => process.exit(0), 50)
    }

    c.on("snapshot", handleSnapshot)
    c.on("started", handleStarted)
    c.on("stopped", handleStopped)
    c.on("status", handleStatus)
    c.on("output", handleOutput)
    c.on("active", handleActive)
    c.on("pane_started", handlePaneStarted)
    c.on("pane_stopped", handlePaneStopped)
    c.on("pane_status", handlePaneStatus)
    c.on("pane_output", handlePaneOutput)
    c.on("window_changed", handleWindowChanged)
    c.on("window_closed", handleWindowClosed)
    c.on("active_window", handleActiveWindow)
    c.on("active_pane", handleActivePane)
    c.on("disconnect", handleDisconnectEvent)

    return () => {
      c.off("snapshot", handleSnapshot)
      c.off("started", handleStarted)
      c.off("stopped", handleStopped)
      c.off("status", handleStatus)
      c.off("output", handleOutput)
      c.off("active", handleActive)
      c.off("pane_started", handlePaneStarted)
      c.off("pane_stopped", handlePaneStopped)
      c.off("pane_status", handlePaneStatus)
      c.off("pane_output", handlePaneOutput)
      c.off("window_changed", handleWindowChanged)
      c.off("window_closed", handleWindowClosed)
      c.off("active_window", handleActiveWindow)
      c.off("active_pane", handleActivePane)
      c.off("disconnect", handleDisconnectEvent)
    }
  }

  createEffect(() => {
    const c = client()
    onCleanup(bindClient(c))
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
    if (isPanesLayout()) {
      const window = activeWindow()
      if (!window) {
        return
      }

      const dims = terminalDims()
      const sidebarWidth = layoutWidthMode() !== "minimum" ? props.config.tab_width : 0
      const contentWidth = dims.width - sidebarWidth
      const contentHeight = dims.height - 1
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
        client().resizePane(paneId, cols, rows)
      }
      return
    }

    const { cols: termWidth, rows: termHeight } = getTabsPtyDimensions()

    // Only resize with valid dimensions
    if (termWidth < 10 || termHeight < 3) {
      return
    }

    client().resize(termWidth, termHeight)
  })

  // Handle input to terminal
  const handleTerminalInput = (data: string) => {
    if (isPanesLayout()) {
      const paneId = windowsStore.store.activePaneId
      if (paneId) {
        client().sendInput(paneId, data)
      }
      return
    }

    const activeApp = tabsStore.store.activeTabId
      ? tabsStore.getRunningApp(tabsStore.store.activeTabId)
      : undefined

    if (activeApp) {
      client().sendInput(activeApp.entry.id, data)
    }
  }

  // Capture the running app entries (deduped) plus the active one so they can be
  // re-created after the server restarts in the other layout.
  const captureRunningEntries = (): { entries: AppEntry[]; activeEntryId: string | null } => {
    let entries: AppEntry[]
    let activeEntryId: string | null
    if (isPanesLayout()) {
      const seen = new Set<string>()
      entries = []
      for (const pane of windowsStore.store.runningPanes.values()) {
        if (seen.has(pane.entry.id)) continue
        seen.add(pane.entry.id)
        entries.push(pane.entry)
      }
      const activePaneId = windowsStore.store.activePaneId
      const activePane = activePaneId ? windowsStore.getRunningPane(activePaneId) : undefined
      activeEntryId = activePane?.entry.id ?? null
    } else {
      entries = Array.from(tabsStore.store.runningApps.values()).map((app) => app.entry)
      activeEntryId = tabsStore.store.activeTabId
    }
    // Only replay apps that exist in the configured app list. A running pane
    // whose entry isn't configured (e.g. the panes server's default "shell"
    // window) has no home in the tabs sidebar, so replaying it would leave an
    // unreachable running app (#11). Dropping it keeps every replayed app
    // addressable; the orphaned process dies with the old server anyway.
    const configured = entries.filter((entry) => appsStore.getEntry(entry.id) !== undefined)
    const activeConfigured =
      activeEntryId && appsStore.getEntry(activeEntryId) ? activeEntryId : (configured[0]?.id ?? null)
    return { entries: configured, activeEntryId: activeConfigured }
  }

  // Point the app at a freshly-connected client, clearing stale layout state so
  // the incoming snapshot populates the now-relevant store. Shared by a
  // successful switch and the failure-recovery path.
  const adoptFreshClient = (next: SessionClient, layout: LayoutMode) => {
    warnedLayoutMismatch = false
    setLayoutMode(layout)
    pendingPaneBuffers.clear()
    tabsStore.setRunningApps([])
    setActiveTab(null)
    windowsStore.setSnapshot([], [], null, null)
    setClient(next) // triggers bindClient(next) via the client effect
  }

  // Degraded path: a switch failed mid-flight. Reconnect cleanly in `layout` so
  // the UI stays usable (running apps are not replayed here).
  const recoverLayout = async (layout: LayoutMode) => {
    try {
      const back = await reconnectSessionClient(layout)
      props.config.layout = layout
      // Persist the layout we actually recovered into, so a cold start doesn't
      // launch in the target layout we failed to reach.
      await saveConfig(props.config)
      adoptFreshClient(back, layout)
      uiStore.showTemporaryMessage("Switch failed — restored previous layout")
    } catch (error) {
      debugLog(`[switch] recovery failed: ${error}`)
      handleDisconnect()
    } finally {
      setIsSwitching(false)
    }
  }

  // Switch between tabs and panes layout at runtime by restarting the server.
  // The old server is shut down (clearing its session), a fresh server is spawned
  // in the target layout, and the previously running entries are re-created once
  // the new server reports its first snapshot. A timeout / early disconnect on the
  // new connection aborts cleanly into the previous layout, so the UI can never
  // freeze with isSwitching() stuck on (which would also wedge the disconnect
  // guard in handleDisconnectEvent).
  const switchLayout = async (target: LayoutMode) => {
    if (isSwitching() || isDisconnecting()) {
      return
    }
    if (target === layoutMode()) {
      uiStore.showTemporaryMessage(`Already in ${target}`)
      return
    }

    const previousLayout = layoutMode()
    setIsSwitching(true)
    if (uiStore.store.activeModal) {
      uiStore.closeModal()
    }
    uiStore.setStatusMessage(`Switching to ${target}…`)

    const { entries, activeEntryId } = captureRunningEntries()

    try {
      await client().shutdownAndWait(1500, { clearSession: true })
      props.config.layout = target
      await saveConfig(props.config)

      // When there are apps to replay, suppress the panes server's default
      // shell window so the switch doesn't leave an extra unwanted window
      // alongside them (#12). With nothing to replay, let it seed so the
      // workspace isn't empty.
      const next = await reconnectSessionClient(target, {
        seedDefaultWindow: entries.length === 0,
      })
      adoptFreshClient(next, target)

      // Replay the captured entries once the new server is ready. If it never
      // reports a snapshot (crash) or drops first, recover into the previous
      // layout instead of leaving the switch guard stuck on.
      let settled = false
      const finish = (ready: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(readyTimer)
        next.off("snapshot", onReady)
        next.off("disconnect", onLost)
        if (!ready) {
          void recoverLayout(previousLayout)
          return
        }
        for (const entry of entries) {
          if (target === "tabs") {
            next.start(entry)
          } else {
            next.createWindow(entry)
          }
        }
        if (target === "tabs" && activeEntryId) {
          next.setActiveTab(activeEntryId)
        }
        setIsSwitching(false)
        uiStore.showTemporaryMessage(`Switched to ${target}`)
      }
      const onReady = () => finish(true)
      const onLost = () => finish(false)
      const readyTimer = setTimeout(() => finish(false), 4000)
      next.once("snapshot", onReady)
      next.once("disconnect", onLost)
    } catch (error) {
      debugLog(`[switch] ${error}`)
      await recoverLayout(previousLayout)
    }
  }

  // Cleanup on unmount
  onCleanup(() => {
    client().disconnect()
  })

  const editingEntry = createMemo(() => {
    const id = editingEntryId()
    const entry = id ? appsStore.getEntry(id) : undefined
    return entry
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Show
        when={isPanesLayout()}
        fallback={
          <box flexDirection="row" flexGrow={1}>
            <Show when={layoutWidthMode() !== "minimum"}>
              <TabList
                entries={appsStore.store.entries}
                activeTabId={tabsStore.store.activeTabId}
                selectedIndex={selectedIndex()}
                getStatus={getAppStatus}
                isFocused={tabsStore.store.focusMode === "tabs"}
                width={props.config.tab_width}
                height={terminalDims().height - 1}
                scrollOffset={tabsStore.store.scrollOffset}
                theme={palette()}
                onSelect={handleSelectApp}
                onAddClick={() => uiStore.openModal("add-tab")}
              />
            </Show>

            <TerminalPane
              runningApp={activeRunningApp()}
              isFocused={tabsStore.store.focusMode === "terminal"}
              width={terminalDims().width - tabsSidebarWidth()}
              height={terminalDims().height - 1}
              theme={palette()}
              onInput={handleTerminalInput}
            />
          </box>
        }
      >
        <box flexDirection="row" flexGrow={1}>
          <Show when={layoutWidthMode() !== "minimum"}>
            <WindowList
              windows={windowsStore.store.windows}
              activeWindowId={windowsStore.store.activeWindowId}
              isFocused={windowsStore.store.focusMode === "tabs"}
              width={props.config.tab_width}
              height={terminalDims().height - 1}
              theme={palette()}
              onSelect={activateWindow}
              onAddClick={createWindowFromActive}
            />
          </Show>
          <PaneLayout
            layout={activeWindow()?.layout ?? null}
            panes={windowsStore.store.runningPanes}
            activePaneId={windowsStore.store.activePaneId}
            width={terminalDims().width - (layoutWidthMode() !== "minimum" ? props.config.tab_width : 0)}
            height={terminalDims().height - 1}
            theme={palette()}
          />
        </box>
      </Show>

      {/* Status bar */}
      <StatusBar
        appName={
          isPanesLayout()
            ? activeRunningPane()?.entry.name ?? null
            : activeRunningApp()?.entry.name ?? null
        }
        appStatus={isPanesLayout() ? activeRunningPane()?.status ?? null : activeRunningApp()?.status ?? null}
        focusMode={isPanesLayout() ? windowsStore.store.focusMode : tabsStore.store.focusMode}
        message={uiStore.store.statusMessage}
        theme={palette()}
        layoutMode={layoutMode()}
        widthMode={layoutWidthMode()}
        termWidth={terminalDims().width}
      />

      {/* Modals */}
      <Show when={uiStore.store.activeModal === "command-palette"}>
        <CommandPalette
          entries={appsStore.store.entries}
          theme={palette()}
          currentLayout={layoutMode()}
          onSelect={(entry, action) => {
            if (action === "edit") {
              openEditModal(entry.id)
              return
            }

            uiStore.closeModal()
            if (action === "remove") {
              requestDelete(entry.id)
              return
            }

            if (isPanesLayout()) {
              if (action === "switch") {
                client().createWindow(entry)
                focusPaneOnLaunch()
                return
              }
              if (action === "stop") {
                const activePane = activeRunningPane()
                if (activePane && activePane.entry.id === entry.id) {
                  client().closePane(activePane.paneId)
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
              return
            }
            if (action.type === "switch_layout") {
              uiStore.closeModal()
              void switchLayout(layoutMode() === "tabs" ? "panes" : "tabs")
              return
            }
          }}
          onClose={() => uiStore.closeModal()}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "add-tab"}>
        <AddTabModal
          theme={palette()}
          onAdd={handleAddApp}
          onClose={() => uiStore.closeModal()}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "edit-app" && editingEntry()}>
        <EditAppModal
          theme={palette()}
          entry={editingEntry()!}
          onSave={(updates) => handleEditApp(editingEntry()!.id, updates)}
          onDelete={() => {
            const id = editingEntry()!.id
            setEditingEntryId(null)
            requestDelete(id)
          }}
          onClose={() => {
            uiStore.closeModal()
            setEditingEntryId(null)
          }}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "confirm-delete" && deletingEntry()}>
        <ConfirmDialog
          theme={palette()}
          title="Delete app?"
          message={`Delete "${deletingEntry()!.name}" from your app list?`}
          detail="This removes it from your config. (it can be re-added later)"
          confirmHint="y:Delete"
          cancelHint="n/Esc:Cancel"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "help"}>
        <HelpModal
          theme={palette()}
          layoutMode={layoutMode()}
          onClose={() => uiStore.closeModal()}
        />
      </Show>

      <Show when={uiStore.store.activeModal === "theme-picker"}>
        <ThemePicker
          theme={palette()}
          onSelect={(themeId) => {
            void handleThemeChange(themeId)
          }}
          onClose={() => uiStore.closeModal()}
        />
      </Show>
    </box>
  )
}
