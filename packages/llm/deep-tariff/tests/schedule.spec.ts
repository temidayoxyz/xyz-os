import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalizeTimeZone,
  DEFAULT_TARIFF_TABLE,
  DEEPSEEK_OFFICIAL_PROVIDER,
  DEEPSEEK_V4_FLASH,
  DEEPSEEK_V4_PRO,
  detectTimeZone,
  formatHm,
  parseClockToMinutes,
  priceUsage,
  remainingParts,
  resolveTariff,
  validateTariffTable,
} from '../src/schedule.ts'

const PEAK = new Date('2026-08-19T02:30:00.000Z')
const OFF_PEAK = new Date('2026-08-19T12:00:00.000Z')
const GAP = new Date('2026-08-19T05:00:00.000Z')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('parseClockToMinutes', () => {
  it('parses a 24-hour clock', () => {
    expect(parseClockToMinutes('00:00', 'start')).toBe(0)
    expect(parseClockToMinutes('01:00', 'start')).toBe(60)
    expect(parseClockToMinutes('23:59', 'end')).toBe(23 * 60 + 59)
  })

  it('rejects a non-clock string', () => {
    expect(() => parseClockToMinutes('1:00', 'start')).toThrow(/HH:mm/)
    expect(() => parseClockToMinutes('24:00', 'end')).toThrow(/HH:mm/)
  })
})

describe('canonicalizeTimeZone / detectTimeZone', () => {
  it('accepts UTC and canonical IANA zones', () => {
    expect(canonicalizeTimeZone('UTC')).toBe('UTC')
    expect(canonicalizeTimeZone('Asia/Shanghai')).toBe('Asia/Shanghai')
  })

  it('rejects an identifier Intl does not accept', () => {
    expect(() => canonicalizeTimeZone('Not/A_Zone')).toThrow(/unsupported IANA time zone/)
  })

  it('reads the environment zone, falling back to UTC when Intl throws', () => {
    expect(typeof detectTimeZone()).toBe('string')
    function BrokenDateTimeFormat(): never {
      throw new RangeError('no zone')
    }
    vi.stubGlobal('Intl', { DateTimeFormat: BrokenDateTimeFormat })
    expect(detectTimeZone()).toBe('UTC')
  })
})

describe('priceUsage', () => {
  it('prices disjoint buckets per 1M tokens', () => {
    expect(priceUsage(
      { uncachedInputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 },
      { cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 },
    )).toBe(0.22)
    expect(priceUsage(
      { uncachedInputTokens: 0, cacheReadTokens: 1_000_000, outputTokens: 500_000 },
      { cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 },
    )).toBeCloseTo(0.007 + 0.33)
  })
})

