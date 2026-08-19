// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { DeepTariffSpendProjection } from '@deepseek-ai/dsh-deep-tariff/client'
import { TariffDock, formatLine, formatTooltip } from '../src/client/TariffDock.tsx'
import type { TariffDirectoryState } from '../src/client/slots.ts'
import { en } from '../src/client/locales.ts'
import {
  DEEPSEEK_OFFICIAL_PROVIDER,
  DEEPSEEK_V4_FLASH,
  resolveTariff,
} from '@deepseek-ai/dsh-deep-tariff/schedule'

vi.mock('@deepseek-ai/dsh-deep-tariff/schedule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepseek-ai/dsh-deep-tariff/schedule')>()
  return {
    ...actual,
    detectTimeZone: () => 'Asia/Shanghai',
  }
})

const t: Parameters<typeof TariffDock>[0]['t'] = makeTranslate(en, commonEn)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
})

function store(current: TariffDirectoryState['current']) {
  return createSnapshotStore<TariffDirectoryState>({ current })
}

function useSpend(spend?: DeepTariffSpendProjection): UseProjection {
  return ((key: string) => key === 'deepTariffSpend' ? spend : undefined) as UseProjection
}

const noSpend = useSpend()

const billed: DeepTariffSpendProjection = {
  uncachedInputTokens: 12_200,
  cacheReadTokens: 800,
  outputTokens: 1_100,
  usd: 0.041228,
}

describe('TariffDock', () => {
  it('renders nothing without a selection or on a non-DeepSeek route', () => {
    const load = vi.fn()
    const missing = render(<TariffDock directory={store(null)} load={load} t={t} useProjection={noSpend} />)
    expect(load).toHaveBeenCalledTimes(1)
    expect(missing.container.querySelector('[data-deep-tariff]')).toBeNull()
    cleanup()

    const other = render(
      <TariffDock
        directory={store({ provider: 'openai', model: 'gpt-4' })}
        load={load}
        t={t}
        useProjection={noSpend}
      />,
    )
    expect(other.container.querySelector('[data-deep-tariff]')).toBeNull()
  })

  it('shows off-peak Flash rates and a countdown in the browser zone', () => {
    render(
      <TariffDock
        directory={store({ provider: DEEPSEEK_OFFICIAL_PROVIDER, model: DEEPSEEK_V4_FLASH })}
        load={() => {}}
        t={t}
        useProjection={noSpend}
      />,
    )
    const strip = screen.getByLabelText(/DeepSeek tariff/)
    expect(strip.getAttribute('data-window')).toBe('off-peak')
    expect(strip.getAttribute('data-model')).toBe(DEEPSEEK_V4_FLASH)
    expect(strip.textContent).toContain('Off-peak')
    expect(strip.textContent).toContain('until peak')
    expect(strip.textContent).toContain('Flash')
    expect(strip.textContent).toContain('$0.22')
    expect(strip.textContent).toContain('$0.66')
  })

  it('advances the countdown on the one-second timer and on visibility', () => {
    render(
      <TariffDock
        directory={store({ provider: DEEPSEEK_OFFICIAL_PROVIDER, model: DEEPSEEK_V4_FLASH })}
        load={() => {}}
        t={t}
        useProjection={noSpend}
      />,
    )
    const before = screen.getByLabelText(/DeepSeek tariff/).textContent
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const afterTick = screen.getByLabelText(/DeepSeek tariff/).textContent
    expect(afterTick).not.toBe(before)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByLabelText(/DeepSeek tariff/).textContent).toContain('Off-peak')
  })
})

describe('formatLine / formatTooltip', () => {
  it('composes the English line and tooltip from a snapshot', () => {
    const snapshot = resolveTariff({
      now: new Date('2026-08-19T12:00:00.000Z'),
      timeZone: 'Asia/Shanghai',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })
    expect(snapshot).not.toBeNull()
    const line = formatLine(snapshot!, new Date('2026-08-19T12:00:00.000Z'), t)
    expect(line).toContain('Off-peak')
    expect(line).toContain('13h 0m until peak')
    expect(line).toContain('Flash $0.22 / $0.66')
    const tip = formatTooltip(snapshot!, t)
    expect(tip).toContain('Asia/Shanghai')
    expect(tip).toContain('09:00–12:00')
    expect(tip).toContain('$0.007')
  })

  it('prints an unknown model id verbatim', () => {
    const snapshot = resolveTariff({
      now: new Date('2026-08-19T02:00:00.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })!
    const custom = { ...snapshot, model: 'private-reasoner' }
    expect(formatLine(custom, new Date('2026-08-19T02:00:00.000Z'), t)).toContain('private-reasoner')
  })

  it('uses minute and second remaining copy near a window flip', () => {
    const snapshot = resolveTariff({
      now: new Date('2026-08-19T03:58:20.000Z'),
      timeZone: 'UTC',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })!
    expect(formatLine(snapshot, new Date('2026-08-19T03:58:20.000Z'), t))
      .toContain('1m 40s until off-peak')
    expect(formatLine(snapshot, new Date('2026-08-19T03:59:50.000Z'), t))
      .toContain('10s until off-peak')
  })

  it('appends this session\'s tokens and spend when the projection has usage', () => {
    const snapshot = resolveTariff({
      now: new Date('2026-08-19T12:00:00.000Z'),
      timeZone: 'Asia/Shanghai',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_FLASH,
    })!
    const line = formatLine(snapshot, new Date('2026-08-19T12:00:00.000Z'), t, billed)
    expect(line).toContain('13K in')
    expect(line).toContain('1.1K out')
    expect(line).toContain('$0.0412')
    expect(formatTooltip(snapshot, t, billed)).toContain('This session:')
  })
})
