# Plan: Dedupe Classic/Zellij Session Server Internals

## Context

`src/lib/session-server.ts` currently contains both session-server implementations:

- Classic layout: `startSessionServer()` handles tab-oriented app processes.
- Zellij layout: `startZellijSessionServer()` handles windows, panes, and pane layout state.

The recent stability pass added:

- `src/lib/session-lifecycle.ts` for classic exit/restart cleanup.
- `src/lib/list-window.ts` for command palette result windowing.
- `stop_entry` IPC wiring in `src/lib/ipc.ts`, `src/lib/session-client.ts`, and `src/lib/session-server.ts`.

This follow-up refactor should reduce duplication in `src/lib/session-server.ts` while preserving all public behavior and IPC wire shapes.

## Goals

- [ ] Reduce duplicated socket, PTY lifecycle, output buffering, shutdown, and persistence mechanics.
- [ ] Keep classic and zellij layout behavior explicit and readable.
- [ ] Avoid changing `ClientMessage`, `ServerMessage`, config schema, keybindings, session file shape, or user-facing behavior.
- [ ] Improve testability of session-server internals before any larger feature work.

## Non-Goals

- [ ] Do not redesign classic or zellij UX.
- [ ] Do not change `src/lib/ipc.ts` message names or payloads.
- [ ] Do not rewrite the whole server into a generic framework.
- [ ] Do not alter session persistence semantics beyond preserving current behavior.

## Relevant Code References

| Area | Current Files |
|---|---|
| Session orchestration | `src/lib/session-server.ts` |
| IPC types and framing | `src/lib/ipc.ts` |
| Client commands | `src/lib/session-client.ts` |
| PTY spawning | `src/lib/pty.ts` |
| Session persistence | `src/lib/session.ts` |
| Layout tree helpers | `src/lib/layout.ts` |
| Runtime/shared types | `src/types/index.ts` |
| Existing restart helper | `src/lib/session-lifecycle.ts` |
| Existing tests | `src/lib/session.test.ts`, `src/lib/session-lifecycle.test.ts` |

No external research is required.

## Proposed Module Boundaries

### 1. Shared Socket Server

Create `src/lib/session-socket-server.ts`.

Responsibilities:

- [ ] Own `ensureSocketDir()` and stale `SOCKET_PATH` unlink before listen.
- [ ] Create the `net.Server`.
- [ ] Track connected clients.
- [ ] Parse newline-delimited JSON messages.
- [ ] Send parse errors as `{ type: "error", message }`.
- [ ] Broadcast serialized `ServerMessage` values to all live clients.
- [ ] Clean up client references on `close` and `error`.
- [ ] Register best-effort socket unlink on `process.on("exit")`.

Suggested interface:

```ts
interface SessionSocketServerOptions {
  onClientConnect: (socket: net.Socket) => void
  onMessage: (message: ClientMessage, socket: net.Socket) => void
}

interface SessionSocketServer {
  server: net.Server
  clients: Set<net.Socket>
  broadcast: (message: ServerMessage) => void
  closeClients: () => void
  closeServer: () => Promise<void>
  unlinkSocket: () => Promise<void>
}
```

Validation:

- [ ] Existing snapshot-on-connect behavior still comes from each layout implementation through `onClientConnect`.
- [ ] Malformed JSON still returns an `error` server message.
- [ ] `bun run typecheck` confirms `ClientMessage`/`ServerMessage` stay unchanged.

### 2. Shared Persistence Debounce

Create `src/lib/session-persistence.ts`.

Responsibilities:

- [ ] Encapsulate `persistTimer`, `persistPromise`, `suppressSessionUpdates`, and `shuttingDown` checks.
- [ ] Provide `persistIfNeeded()` with the current 100ms debounce behavior.
- [ ] Provide `flushOrPersistOnShutdown(clearSession)` behavior that matches current classic/zellij shutdown branches.

Suggested interface:

```ts
interface SessionPersistenceController {
  persistIfNeeded: () => void
  flushForShutdown: (options?: { clearSession?: boolean }) => Promise<void>
  suppress: () => void
  cancelPendingTimer: () => void
}
```

Layout-specific code should provide the snapshot writer:

```ts
type PersistSession = () => Promise<void>
```

Validation:

- [ ] Classic session files still contain `runningApps`, `activeTab`, and `timestamp`.
- [ ] Zellij session files still contain `runningApps`, `activeTab`, `windows`, `panes`, `activeWindowId`, `activePaneId`, and `timestamp`.
- [ ] `src/lib/session.test.ts` remains green.

### 3. Shared PTY Runtime Helper

Create `src/lib/session-runtime.ts`.

Responsibilities:

- [ ] Define reusable `PendingOutput`.
- [ ] Define a generic `RunningProcess` shape compatible with classic apps and zellij panes.
- [ ] Encapsulate output buffering with `MAX_BUFFER_CHARS = 200_000`.
- [ ] Encapsulate pending-output flush timer setup.
- [ ] Encapsulate manual-stop tracking by `runId`.
- [ ] Expose helper functions for common stop/kill/resize mechanics.

Keep identity layout-specific:

- Classic process key: app entry id.
- Zellij process key: pane id.

Suggested interface:

```ts
interface RunningProcess {
  entry: AppEntry
  restartEntry: AppEntry
  pty: PtyProcess
  status: AppStatus
  buffer: string
  runId: number
}

interface RuntimeOutputController<Key extends string> {
  pendingOutputs: Map<Key, PendingOutput>
  flushOutput: (key: Key) => void
}
```

