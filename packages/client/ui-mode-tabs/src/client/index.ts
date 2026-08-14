/**
 * XYZ-OS mode switch plugin, browser half: Coworker/Coder/Designer tabs in
 * the sidebar, one per agent preset.
 *
 * The switch owns its controller outright — no cross-plugin service, no
 * shared seat lookup. The hero chip and the tabs converge through the
 * session list and the host's agentPreset state instead, which is the same
 * convergence every other surface uses. This package must render or fail
 * loudly on its own.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the conversation scope services (sessions, workspaces).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ModeSeatController } from './ModeSeatController.ts'
import { ModeTabs } from './ModeTabs.tsx'
import type { ModeTabsInjected } from './ModeTabs.tsx'
import { en, zh } from './locales.ts'

export type { SidebarModesOwnerProps } from './contract.ts'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Mount the sidebar mode switch.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('sidebar.modes', { zh, en }), 'ui-mode-tabs: dictionaries')

  ctx.inject(['slots', 'conversation', 'sessions', 'workspaces'], (scope) => {
    const api = (scope.get('connection') as ConnectionHandle).api
    const seat = new ModeSeatController(api, () => {
      const state = scope.sessions.list.getSnapshot()
      const summary = state.current === undefined ? undefined : state.byId[state.current]
      return summary === undefined
        ? undefined
        : {
          id: summary.id,
          blank: summary.blank,
          ...summary.agentPreset === undefined ? {} : { agentPreset: summary.agentPreset },
        }
    }, (sessionId, agentPreset) => {
      scope.sessions.noteAgentPreset(sessionId as never, agentPreset)
    })

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

    scope.effect(() => {
      // A session appearing (workspace connect) applies the staged pick.
      const stop = scope.sessions.list.subscribe(() => { void seat.apply() })
      // Every tab folds the committed preset into the shared session row;
      // the initiating tab may already have applied the RPC echo, which is
      // idempotent.
      const presetSelected = scope.remote.$on('agent-preset/selected', (sessionId, agentPreset) => {
        scope.sessions.noteAgentPreset(sessionId, agentPreset)
      })
      return () => {
        stop()
        presetSelected()
      }
    })

    const modes = scope.slots.register({
      name: 'sidebar.modes',
      locale: 'sidebar.modes',
      inject: (): ModeTabsInjected => ({
        hooks: { modeSeat: seat.store },
        load: () => seat.load(),
        pick,
      }),
    }, ModeTabs)
    return () => { modes() }
  })
}
