import { appendFileSync, mkdirSync } from "fs"
import { dirname } from "path"
import { paths } from "./xdg"

// Use XDG state dir for debug log, allow override via env
const DEBUG_LOG_PATH = process.env.TUIMUX_DEBUG_LOG || paths.debugLog

let dirCreated = false
let debugEnabled = !!process.env.TUIMUX_DEBUG

/**
 * Enable debug logging programmatically (e.g., from --debug flag)
 */
export function enableDebug(): void {
  debugEnabled = true
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled
}

export function debugLog(message: string) {
  if (!debugEnabled) {
    return
  }

  try {
    // Ensure state directory exists (only check once)
    if (!dirCreated) {
      mkdirSync(dirname(DEBUG_LOG_PATH), { recursive: true })
      dirCreated = true
    }

    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] ${message}\n`
    appendFileSync(DEBUG_LOG_PATH, line)
  } catch {
    // Avoid crashing the UI for logging failures.
  }
}

/**
 * Get the debug log path
 */
export function getDebugLogPath(): string {
  return DEBUG_LOG_PATH
}
