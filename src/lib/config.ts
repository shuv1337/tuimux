import { parse, stringify } from "yaml"
import { z } from "zod"
import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { homedir } from "os"
import { dirname, resolve } from "path"
import { getConfigDir as getXdgConfigDir, paths, getStateDir } from "./xdg"
import { debugLog } from "./debug"
import { generateId } from "./id"
import type { Config } from "../types"

/**
 * Result from loadConfig() including metadata about config file discovery
 */
export interface LoadConfigResult {
  config: Config
  configFileFound: boolean
}

// Local project config (takes precedence)
const LOCAL_CONFIG_PATH = "./tuimux.yaml"

// Zod schema for validation
// Default theme: Graphite (tight dark surface ramp + sparse cyan accent).
// The rich palette is derived at runtime in src/lib/palette.ts.
const ThemeSchema = z.object({
  primary: z.string().default("#7fd1ff"),     // Cyan - selections, highlights
  background: z.string().default("#111315"),  // Near-black graphite
  foreground: z.string().default("#f2f4f6"),  // Neutral white text
  accent: z.string().default("#7fd1ff"),      // Cyan - active indicators
  muted: z.string().default("#9aa4af"),       // Cool gray for inactive elements
})

const AppEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  command: z.string(),
  args: z.string().optional(),
  cwd: z.string().default("~"),
  autostart: z.boolean().default(false),
  restart_on_exit: z.boolean().default(false),
  env: z.record(z.string()).optional(),
})

// Session schema now uses XDG state dir by default
const SessionSchema = z.object({
  persist: z.boolean().default(false),
  file: z.string().optional(), // Will use XDG default if not specified
})

export const ConfigSchema = z.object({
  version: z.number().default(2),
  theme: ThemeSchema.default({}),
  tab_width: z.number().default(20),
  layout: z.preprocess((v) => (v === "classic" ? "tabs" : v === "zellij" ? "panes" : v), z.enum(["tabs", "panes"]).default("tabs")),
  // Move focus into the app's pane automatically when it launches.
  focus_on_launch: z.boolean().default(true),
  apps: z.array(AppEntrySchema).default([]),
  session: SessionSchema.default({}),
})

// Current active config location (may be local or XDG)
let configPath: string = paths.config
let configDir: string = getXdgConfigDir()

/**
 * Expand path tokens like ~ and <CONFIG_DIR>
 */
export function expandPath(path: string): string {
  let expanded = path

  // Expand ~
  if (expanded.startsWith("~")) {
    expanded = expanded.replace("~", homedir())
  }

  // Expand <CONFIG_DIR>
  if (expanded.includes("<CONFIG_DIR>")) {
    expanded = expanded.replace("<CONFIG_DIR>", configDir)
  }

  // Expand <STATE_DIR>
  if (expanded.includes("<STATE_DIR>")) {
    expanded = expanded.replace("<STATE_DIR>", getStateDir())
  }

  return resolve(expanded)
}

/**
 * Load configuration from file, with fallback to defaults
 * 
 * Search order:
 * 1. ./tuimux.yaml (local project config)
 * 2. $XDG_CONFIG_HOME/tuimux/tuimux.yaml
 * 3. Default values
 */
export function ensureAppEntryIds(config: Config): { config: Config; updated: boolean } {
  if (!config.apps.length) {
    return { config, updated: false }
  }

  const seen = new Set<string>()
  let updated = false

  const apps = config.apps.map((entry) => {
    let id = entry.id
    if (!id || seen.has(id)) {
      id = generateId()
      updated = true
    }
    seen.add(id)
    return { ...entry, id }
  })

  if (!updated) {
    return { config, updated: false }
  }

  return {
    config: { ...config, apps },
    updated: true,
  }
}

export async function loadConfig(): Promise<LoadConfigResult> {
  debugLog(`[config] Checking local config: ${LOCAL_CONFIG_PATH}`)
  debugLog(`[config] Checking XDG config: ${paths.config}`)
  
  let configFileFound = false
  
  // Check for local config first
  if (existsSync(LOCAL_CONFIG_PATH)) {
    configPath = resolve(LOCAL_CONFIG_PATH)
    configDir = dirname(configPath)
    configFileFound = true
    debugLog(`[config] Using local config: ${configPath}`)
  } else if (existsSync(paths.config)) {
    configPath = paths.config
    configDir = getXdgConfigDir()
    configFileFound = true
    debugLog(`[config] Using XDG config: ${configPath}`)
  } else {
    // No config exists, use defaults with XDG paths
    configPath = paths.config
    configDir = getXdgConfigDir()
    configFileFound = false
    debugLog(`[config] No config found, using defaults`)
    return { config: ConfigSchema.parse({}) as Config, configFileFound }
  }

  try {
    const content = await readFile(configPath, "utf-8")
    const parsed = parse(content)
    const validated = ConfigSchema.parse(parsed) as Config
    const ensured = ensureAppEntryIds(validated)
    debugLog(`[config] Loaded ${ensured.config.apps.length} apps from config`)

    if (configFileFound && ensured.updated) {
      try {
        await saveConfig(ensured.config)
        debugLog(`[config] Updated config with stable app ids`)
      } catch (error) {
        debugLog(`[config] Failed to update config ids: ${error}`)
      }
    }

    return { config: ensured.config, configFileFound }
  } catch (error) {
    debugLog(`[config] Error loading config: ${error}`)
    console.error(`Error loading config from ${configPath}:`, error)
    return { config: ConfigSchema.parse({}) as Config, configFileFound }
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: Config): Promise<void> {
  // Ensure directory exists
  await mkdir(dirname(configPath), { recursive: true })

  const yamlContent = stringify(config, {
    indent: 2,
    lineWidth: 0,
  })

  await writeFile(configPath, yamlContent, "utf-8")
}

/**
 * Get the current config file path
 */
export function getConfigPath(): string {
  return configPath
}

/**
 * Get the current config directory
 */
export function getConfigDir(): string {
  return configDir
}