describe('remainingParts', () => {
  it('splits a remainder and clamps negatives', () => {
    expect(remainingParts(3_662_000)).toEqual({ hours: 1, minutes: 1, seconds: 2 })
    expect(remainingParts(-50)).toEqual({ hours: 0, minutes: 0, seconds: 0 })
    expect(remainingParts(500)).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('resolveTariff', () => {
  it('returns null for a non-DeepSeek provider or unknown model', () => {
    expect(resolveTariff({
      now: PEAK, timeZone: 'UTC', provider: 'openai', model: DEEPSEEK_V4_FLASH,
    })).toBeNull()
    expect(resolveTariff({
      now: PEAK, timeZone: 'UTC', provider: DEEPSEEK_OFFICIAL_PROVIDER, model: 'gpt-4',
    })).toBeNull()
  })

  it('classifies official UTC peak and off-peak windows as half-open', () => {
    const atStart = resolveTariff({
      now: new Date('2026-08-19T01:00:00.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(atStart?.window).toBe('peak')
    expect(atStart?.rates.cacheMiss).toBe(0.44)
    expect(atStart?.nextWindow).toBe('off-peak')
    expect(atStart?.nextTransitionAt.toISOString()).toBe('2026-08-19T04:00:00.000Z')

    const atEnd = resolveTariff({
      now: new Date('2026-08-19T04:00:00.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(atEnd?.window).toBe('off-peak')
    expect(atEnd?.nextWindow).toBe('peak')
    expect(atEnd?.nextTransitionAt.toISOString()).toBe('2026-08-19T06:00:00.000Z')

    const afterLast = resolveTariff({
      now: new Date('2026-08-19T10:00:00.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_PRO,
    })
    expect(afterLast?.window).toBe('off-peak')
    expect(afterLast?.rates.output).toBe(1.98)
    expect(afterLast?.nextTransitionAt.toISOString()).toBe('2026-08-20T01:00:00.000Z')
    expect(afterLast?.nextWindow).toBe('peak')
  })

  it('projects UTC peak windows into Asia/Shanghai and America/New_York', () => {
    const shanghai = resolveTariff({
      now: OFF_PEAK,
      timeZone: 'Asia/Shanghai',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(shanghai?.localPeakWindows).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ])

    const summer = resolveTariff({
      now: new Date('2026-08-19T12:00:00.000Z'),
      timeZone: 'America/New_York',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(summer?.localPeakWindows).toEqual([
      { start: '21:00', end: '00:00' },
      { start: '02:00', end: '06:00' },
    ])

    const winter = resolveTariff({
      now: new Date('2026-01-15T12:00:00.000Z'),
      timeZone: 'America/New_York',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(winter?.localPeakWindows).toEqual([
      { start: '20:00', end: '23:00' },
      { start: '01:00', end: '05:00' },
    ])
  })

  it('uses Date.now when the request omits now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(GAP)
    try {
      const snapshot = resolveTariff({
        timeZone: 'UTC',
        provider: DEEPSEEK_OFFICIAL_PROVIDER,
        model: DEEPSEEK_V4_FLASH,
      })
      expect(snapshot?.window).toBe('off-peak')
      expect(snapshot?.nextTransitionAt.toISOString()).toBe('2026-08-19T06:00:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('validateTariffTable', () => {
  it('accepts the official table', () => {
    expect(validateTariffTable(DEFAULT_TARIFF_TABLE)).toBe(DEFAULT_TARIFF_TABLE)
  })

  it('rejects empty provider, windows, models, and overlapping or inverted windows', () => {
    expect(() => validateTariffTable({ ...DEFAULT_TARIFF_TABLE, provider: '' }))
      .toThrow(/provider must be a non-empty string/)
    expect(() => validateTariffTable({ ...DEFAULT_TARIFF_TABLE, peakWindows: [] }))
      .toThrow(/at least one peak window/)
    expect(() => validateTariffTable({ ...DEFAULT_TARIFF_TABLE, models: {} }))
      .toThrow(/at least one model rate card/)
    expect(() => validateTariffTable({
      ...DEFAULT_TARIFF_TABLE,
      models: { '': DEFAULT_TARIFF_TABLE.models[DEEPSEEK_V4_FLASH]! },
    })).toThrow(/model ids must be non-empty/)
    expect(() => validateTariffTable({
      ...DEFAULT_TARIFF_TABLE,
      peakWindows: [{ start: '04:00', end: '01:00' }],
    })).toThrow(/must end after it starts/)
    expect(() => validateTariffTable({
      ...DEFAULT_TARIFF_TABLE,
      peakWindows: [{ start: '01:00', end: '06:00' }, { start: '04:00', end: '08:00' }],
    })).toThrow(/must not overlap/)
    expect(() => validateTariffTable({
      ...DEFAULT_TARIFF_TABLE,
      models: {
        [DEEPSEEK_V4_FLASH]: {
          peak: { cacheHit: -1, cacheMiss: 1, output: 1 },
          offPeak: { cacheHit: 0, cacheMiss: 1, output: 1 },
        },
      },
    })).toThrow(/non-negative finite number/)
  })
})

describe('formatHm', () => {
  it('formats a 24-hour clock in the requested zone', () => {
    expect(formatHm(new Date('2026-08-19T01:00:00.000Z'), 'UTC')).toBe('01:00')
    expect(formatHm(new Date('2026-08-19T01:00:00.000Z'), 'Asia/Shanghai')).toBe('09:00')
  })

  it('throws when Intl omits hour or minute parts', () => {
    // vitest 4 forbids `mockReturnValue` on constructor calls; a plain
    // function that returns the stub works for `new` (the returned object
    // wins over the constructed instance).
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function () {
        return { formatToParts: () => [] }
      } as unknown as typeof Intl.DateTimeFormat,
    )
    expect(() => formatHm(new Date('2026-08-19T01:00:00.000Z'), 'UTC'))
      .toThrow(/could not format a local clock/)
  })
})
