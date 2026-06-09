import { Component, createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { AppEntryConfig } from "../types"
import type { Palette } from "../lib/palette"
import { APP_PRESETS, type AppPreset } from "../lib/presets"
import { commandExists } from "../lib/command"
import { DialogBox } from "./DialogBox"

export interface OnboardingWizardProps {
  theme: Palette
  onComplete: (entries: AppEntryConfig[]) => void
  onSkip: () => void
}

export const OnboardingWizard: Component<OnboardingWizardProps> = (props) => {
  const [step, setStep] = createSignal<1 | 2>(1)
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [checked, setChecked] = createSignal<Set<string>>(new Set())

  const [presetsWithAvailability, setPresetsWithAvailability] = createSignal<AppPreset[]>(APP_PRESETS)

  createEffect(() => {
    let cancelled = false

    const loadAvailability = async () => {
      const presets = await Promise.all(
        APP_PRESETS.map(async (preset) => ({
          ...preset,
          available: await commandExists(preset.command),
        }))
      )
      presets.sort((a, b) => {
        if (a.available !== b.available) {
          return a.available ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      if (!cancelled) {
        setPresetsWithAvailability(presets)
      }
    }

    void loadAvailability()

    onCleanup(() => {
      cancelled = true
    })
  })

  const toggleChecked = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleComplete = () => {
    const presets = presetsWithAvailability()
    const selected = presets
      .filter((p) => checked().has(p.id))
      .map<AppEntryConfig>((p) => ({
        name: p.name,
        command: p.command,
        cwd: "~",
        autostart: false,
      }))
    props.onComplete(selected)
  }

  useKeyboard((event) => {
    if (event.name === "escape") {
      props.onSkip()
      event.preventDefault()
      return
    }

    if (step() === 1) {
      if (event.name === "return" || event.name === "enter") {
        setStep(2)
        event.preventDefault()
      }
      return
    }

    // Step 2 navigation
    const presets = presetsWithAvailability()

    if (event.name === "return" || event.name === "enter") {
      handleComplete()
      event.preventDefault()
      return
    }

    if (event.sequence === "j" || event.name === "down") {
      setSelectedIndex((i) => Math.min(i + 1, presets.length - 1))
      event.preventDefault()
      return
    }

    if (event.sequence === "k" || event.name === "up") {
      setSelectedIndex((i) => Math.max(i - 1, 0))
      event.preventDefault()
      return
    }

    if (event.sequence === " ") {
      const preset = presets[selectedIndex()]
      if (preset) {
        toggleChecked(preset.id)
      }
      event.preventDefault()
      return
    }
  })

  // Calculate scroll offset for preset list
  const VISIBLE_PRESETS = 10
  const scrollOffset = createMemo(() => {
    const idx = selectedIndex()
    const presets = presetsWithAvailability()
    if (presets.length <= VISIBLE_PRESETS) return 0
    const maxOffset = presets.length - VISIBLE_PRESETS
    if (idx < 3) return 0
    if (idx > presets.length - 4) return maxOffset
    return Math.min(idx - 3, maxOffset)
  })

  return (
    <DialogBox theme={props.theme} width="62%" height={step() === 1 ? 12 : 20}>
      {step() === 1 ? (
        <>
          {/* Title */}
          <box height={1} paddingLeft={2}>
            <text fg={props.theme.accent}>
              <b>Welcome to tuimux</b>
            </text>
          </box>

          <box height={1} />

          {/* Intro body */}
          <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
            <box height={1}>
              <text fg={props.theme.text}>tuimux runs your terminal apps in tabs and panes,</text>
            </box>
            <box height={1}>
              <text fg={props.theme.text}>all in one place. Switch between them instantly.</text>
            </box>
            <box height={1} />
            <box height={1}>
              <text fg={props.theme.textDim}>Let's add a few apps to get you started.</text>
            </box>
          </box>

          {/* Footer */}
          <box height={1} flexDirection="row" paddingLeft={2}>
            <Hint theme={props.theme} keyLabel="↵" desc="pick apps" />
            <Hint theme={props.theme} keyLabel="esc" desc="skip" />
          </box>
        </>
      ) : (
        <>
          {/* Title */}
          <box height={1} paddingLeft={2}>
            <text fg={props.theme.accent}>
              <b>Choose apps to add</b>
            </text>
          </box>

          <box height={1} />

          {/* Preset list */}
          <box flexDirection="column" flexGrow={1} paddingRight={2}>
            {presetsWithAvailability()
              .slice(scrollOffset(), scrollOffset() + VISIBLE_PRESETS)
              .map((preset, index) => {
                const actualIndex = () => scrollOffset() + index
                const isSelected = () => selectedIndex() === actualIndex()
                const isChecked = () => checked().has(preset.id)
                const unavailable = () => preset.available === false
                const dot = () =>
                  preset.available === true ? "●" : preset.available === false ? "·" : "?"
                const dotColor = () =>
                  preset.available === true
                    ? props.theme.on
                    : preset.available === false
                      ? props.theme.off
                      : props.theme.warn
                return (
                  <box height={1} flexDirection="row" backgroundColor={isSelected() ? props.theme.surfaceAlt : undefined}>
                    <box width={1} height={1} backgroundColor={isSelected() ? props.theme.accent : undefined} />
                    <text fg={dotColor()}>{" " + dot() + " "}</text>
                    <text fg={isChecked() ? props.theme.accent : (unavailable() ? props.theme.textDim : props.theme.textDim)}>
                      {isChecked() ? "[x]" : "[ ]"}
                    </text>
                    <text fg={unavailable() ? props.theme.textDim : (isSelected() ? props.theme.text : props.theme.textDim)}>
                      {" " + preset.name.padEnd(18)}
                    </text>
                    <text fg={props.theme.textDim}>{preset.description}</text>
                  </box>
                )
              })}
            {/* Scroll indicator */}
            {presetsWithAvailability().length > VISIBLE_PRESETS && (
              <box height={1} paddingLeft={2}>
                <text fg={props.theme.textDim}>
                  {scrollOffset() > 0 ? "↑ " : "  "}
                  {selectedIndex() + 1}/{presetsWithAvailability().length}
                  {scrollOffset() + VISIBLE_PRESETS < presetsWithAvailability().length ? " ↓" : ""}
                </text>
              </box>
            )}
          </box>

          {/* Footer */}
          <box height={1} flexDirection="row" paddingLeft={2}>
            <Hint theme={props.theme} keyLabel="↵" desc="add selected" />
            <Hint theme={props.theme} keyLabel="space" desc="toggle" />
            <Hint theme={props.theme} keyLabel="j/k" desc="nav" />
            <Hint theme={props.theme} keyLabel="esc" desc="skip" />
          </box>
        </>
      )}
    </DialogBox>
  )
}

const Hint: Component<{ theme: Palette; keyLabel: string; desc: string }> = (props) => (
  <>
    <text fg={props.theme.accent}>
      {"  "}
      <b>{props.keyLabel}</b>
    </text>
    <text fg={props.theme.textDim}>{" " + props.desc}</text>
  </>
)
