/**
 * XYZ-OS mode switch plugin, browser half: Work/Code/Design tabs in the
 * sidebar, one per agent preset, riding the SAME seat controller the hero
 * chip stages — the tabs are a second face of one choice, so the two surfaces
 * can never disagree.
 *
 * The seat is provided on the ROOT context by ui-agent-preset (from its own
 * fiber, which may start after this one). The registration lives in a cordis
 * effect that tracks the seat read, so it lands the moment the seat exists —
 * and re-lands if it is ever re-provided. Absent the preset surface the tabs
 * render nothing.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the sessions/workspaces services on the root context.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the shared seat's store shape.
import type { AgentPresetSeatState } from '@deepseek-ai/dsh-client-ui-agent-preset/client'
import type { ClientContext, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { ModeTabs } from './ModeTabs.tsx'
import type { ModeTabsInjected } from './ModeTabs.tsx'
import { en, zh } from './locales.ts'

export type { SidebarModesOwnerProps } from './contract.ts'

/**
 * The seat's shared service key — a namespaced string, because cordis
 * services are string-keyed (symbol keys are refused by the provider).
 */
const AGENT_PRESET_SEAT_KEY = 'dsh.client.agent-preset.seat'

/** What the tabs need from the shared seat (the real controller is richer). */
export interface SharedAgentPresetSeat {
  readonly store: SnapshotStore<AgentPresetSeatState>
  /** Read the roster; the tabs call it on mount like the hero chip does. */
  load(): Promise<void>
  select(id: string): Promise<void>
  stage(id: string): void
}

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Mount the sidebar mode switch.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('sidebar.modes', { zh, en }), 'ui-mode-tabs: dictionaries')

  // The seat read is tracked: when ui-agent-preset's fiber provides the
  // service, this effect re-runs and the registration lands. A one-shot get
  // at apply time could lose a fiber-startup race and hide the tabs forever.
  ctx.effect(() => {
    const seat = (ctx.get as (key: string) => unknown)(AGENT_PRESET_SEAT_KEY) as SharedAgentPresetSeat | undefined
    if (seat === undefined) return () => {}

    const pick = (id: string): void => {
      const state = ctx.sessions.list.getSnapshot()
      const summary = state.current === undefined ? undefined : state.byId[state.current]
      // A blank session (or none at all) takes the pick directly: the seat
      // stages, and applies the moment a blank session is current. A started
      // session refuses the swap, so the pick starts a NEW session instead —
      // the seat's list-change applier composes the blank session the
      // workspace connect produces or reuses.
      if (summary === undefined || summary.blank) {
        void seat.select(id)
        return
      }
      seat.stage(id)
      ctx.workspaces.startSession()
    }

    const modes = ctx.slots.register({
      name: 'sidebar.modes',
      locale: 'sidebar.modes',
      inject: (): ModeTabsInjected => ({
        hooks: { modeSeat: seat.store },
        load: () => seat.load(),
        pick,
      }),
    }, ModeTabs)
    return () => { modes() }
  }, 'ui-mode-tabs: sidebar mode switch')
}
