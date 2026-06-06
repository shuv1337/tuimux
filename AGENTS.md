# Operational Details

## Build & Development
- **Dev:** `bun run dev` (Runs `src/index.tsx` directly)
- **Build:** `bun run build` (Runs `build.ts` and adds shebang)
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`)
- **Global Install:** `bun install -g tuimux`
- **Post-commit validation:** After committing changes, run `bun run build` and confirm the global binary matches by hashing `dist/index.js` and `$(readlink -f $(command -v tuimux))` with `sha256sum`.

## Configuration
- Default config location: `~/.config/tuimux/tuimux.yaml` (XDG_CONFIG_HOME) or local `./tuimux.yaml`.
- State directory: `~/.local/state/tuimux/` (XDG_STATE_HOME).

## Key Tech
- **TUI Framework:** `@opentui/solid`, `@opentui/core`
- **Runtime:** `bun`
- **Language:** TypeScript
