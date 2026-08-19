import { describe, expect, it } from 'vitest'
import {
  DEEPSEEK_OFFICIAL_PROVIDER,
  DEEPSEEK_V4_FLASH,
  resolveTariff,
} from '@deepseek-ai/dsh-deep-tariff/schedule'
import {
  formatTokens,
  formatUsd,
  formatUsdSpend,
  modelLabelKey,
  nextKey,
  remainingKey,
  remainingOf,
  windowKey,
} from '../src/client/format.ts'

describe('tariff display helpers', () => {
  it('formats USD with two decimals, or three under a cent', () => {
    expect(formatUsd(0.22)).toBe('$0.22')
    expect(formatUsd(1.32)).toBe('$1.32')
    expect(formatUsd(0.007)).toBe('$0.007')
    expect(formatUsd(1)).toBe('$1.00')
    expect(formatUsdSpend(0)).toBe('$0.00')
    expect(formatUsdSpend(1.32)).toBe('$1.32')
    expect(formatUsdSpend(0.041228)).toBe('$0.0412')
    expect(formatTokens(517)).toBe('517')
    expect(formatTokens(12_200)).toBe('12.2K')
    expect(formatTokens(1_200_000)).toBe('1.2M')
  })

  it('maps official model ids and windows onto locale keys', () => {
    expect(modelLabelKey('deepseek-v4-flash')).toBe('model.flash')
    expect(modelLabelKey('deepseek-v4-pro')).toBe('model.pro')
    expect(modelLabelKey('private-reasoner')).toBeNull()
    expect(windowKey('peak')).toBe('window.peak')
    expect(windowKey('off-peak')).toBe('window.offPeak')
    expect(nextKey('peak')).toBe('next.peak')
    expect(nextKey('off-peak')).toBe('next.offPeak')
    expect(remainingKey({ hours: 2, minutes: 1, seconds: 0 })).toBe('remaining.hm')
    expect(remainingKey({ hours: 0, minutes: 3, seconds: 4 })).toBe('remaining.ms')
    expect(remainingKey({ hours: 0, minutes: 0, seconds: 9 })).toBe('remaining.s')
  })

  it('splits remaining time from a snapshot', () => {
    const snapshot = resolveTariff({
      now: new Date('2026-08-19T03:00:00.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(snapshot).not.toBeNull()
    expect(remainingOf(snapshot!, new Date('2026-08-19T03:00:00.000Z')))
      .toEqual({ hours: 1, minutes: 0, seconds: 0 })
  })
})
