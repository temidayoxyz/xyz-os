/**
 * Self-contained mode seat: the roster and the staged choice for the NEXT
 * session, owned entirely by the mode switch.
 *
 * This mirrors the hero chip's seat semantics (stage → apply to the blank
 * session that becomes current) but shares nothing with it: the chip and the
 * tabs converge through the session list and the host's agentPreset state,
 * not through a shared controller instance. Deliberate: a cross-plugin
 * service dependency proved fragile in the browser loader, and this package
 * must render or fail loudly on its own.
 */

import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type SessionId, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Mode-switch snapshot. */
export interface ModeSeatState {
  /** Healthy preset roster; empty until the first load settles. */
  options: readonly { id: string }[]
  /** The staged/current preset id, empty until the roster loads. */
  current: string
  busy: boolean
  error: string | null
}

const INITIAL: ModeSeatState = { options: [], current: '', busy: false, error: null }

/** One session's identity and whether it has started. */
export interface ModeSessionSummary {
  id: SessionId
  /** False once a turn has run — applying is refused from then on. */
  blank: boolean
  /** The preset the session already runs, when known. */
  agentPreset?: string
}

/**
 * Stages the next session's preset and applies it when a blank session
 * appears. The registrar wires the sessions-list subscription; the
 * controller only holds the state machine.
 */
export class ModeSeatController {
  /** Switch snapshot the renderer subscribes to. */
  readonly store: SnapshotStore<ModeSeatState> = createSnapshotStore(INITIAL)

  /** The deployment default, so a consumed stage can fall back to it. */
  private fallback = ''

  /** Set while a pick is waiting for a session; cleared once applied. */
  private staged: string | undefined

  constructor(
    private readonly api: Pick<IApiClient, 'agentPresets'>,
    /** The session the switch is about to hand over to, when there is one. */
    private readonly currentSession: () => ModeSessionSummary | undefined,
    /** Publish an applied switch into the session list (idempotent). */
    private readonly onApplied?: (sessionId: string, agentPreset: string) => void,
  ) {}

  private set(patch: Partial<ModeSeatState>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch })
  }

  /** Read the roster and open the switch on the deployment default. */
  async load(): Promise<void> {
    try {
      const response = await this.api.agentPresets.list({})
      if (!response.result.ok) {
        this.set({ error: response.result.error.message })
        return
      }
      const { presets } = response.result.value
      this.fallback = presets.find(preset => preset.isDefault)?.id ?? presets[0]?.id ?? ''
      this.set({
        options: presets
          .filter(preset => preset.broken === undefined)
          .map(preset => ({ id: preset.id })),
        // Staged pick first, then the current session's composition, then
        // the default — a late load must not regress an applied stage.
        current: this.staged ?? this.currentSession()?.agentPreset ?? this.fallback,
        error: null,
      })
    } catch (error) {
      this.set({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * Stage one preset for the next session, applying it immediately when a
   * blank session is already current.
   */
  async select(id: string): Promise<void> {
    if (this.store.getSnapshot().busy) return
    this.stage(id)
    await this.apply()
  }

  /** Stage a pick WITHOUT the immediate apply (a new session will take it). */
  stage(id: string): void {
    this.staged = id
    this.set({ current: id, error: null })
  }

  /**
   * Hand the staged choice to the current session, if there is one to take
   * it. Called by select() and by the registrar's sessions subscription.
   */
  async apply(): Promise<void> {
    const staged = this.staged
    const session = this.currentSession()
    if (staged === undefined || session === undefined) return
    // A started session's history was produced under its own composition;
    // the host refuses the swap, so the stage is no longer meaningful.
    if (!session.blank || session.agentPreset === staged) {
      this.staged = undefined
      return
    }
    this.set({ busy: true, error: null })
    try {
      const response = await this.api.agentPresets.select({ sessionId: session.id, agentPreset: staged })
      this.staged = undefined
      if (!response.result.ok) {
        this.set({ busy: false, error: response.result.error.message, current: this.fallback })
        return
      }
      // Consumed: the next new session opens on the deployment default again.
      this.set({ busy: false, current: response.result.value.agentPreset })
      this.onApplied?.(session.id, response.result.value.agentPreset)
    } catch (error) {
      this.staged = undefined
      this.set({ busy: false, error: error instanceof Error ? error.message : String(error), current: this.fallback })
    }
  }
}