Validation:

- [ ] Classic still emits `output`, `started`, `stopped`, and `status`.
- [ ] Zellij still emits `pane_output`, `pane_started`, `pane_stopped`, and `pane_status`.
- [ ] Buffer truncation remains `200_000` chars.
- [ ] `restart_on_exit` remains covered by `src/lib/session-lifecycle.test.ts`.

### 4. Keep Layout Controllers Separate

After extracting shared mechanics, leave two layout-specific controllers inside `src/lib/session-server.ts` or move them to:

- `src/lib/session-classic-server.ts`
- `src/lib/session-zellij-server.ts`

Recommended final shape:

```ts
// src/lib/session-server.ts
export async function startSessionServer(layoutOverride?: LayoutMode): Promise<void> {
  const { config } = await loadConfig()
  if (layoutOverride) config.layout = layoutOverride
  if (config.layout === "zellij") {
    await startZellijSessionServer(config)
    return
  }
  await startClassicSessionServer(config)
}
```

Classic should continue to own:

- [ ] `runningApps`
- [ ] `activeTabId`
- [ ] classic snapshots
- [ ] classic message handling: `start`, `stop`, `stop_all`, `stop_entry`, `restart`, `input`, `resize`, `set_active`, `update_entry`, `shutdown`

Zellij should continue to own:

- [ ] `runningPanes`
- [ ] `windows`
- [ ] `activeWindowId`
- [ ] `activePaneId`
- [ ] `lastPaneSizes`
- [ ] window/pane layout mutations
- [ ] zellij message handling: `create_window`, `split_pane`, `close_pane`, `close_window`, `stop_entry`, `set_active_window`, `set_active_pane`, `resize_pane`, `input`, `shutdown`

## Implementation Order

### Milestone 1: Extract Socket Plumbing

- [ ] Add `src/lib/session-socket-server.ts`.
- [ ] Move socket setup, stale unlink, message parsing, broadcast, client cleanup, and close helpers out of `src/lib/session-server.ts`.
- [ ] Update classic and zellij server setup to use the shared socket helper.
- [ ] Keep snapshot creation in each layout controller.
- [ ] Run:

```bash
bun run typecheck
bun test
```

### Milestone 2: Extract Persistence Debounce

- [ ] Add `src/lib/session-persistence.ts`.
- [ ] Move debounce state and shutdown flush/clear-session coordination into the helper.
- [ ] Keep classic/zellij session snapshot construction layout-specific.
- [ ] Verify `shutdown({ clearSession: true })` still clears persisted state before stopping processes.
- [ ] Run:

```bash
bun run typecheck
bun test
```

### Milestone 3: Extract Runtime Output/PTY Mechanics

- [ ] Add `src/lib/session-runtime.ts`.
- [ ] Move `MAX_BUFFER_CHARS`, `PendingOutput`, output buffering, flush timer setup, and shared stop/resize helpers.
- [ ] Keep classic/zellij event names layout-specific.
- [ ] Keep `handleClassicRunExit()` in `src/lib/session-lifecycle.ts`.
- [ ] Add unit tests for buffer truncation and pending-output flush behavior if the helper can be tested synchronously.
- [ ] Run:

```bash
bun run typecheck
bun test
```

### Milestone 4: Optional Split Into Layout Controllers

- [ ] If `src/lib/session-server.ts` is still too large, move classic logic to `src/lib/session-classic-server.ts`.
- [ ] Move zellij logic to `src/lib/session-zellij-server.ts`.
- [ ] Leave `src/lib/session-server.ts` as the dispatch wrapper.
- [ ] Do not rename exported `startSessionServer()`.

### Milestone 5: Final Validation

- [ ] Run full validation:

```bash
bun test
bun run typecheck
bun run build
bun dist/index.js --version
git diff --check
```

- [ ] Confirm `bun dist/index.js --version` reports the package version from `package.json`.
- [ ] Confirm no public IPC union members were removed or renamed in `src/lib/ipc.ts`.

## Behavioral Regression Checklist

- [ ] Classic autostart still starts configured `autostart: true` apps.
- [ ] Classic persisted sessions still restore running apps and active tab.
- [ ] Classic `restart_on_exit` still restarts failed non-manual exits.
- [ ] Classic manual stops still do not restart.
- [ ] Classic `stop_entry` still stops the matching app and clears active tab if needed.
- [ ] Zellij starts a default shell window when no windows exist.
- [ ] Zellij persisted windows/panes still restore.
- [ ] Zellij pane splits and window cycling still work.
- [ ] Zellij `stop_entry` closes every pane whose `pane.entry.id` matches.
- [ ] `--shutdown` still stops processes, closes clients, unlinks the socket, and clears persisted session state.

## Risks And Constraints

- [ ] Avoid over-generalizing classic app ids and zellij pane ids into a vague abstraction. Keep the key type explicit at call sites.
- [ ] Do not centralize layout-specific server messages; shared helpers should expose hooks/callbacks so classic and zellij keep their current event names.
- [ ] Shutdown ordering matters: persist or clear session first, suppress future session updates, then stop processes and close clients.
- [ ] Socket cleanup should remain best effort and should not crash the app if unlink fails.

## Completion Criteria

- [ ] `src/lib/session-server.ts` is reduced to layout dispatch plus clear classic/zellij orchestration, or split into small layout controller files.
- [ ] Shared socket, persistence, and runtime helper modules have targeted tests where practical.
- [ ] No user-facing behavior, config schema, session file format, or IPC wire shape changes.
- [ ] Full validation passes.
