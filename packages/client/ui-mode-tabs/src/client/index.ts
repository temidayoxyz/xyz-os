/**
 * XYZ-OS mode switch plugin, browser half: Work/Code/Design tabs in the
 * sidebar, one per agent preset, riding the SAME seat controller the hero
 * chip stages — the tabs are a second face of one choice, so the two surfaces
 * can never disagree.
 *
 * The seat itself is provided by ui-agent-preset in the conversation scope;
 * the key is a global symbol so the two plugin bundles resolve one instance.
 * Absent the preset surface the tabs render nothing.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the conversation scope services (sessions, workspaces).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
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

  ctx.inject(['slots', 'conversation', 'sessions', 'workspaces'], (scope: ClientContext) => {
    // ui-agent-preset provides the seat in this same scope (same service
    // tuple → same scope instance) and sits earlier in the composition, so
    // the provide lands before this get runs.
    const seat = (scope.get as (key: string) => unknown)(AGENT_PRESET_SEAT_KEY) as SharedAgentPresetSeat | undefined
    if (seat === undefined) return () => {}

    const pick = (id: string): void => {
      const state = scope.sessions.list.getSnapshot()
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
      scope.workspaces.startSession()
    }

    const modes = scope.slots.register({
      name: 'sidebar.modes',
      locale: 'sidebar.modes',
      inject: (): ModeTabsInjected => ({
        hooks: { modeSeat: seat.store },
        pick,
      }),
    }, ModeTabs)
    return () => { modes() }
  })
}
