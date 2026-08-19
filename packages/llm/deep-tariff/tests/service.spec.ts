import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import DeepTariff, { DEEPSEEK_OFFICIAL_PROVIDER, DEEPSEEK_V4_FLASH } from '../src/index.ts'

const PEAK = new Date('2026-08-19T02:00:00.000Z')

describe('DeepTariff service', () => {
  it('registers ctx.deepTariff and resolves the official table', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(DeepTariff)
    const snapshot = ctx.deepTariff.resolve({
      now: PEAK,
      timeZone: 'Asia/Shanghai',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(snapshot?.window).toBe('peak')
    expect(snapshot?.rates.cacheMiss).toBe(0.44)
    expect(snapshot?.localPeakWindows[0]).toEqual({ start: '09:00', end: '12:00' })
    await fiber.dispose()
    expect(ctx.get('deepTariff')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('applies config overrides and hides routes off the table', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(DeepTariff, {
      provider: 'deepseek-official',
      peakWindows: [{ start: '00:00', end: '01:00' }],
      models: {
        'deepseek-v4-flash': {
          peak: { cacheHit: 1, cacheMiss: 2, output: 3 },
          offPeak: { cacheHit: 0.1, cacheMiss: 0.2, output: 0.3 },
        },
      },
    })
    const snapshot = ctx.deepTariff.resolve({
      now: new Date('2026-08-19T00:30:00.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(snapshot?.window).toBe('peak')
    expect(snapshot?.rates).toEqual({ cacheHit: 1, cacheMiss: 2, output: 3 })
    expect(ctx.deepTariff.resolve({
      now: PEAK,
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: 'deepseek-v4-pro',
    })).toBeNull()
    await fiber.dispose()
    await ctx.fiber.dispose()
  })
})
