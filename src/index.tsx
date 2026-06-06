import { render, extend } from "@opentui/solid"
import { App } from "./app"
import { loadConfig } from "./lib/config"
import { debugLog, enableDebug } from "./lib/debug"
import { connectSessionClient, shutdownSessionServer } from "./lib/session-client"
import { startSessionServer } from "./lib/session-server"
import { parseArgs, printHelp, printVersion, printUnknownFlags } from "./lib/cli"

async function main() {
  try {
    // Parse CLI arguments first
    const options = parseArgs(process.argv)

    // Handle unknown flags
    if (options.unknown.length > 0) {
      printUnknownFlags(options.unknown)
      process.exit(1)
    }

    // Handle --help
    if (options.help) {
      printHelp()
      process.exit(0)
    }

    // Handle --version
    if (options.version) {
      printVersion()
      process.exit(0)
    }

    if (options.debug) {
      enableDebug()
    }

    debugLog("[init] main() started")

    // Handle --shutdown
    if (options.shutdown) {
      debugLog("[init] Shutdown requested")
      const didShutdown = await shutdownSessionServer()
      if (!didShutdown) {
        console.error("No running tuidoscope session server found.")
        process.exit(1)
      }
      return
    }

    // Handle --server
    if (options.server) {
      debugLog("[init] Starting session server")
      await startSessionServer(options.layout)
      return
    }
    
    // Dynamic import to catch module resolution errors
    debugLog("[init] Importing ghostty-opentui/terminal-buffer...")
    let GhosttyTerminalRenderable: any
    try {
      const module = await import("ghostty-opentui/terminal-buffer")
      GhosttyTerminalRenderable = module.GhosttyTerminalRenderable
      debugLog("[init] ghostty-opentui/terminal-buffer imported successfully")
    } catch (importError) {
      debugLog(`[init] ERROR importing ghostty-opentui: ${importError}`)
      console.error("Failed to import ghostty-opentui/terminal-buffer:", importError)
      process.exit(1)
    }
    
    // Register the ghostty-terminal component.
    //
    // We force persistent (stateful) mode. The OpenTUI reconciler constructs
    // renderables with only `{ id }` and applies the rest of the props via
    // setters afterwards — but `persistent` can only be enabled at construction
    // time (its setter is a no-op). So we inject it here via a subclass.
    //
    // Persistent mode is what makes full-screen TUIs (Claude Code, btop, …)
    // render correctly: we feed PTY deltas into a stateful grid instead of
    // re-parsing an ever-growing, char-capped ANSI string each frame. The old
    // stateless path sliced the raw byte stream mid-escape-sequence (producing
    // artifacts like a literal "5m") and dropped cursor-positioning gaps (the
    // collapsed/squished whitespace). See TerminalPane/PaneView for the feed.
    debugLog("[init] Calling extend() to register ghostty-terminal...")
    class PersistentGhosttyTerminal extends GhosttyTerminalRenderable {
      constructor(ctx: any, options: any) {
        super(ctx, { ...options, persistent: true })
      }
    }
    extend({ "ghostty-terminal": PersistentGhosttyTerminal as any })
    debugLog("[init] extend() completed")
    
    // Load configuration
    const { config } = await loadConfig()
    if (options.layout) {
      config.layout = options.layout
    }
    debugLog("[init] Config loaded")

    const sessionClient = await connectSessionClient({ layout: options.layout })

    // Render the app using opentui/solid
    debugLog("[init] Calling render()...")
    try {
      // exitOnCtrlC:false — opentui's built-in handler would call destroy() on
      // Ctrl+C regardless of our keyboard handler. We manage Ctrl+C ourselves so
      // it passes through to the focused PTY (and is ignored in tabs/manager mode).
      await render(
        () => (
          <App config={config} sessionClient={sessionClient} startWithAddModal={options.add} />
        ),
        { exitOnCtrlC: false },
      )
      debugLog("[init] render() completed")
    } catch (renderError) {
      debugLog(`[init] ERROR in render(): ${renderError}`)
      debugLog(`[init] Stack: ${renderError instanceof Error ? renderError.stack : 'no stack'}`)
      throw renderError
    }

    // Handle process signals for graceful shutdown
    const handleShutdown = () => {
      debugLog("[init] Shutdown signal received")
      sessionClient.disconnect()
      process.exit(0)
    }

    // SIGINT (Ctrl+C) is handled in the keyboard event handler to allow
    // passthrough to the active PTY. SIGTERM is kept for external termination.
    process.on("SIGTERM", handleShutdown)

  } catch (error) {
    debugLog(`[init] FATAL ERROR: ${error}`)
    debugLog(`[init] Stack: ${error instanceof Error ? error.stack : 'no stack'}`)
    console.error("Failed to start tuidoscope:", error)
    process.exit(1)
  }
}

main()
