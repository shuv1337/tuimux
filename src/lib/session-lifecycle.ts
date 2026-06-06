import type { AppStatus } from "../types"

export interface TabsExitedRunState {
  status: AppStatus
  restartEntry: {
    restartOnExit: boolean
  }
}

export interface TabsExitResult {
  status: AppStatus | null
  shouldRestart: boolean
}

export function handleTabsRunExit<T extends TabsExitedRunState, P>(
  runningApps: Map<string, T>,
  pendingOutputs: Map<string, P>,
  id: string,
  exitCode: number,
  wasManualStop: boolean
): TabsExitResult {
  const current = runningApps.get(id)
  if (!current) {
    return { status: null, shouldRestart: false }
  }

  const status: AppStatus = exitCode === 0 ? "stopped" : "error"
  current.status = status

  const shouldRestart = !wasManualStop && current.restartEntry.restartOnExit && exitCode !== 0
  if (shouldRestart) {
    runningApps.delete(id)
    pendingOutputs.delete(id)
  }

  return { status, shouldRestart }
}
