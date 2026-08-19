/**
 * Session spend projection: DeepSeek billed tokens priced at the UTC window
 * of each usage sample, not the window the user is looking at now.
 *
 * @module @deepseek-ai/dsh-deep-tariff/spend
 */

import { z } from 'zod'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { priceUsage, resolveTariff, type TariffTable, type UsageBuckets } from './schedule.ts'
import type { DeepTariffSpendProjection } from './types.ts'

export type { DeepTariffSpendProjection }

interface Sample {
  turn: number
  step: number
  buckets: UsageBuckets
  usd: number
}

interface SpendState {
  route: { provider: string; model: string } | null
  totals: DeepTariffSpendProjection
  last: Sample | null
}

const zero = (): DeepTariffSpendProjection => ({
  uncachedInputTokens: 0,
  cacheReadTokens: 0,
  outputTokens: 0,
  usd: 0,
})

const schema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  usd: z.number().nonnegative(),
}).strict()

const bucketsFrom = (usage: TokenUsage): UsageBuckets => ({
  uncachedInputTokens: usage.inputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  outputTokens: usage.outputTokens,
})

const bucketsEqual = (left: UsageBuckets, right: UsageBuckets): boolean =>
  left.uncachedInputTokens === right.uncachedInputTokens
  && left.cacheReadTokens === right.cacheReadTokens
  && left.outputTokens === right.outputTokens

const addReplacing = (
  totals: DeepTariffSpendProjection,
  previous: Sample | undefined,
  next: Sample,
): DeepTariffSpendProjection => ({
  uncachedInputTokens: totals.uncachedInputTokens
    - (previous?.buckets.uncachedInputTokens ?? 0) + next.buckets.uncachedInputTokens,
  cacheReadTokens: totals.cacheReadTokens
    - (previous?.buckets.cacheReadTokens ?? 0) + next.buckets.cacheReadTokens,
  outputTokens: totals.outputTokens
    - (previous?.buckets.outputTokens ?? 0) + next.buckets.outputTokens,
  usd: totals.usd - (previous?.usd ?? 0) + next.usd,
})

const usageOf = (event: SessionEvent): { turn: number; step: number; usage: TokenUsage } | undefined => {
  if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.chunk.usage }
  }
  if (event.type === 'assistant/message' && event.data.usage !== undefined) {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.usage }
  }
  return undefined
}

/**
 * Build the `deepTariffSpend` unit for one resolved rate table.
 * @param table - Official or config-overridden tariff.
 * @returns Projection definition registered on `ctx.sessionProjections`.
 */
export function deepTariffSpendProjection(
  table: TariffTable,
): ProjectionDefinition<'deepTariffSpend', SpendState> {
  return {
    key: 'deepTariffSpend',
    schema,
    stateVersion: 1,
    init: () => ({ route: null, totals: zero(), last: null }),
    view: state => state.totals,
    apply: (state, event) => {
      if (event.type === 'request/header') {
        const { provider, model } = event.data.header.config
        if (state.route?.provider === provider && state.route.model === model) return state
        return { ...state, route: { provider, model } }
      }
      const sample = usageOf(event)
      if (sample === undefined || state.route === null) return state
      const snapshot = resolveTariff({
        now: new Date(event.time),
        timeZone: 'UTC',
        provider: state.route.provider,
        model: state.route.model,
      }, table)
      if (snapshot === null) return state
      const buckets = bucketsFrom(sample.usage)
      const previous = state.last !== null
        && state.last.turn === sample.turn
        && state.last.step === sample.step
        ? state.last
        : undefined
      if (previous !== undefined && bucketsEqual(previous.buckets, buckets)) return state
      const next: Sample = {
        turn: sample.turn,
        step: sample.step,
        buckets,
        usd: priceUsage(buckets, snapshot.rates),
      }
      return {
        ...state,
        totals: addReplacing(state.totals, previous, next),
        last: next,
      }
    },
  }
}
