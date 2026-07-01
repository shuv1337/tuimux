# Operational Details

## Build & Development
- **Run:** `tuimux` (after global install) or `bunx tuimux`
- **Dev:** `bun run dev` (Runs `src/index.tsx` directly)
- **Build:** `bun run build` (Runs `build.ts` and adds shebang)
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`)
- **Global Install:** `bun install -g tuimux`
- **Post-commit validation:** After committing changes, run `bun run build` and confirm the global binary matches by hashing `dist/index.js` and `$(readlink -f $(command -v tuimux))` with `sha256sum`.
- **Debug:** Set `TUIMUX_DEBUG=1` for verbose logging.

## Configuration
- Default config location: `~/.config/tuimux/tuimux.yaml` (XDG_CONFIG_HOME) or local `./tuimux.yaml`.
- State directory: `~/.local/state/tuimux/` (XDG_STATE_HOME).
- On first run with no config, tuimux auto-migrates an existing `~/.config/tuidoscope` config + session if present.

## Theming conventions
- Chrome containers (sidebar bodies, header bands, embedded-app title strips) must NOT set an explicit `backgroundColor`/`bg` — leaving it `undefined` lets terminal transparency show through, matching `@opentui/core`'s default `backgroundColor: "transparent"`. Only highlighted/active/selected rows should paint `theme.surfaceAlt` (or similar) for readability. See `TabItem.tsx`'s `rowBg()` for the reference pattern; `TabList.tsx`, `WindowList.tsx`, `TerminalPane.tsx`, and `PaneView.tsx` all follow it.
- When a `<box>` needs a background fill AND a border, prefer applying background only where required (e.g. selected rows) rather than a full-container fill, to avoid opaque-slab regressions like GH issue #20.

## Key Tech
- **TUI Framework:** `@opentui/solid`, `@opentui/core`
- **Runtime:** `bun`
- **Language:** TypeScript

## Architecture: client/server split has no shared terminal
- `session-server.ts` (`--server`) is spawned `detached: true` with
  `stdio: ["ignore", "ignore", "ignore"]` (`session-client.ts`,
  `spawnServerProcess`) — it owns every PTY (`pty.ts`) but is **never attached
  to a real terminal**, even when it's the only tuimux process running.
- Only the frontend/client process (the one that called `render()` from
  `@opentui/solid` in `index.tsx`) is attached to whatever terminal tuimux was
  launched inside — a bare terminal, or a parent multiplexer (Herdr, Zellij,
  tmux).
- Consequence: any feature that needs to reach the *real* terminal (clipboard
  OSC 52 passthrough, terminal capability queries aimed at the outer
  terminal, etc.) must live in the client process (`app.tsx`/
  `session-client.ts`), not in `pty.ts`/`session-server.ts` — those only ever
  see the child app's PTY, never the terminal tuimux itself is running in.
- Within the client, don't write raw escape sequences via `process.stdout` —
  opentui's `CliRenderer` intercepts `stdout.write` to capture stray console
  output for its own overlay, which would swallow them. Open `/dev/tty`
  directly instead (see `src/lib/osc52.ts`).

## Paste/clipboard across nested terminal layers
- opentui's `KeyHandler` intercepts bracketed-paste sequences (`ESC[200~` /
  `ESC[201~`) from stdin before `useKeyboard` ever sees them, emitting a
  separate `"paste"` event (`@opentui/solid`'s `usePaste`). Any component that
  needs paste input must call `usePaste` explicitly — `useKeyboard` alone will
  never receive it, regardless of what layer sits above tuimux.
- `pty.ts` tracks whether the *child* app has enabled bracketed paste mode
  (watching its output for `ESC[?2004h` / `ESC[?2004l`) and only wraps
  forwarded paste text in bracketed-paste markers when the child asked for
  them — matching how a real terminal emulator decides whether to bracket a
  paste. See `docs/troubleshooting.md` → "Copy & Paste" for the required
  parent-multiplexer config (tmux `set-clipboard`, Zellij `copy_command`) and
  the one known unfixed gap (OSC 52 clipboard *read-back* isn't wired up).
