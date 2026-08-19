import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage } from '@deepseek-ai/dsh-llm'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import SessionStore, { canonicalHeader } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import DeepTariff, {
  DEEPSEEK_OFFICIAL_PROVIDER,
  DEEPSEEK_V4_FLASH,
  priceUsage,
} from '../src/index.ts'
import type { DeepTariffSpendProjection } from '../src/index.ts'

async function harness(): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(DeepTariff)
  return { ctx, session: ctx.sessions.create() }
}

function appendHeader(
  session: Session,
  provider: string,
  model: string,
  reason: 'initial' | 'change' = 'initial',
): void {
  session.append('request/header', {
    header: canonicalHeader({ config: { provider, model } }),
    reason,
  })
}

function appendUsage(session: Session, usage: TokenUsage, turn: number, step: number): void {
  const chunk = session.append('assistant/chunk', {
    turn,
    step,
    chunk: { type: 'usage', usage },
  })
  session.append('assistant/message', {
    turn,
    step,
    message: createMessage({
      role: 'assistant',
      content: [],
      source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    }),
    usage,
  }, { surfaceOp: 'append', sourceEventSeqs: [chunk.seq] })
}

function spendOf(ctx: Context, session: Session): DeepTariffSpendProjection {
  const value = ctx.sessionProjections.snapshot(session).values.deepTariffSpend
  if (value === undefined) throw new Error('deepTariffSpend is not registered')
  return value
}

describe('deepTariffSpend projection', () => {
  it('prices DeepSeek usage at the sample\'s UTC window and ignores other providers', async () => {
    const { ctx, session } = await harness()
    appendHeader(session, 'openai', 'gpt-4')
    appendUsage(session, { inputTokens: 1_000_000, outputTokens: 0 }, 1, 1)
    expect(spendOf(ctx, session)).toEqual({
      uncachedInputTokens: 0, cacheReadTokens: 0, outputTokens: 0, usd: 0,
    })

    appendHeader(session, DEEPSEEK_OFFICIAL_PROVIDER, DEEPSEEK_V4_FLASH, 'change')
    const offPeak = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0 }
    appendUsage(session, offPeak, 2, 1)
    const afterOffPeak = spendOf(ctx, session)
    expect(afterOffPeak.uncachedInputTokens).toBe(1_000_000)
    expect(afterOffPeak.usd).toBe(0.22)

    appendUsage(session, { inputTokens: 2_000_000, outputTokens: 0 }, 2, 1)
    expect(spendOf(ctx, session).uncachedInputTokens).toBe(2_000_000)
    expect(spendOf(ctx, session).usd).toBe(0.44)

    await ctx.fiber.dispose()
  })

  it('uses peak rates for a sample inside a UTC peak window', async () => {
    const { ctx, session } = await harness()
    appendHeader(session, DEEPSEEK_OFFICIAL_PROVIDER, DEEPSEEK_V4_FLASH)
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 }
    appendUsage(session, usage, 1, 1)
    const billed = spendOf(ctx, session)
    const at = new Date(session.events[session.events.length - 1]!.time)
    const window = at.getUTCHours() >= 1 && at.getUTCHours() < 4
      || at.getUTCHours() >= 6 && at.getUTCHours() < 10
      ? 'peak'
      : 'off-peak'
    const expected = priceUsage(
      { uncachedInputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 1_000_000 },
      window === 'peak'
        ? { cacheHit: 0.014, cacheMiss: 0.44, output: 1.32 }
        : { cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 },
    )
    expect(billed.usd).toBeCloseTo(expected)
    await ctx.fiber.dispose()
  })
})
