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
