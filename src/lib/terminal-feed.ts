/**
 * Drives a persistent `<ghostty-terminal>` renderable by feeding it only the
 * *new* output since the last update, instead of re-setting the whole ANSI
 * buffer each frame.
 *
 * Why this exists: the stateless path (`ansi={fullBuffer}`) re-parsed an
 * ever-growing, char-capped string on every render. That `.slice(-cap)` cut the
 * byte stream mid-escape-sequence (leaving literal junk like "5m") and, once the
 * foundational paint scrolled past the cap, full-screen apps' cursor-positioning
 * gaps collapsed into squished text. Feeding deltas into a stateful grid avoids
 * both: the grid is the source of truth and is never sliced.
 *
 * The renderable must be in persistent mode (forced at construction in
 * index.tsx). If a platform lacks native persistent support, `feed()` throws and
 * we transparently fall back to the old stateless `ansi=` behaviour.
 */
export interface TerminalFeedSource {
  /** Accumulated (char-capped) output, used to replay state on (re)attach. */
  buffer: string
  /** Monotonic total-bytes counter; absent until the first chunk. */
  seq?: number
  /** Identity of the current run. Changes on app switch or restart -> reset. */
  key: string
}

export interface TerminalFeeder {
  /** Feed any new output for `src` into the attached terminal. */
  sync: (src: TerminalFeedSource | undefined) => void
  /** Bind the renderable instance (callback ref) and replay current state. */
  attach: (el: any, src: TerminalFeedSource | undefined) => void
}

export function createTerminalFeeder(): TerminalFeeder {
  let term: any = null
  let fedSeq = 0
  let lastKey = ""
  let persistentOk = true

  const sync = (src: TerminalFeedSource | undefined): void => {
    if (!src || !term) return
    const buffer = src.buffer ?? ""

    // Fallback path: no native persistent support -> behave like the old code.
    if (!persistentOk) {
      if (term.ansi !== buffer) term.ansi = buffer
      return
    }

    // A new run (tab switch or restart) means a fresh grid + full replay.
    if (src.key !== lastKey) {
      try {
        term.reset()
      } catch {
        // reset only exists in persistent mode; ignore if unavailable.
      }
      fedSeq = 0
      lastKey = src.key
    }

    const seq = src.seq ?? buffer.length
    const newCount = seq - fedSeq
    if (newCount <= 0) return

    // `newCount >= buffer.length` means we're replaying from scratch (or fell
    // behind the cap) — feed the whole available buffer. Otherwise feed exactly
    // the new tail; slicing from the end is correct even when the buffer
    // front-trimmed, because the new bytes were just appended.
    const chunk = newCount >= buffer.length ? buffer : buffer.slice(-newCount)
    try {
      term.feed(chunk)
      fedSeq = seq
    } catch {
      // Native persistent support missing — degrade to stateless rendering.
      persistentOk = false
      try {
        term.ansi = buffer
      } catch {
        // nothing more we can do
      }
    }
  }

  const attach = (el: any, src: TerminalFeedSource | undefined): void => {
    term = el
    lastKey = ""
    fedSeq = 0
    sync(src)
  }

  return { sync, attach }
}
