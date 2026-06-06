import { existsSync, mkdirSync, copyFileSync } from "fs"
import { join } from "path"
import { getConfigDir, getStateDir, getXdgConfigHome, getXdgStateHome } from "./xdg"
import { debugLog } from "./debug"

/**
 * Migrate legacy tuidoscope config/state data to tuimux paths.
 * Idempotent, synchronous, best-effort — never throws or blocks startup.
 */
export function migrateLegacyData(): void {
  try {
    const legacyConfigDir = join(getXdgConfigHome(), "tuidoscope")
    const legacyStateDir = join(getXdgStateHome(), "tuidoscope")
    const tuimuxConfigDir = getConfigDir()
    const tuimuxStateDir = getStateDir()

    // Migrate config: only if tuimux config dir doesn't exist but legacy yaml does
    const legacyConfigYaml = join(legacyConfigDir, "tuidoscope.yaml")
    const tuimuxConfigYaml = join(tuimuxConfigDir, "tuimux.yaml")
    if (!existsSync(tuimuxConfigDir) && existsSync(legacyConfigYaml)) {
      debugLog(`migrate: copying config from ${legacyConfigYaml} to ${tuimuxConfigYaml}`)
      mkdirSync(tuimuxConfigDir, { recursive: true })
      copyFileSync(legacyConfigYaml, tuimuxConfigYaml)
    }

    // Migrate state: only if tuimux state dir doesn't exist but legacy state dir does
    if (!existsSync(tuimuxStateDir) && existsSync(legacyStateDir)) {
      debugLog(`migrate: migrating state dir from ${legacyStateDir} to ${tuimuxStateDir}`)
      mkdirSync(tuimuxStateDir, { recursive: true })
      const filesToCopy = ["session.yaml", "debug.log"]
      for (const filename of filesToCopy) {
        const src = join(legacyStateDir, filename)
        const dst = join(tuimuxStateDir, filename)
        if (existsSync(src)) {
          debugLog(`migrate: copying ${filename}`)
          copyFileSync(src, dst)
        }
      }
      // NOTE: .sock files are intentionally NOT copied
    }
  } catch (err) {
    debugLog(`migrate: error during migration: ${err}`)
  }
}
