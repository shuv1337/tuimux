import net from "node:net"
import { EventEmitter } from "events"
import { existsSync } from "fs"
import { unlink } from "fs/promises"
import { debugLog } from "./debug"
import { SOCKET_PATH, serializeMessage, type ClientMessage, type ServerMessage } from "./ipc"
import type { AppEntry, LayoutMode } from "../types"

const CONNECT_RETRIES = 20
const CONNECT_DELAY_MS = 100

export class SessionClient extends EventEmitter {
  private socket: net.Socket
  private buffer = ""

  constructor(socket: net.Socket) {
    super()
    this.socket = socket
    this.socket.setEncoding("utf8")
    this.socket.on("data", (data) =>
      this.handleData(typeof data === "string" ? data : data.toString())
    )
    this.socket.on("close", () => this.emit("disconnect"))
    this.socket.on("error", () => this.emit("disconnect"))
  }

  private handleData(data: string) {
    this.buffer += data
    let newlineIndex = this.buffer.indexOf("\n")
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)
      newlineIndex = this.buffer.indexOf("\n")
      if (!line) {
        continue
      }
      try {
        const message = JSON.parse(line) as ServerMessage
        if (message.type === "error") {
          debugLog(`[client] Server error: ${message.message}`)
          return
        }
        this.emit(message.type, message)
      } catch (error) {
        debugLog(`[client] Failed to parse message: ${error}`)
      }
    }
  }

  private send(message: ClientMessage) {
    if (this.socket.destroyed) {
      return
    }
    this.socket.write(serializeMessage(message))
  }

  start(entry: AppEntry) {
    this.send({ type: "start", entry })
  }

  stop(id: string) {
    this.send({ type: "stop", id })
  }

  stopAll() {
    this.send({ type: "stop_all" })
  }

  stopEntry(id: string) {
    this.send({ type: "stop_entry", id })
  }

  restart(entry: AppEntry) {
    this.send({ type: "restart", entry })
  }

  sendInput(id: string, data: string) {
    this.send({ type: "input", id, data })
  }

  resize(cols: number, rows: number) {
    this.send({ type: "resize", cols, rows })
  }

  setActiveTab(id: string | null) {
    this.send({ type: "set_active", id })
  }

  createWindow(entry: AppEntry) {
    this.send({ type: "create_window", entry })
  }

  splitPane(paneId: string, direction: "horizontal" | "vertical", entry: AppEntry) {
    this.send({ type: "split_pane", paneId, direction, entry })
  }

  closePane(paneId: string) {
    this.send({ type: "close_pane", paneId })
  }

  closeWindow(windowId: string) {
    this.send({ type: "close_window", windowId })
  }

  setActiveWindow(id: string | null) {
    this.send({ type: "set_active_window", id })
  }

  setActivePane(id: string | null) {
    this.send({ type: "set_active_pane", id })
  }

  resizePane(paneId: string, cols: number, rows: number) {
    this.send({ type: "resize_pane", paneId, cols, rows })
  }

  updateEntry(id: string, updates: Partial<AppEntry>) {
    this.send({ type: "update_entry", id, updates })
  }

  shutdown(options?: { clearSession?: boolean }) {
    this.send({ type: "shutdown", clearSession: options?.clearSession })
    this.disconnect()
  }

  async shutdownAndWait(
    timeoutMs = 1500,
    options?: { clearSession?: boolean }
  ): Promise<void> {
    this.send({ type: "shutdown", clearSession: options?.clearSession })

    await new Promise<void>((resolve) => {
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        this.socket.off("close", finish)
        this.socket.off("error", finish)
        resolve()
      }

      const timer = setTimeout(() => {
        this.socket.end()
        finish()
      }, timeoutMs)

      this.socket.once("close", finish)
      this.socket.once("error", finish)
    })
  }

  disconnect() {
    this.socket.end()
  }
}

async function connectSocket(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(SOCKET_PATH, () => resolve(socket))
    socket.once("error", (error) => {
      socket.destroy()
      reject(error)
    })
  })
}

async function spawnServerProcess(
  layout?: LayoutMode,
  options?: { seedDefaultWindow?: boolean }
): Promise<void> {
  // Bun.main is a stable way to find the actual entrypoint even when the CLI is
  // invoked via a symlink (e.g. `tui`) where process.argv[1] may not end in .js.
  const candidates = [
    typeof Bun !== "undefined" ? Bun.main : undefined,
    process.argv[1],
  ].filter((value): value is string => typeof value === "string" && value.length > 0)

  const entry = candidates.find((candidate) => /\.(tsx|ts|js)$/.test(candidate))
  const args = entry ? [entry, "--server"] : ["--server"]
  if (layout) {
    args.push("--layout", layout)
  }
  if (options?.seedDefaultWindow === false) {
    args.push("--no-default-window")
  }

  const proc = Bun.spawn([process.execPath, ...args], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: process.env,
    cwd: process.cwd(),
  })

  if (proc.unref) {
    proc.unref()
  }
}

async function waitForServer(): Promise<net.Socket> {
  let lastError: unknown
  for (let attempt = 0; attempt < CONNECT_RETRIES; attempt += 1) {
    try {
      return await connectSocket()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS))
    }
  }

  throw lastError
}

async function clearStaleSocket(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code !== "ECONNREFUSED" && code !== "ENOENT") {
    return
  }

  if (!existsSync(SOCKET_PATH)) {
    return
  }

  try {
    await unlink(SOCKET_PATH)
  } catch (unlinkError) {
    debugLog(`[client] Failed to remove stale socket: ${unlinkError}`)
  }
}

export async function connectSessionClient(options?: { layout?: LayoutMode }): Promise<SessionClient> {
  try {
    const socket = await connectSocket()
    return new SessionClient(socket)
  } catch (error) {
    await clearStaleSocket(error)
    await spawnServerProcess(options?.layout)
    const socket = await waitForServer()
    return new SessionClient(socket)
  }
}

export async function reconnectSessionClient(
  layout: LayoutMode,
  options?: { seedDefaultWindow?: boolean }
): Promise<SessionClient> {
  if (existsSync(SOCKET_PATH)) {
    try {
      await unlink(SOCKET_PATH)
    } catch (unlinkError) {
      debugLog(`[client] reconnect: failed to remove stale socket: ${unlinkError}`)
    }
  }
  await spawnServerProcess(layout, options)
  const socket = await waitForServer()
  return new SessionClient(socket)
}

export async function shutdownSessionServer(): Promise<boolean> {
  try {
    const socket = await connectSocket()
    const client = new SessionClient(socket)
    await client.shutdownAndWait(1500, { clearSession: true })
    return true
  } catch (error) {
    await clearStaleSocket(error)
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code === "ENOENT" || code === "ECONNREFUSED") {
      return false
    }
    throw error
  }
}
