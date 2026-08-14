/**
 * XYZ-OS mode switch: Work / Code / Design tabs in the sidebar, one per agent
 * preset. The tabs are the seat wearing a fixed roster — clicking one stages
 * exactly what the hero chip stages, from a surface that never unmounts.
 *
 * Wide, the modes render as a segmented bar under New Session; on the rail
 * they collapse to three glyph buttons in the rail's vertical rhythm. The
 * active mode carries the business-state accent — the brand red — the one
 * loud element in the column, echoing the wordmark badge above it.
 */

import { useEffect } from 'react'
import type { ComponentType } from 'react'
import type { AgentPresetSeatState } from '@deepseek-ai/dsh-client-ui-agent-preset/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconCodeOutline16, IconFolderOpenOutline16, IconListPenOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModeTabsLocaleKey } from './locales.ts'
import type { SidebarModesOwnerProps } from './contract.ts'
import css from './ModeTabs.module.css'

/** Registration-side business face for the mode switch. */
export interface ModeTabsInjected {
  hooks: {
    /** Seat snapshot bound by the renderer as useModeSeat. */
    modeSeat: SnapshotStore<AgentPresetSeatState>
  }
  /** Read the roster when the tabs first render (the chip may never mount). */
  load: () => Promise<void>
  /** Stage one mode's preset; starts a new session when the current one refuses the swap. */
  pick: (presetId: string) => void
}

/** Full component props. */
export type ModeTabsProps =
  SidebarModesOwnerProps
  & PropsLocale<'sidebar.modes'>
  & InjectFace<ModeTabsInjected>

/** One mode: the preset it stages, its copy key, and its glyph. */
interface ModeTab {
  /** Preset id the tab stages. */
  presetId: string
  /** Locale key for the tab's label. */
  label: ModeTabsLocaleKey
  /** Glyph for the mode; the rail renders it at 18, wide at 14. */
  Icon: ComponentType<{ size?: number }>
}

/** The fixed roster: the three modes XYZ-OS is built around. */
const MODES: readonly ModeTab[] = [
  { presetId: 'standard', label: 'work', Icon: IconFolderOpenOutline16 },
  { presetId: 'code', label: 'code', Icon: IconCodeOutline16 },
  { presetId: 'design', label: 'design', Icon: IconListPenOutline16 },
]

/**
 * Render the mode switch.
 * @param props - composed slot props.
 * @returns the tabs, or null when the deployment composes none of the mode presets.
 */
export function ModeTabs({ wide, useModeSeat, load, pick, t }: ModeTabsProps) {
  const state = useModeSeat(snapshot => snapshot)

  // The tabs outlive the hero chip (which also loads this roster), so they
  // read it themselves on mount — otherwise a session view with no hero visit
  // would render an empty options list and hide the switch.
  useEffect(() => {
    void load()
  }, [load])

  const roster = new Set(state.options.map(option => option.id))
  const modes = MODES.filter(mode => roster.has(mode.presetId))
  // A deployment without the mode presets has nothing to switch between.
  if (modes.length === 0) return null

  return (
    <div className={wide ? css.segment : css.rail} role="radiogroup" aria-label={t('modes')}>
      {modes.map((mode) => {
        const active = state.current === mode.presetId
        const label = t(mode.label)
        return (
          <Tooltip key={mode.presetId} label={label} side="right" delayMs={500} disabled={wide}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              className={active ? `${css.tab} ${css.tabActive}` : css.tab}
              onClick={() => { pick(mode.presetId) }}
            >
              <mode.Icon size={wide ? 14 : 18} />
              {wide && <span className={css.tabLabel}>{label}</span>}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
