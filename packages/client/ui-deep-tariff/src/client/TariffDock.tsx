/**
 * DeepSeek tariff readout under the composer card. Hidden unless the
 * selected route is on the official DeepSeek table. The countdown is local
 * state ticking once a second against a host-shared UTC schedule.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { DeepTariffSpendProjection } from '@deepseek-ai/dsh-deep-tariff/client'
import { detectTimeZone, formatHm, resolveTariff, type TariffSnapshot } from '@deepseek-ai/dsh-deep-tariff/schedule'
import type { TariffDockInjected } from './slots.ts'
import {
  formatTokens,
  formatUsd,
  formatUsdSpend,
  modelLabelKey,
  nextKey,
  remainingKey,
  remainingOf,
  windowKey,
} from './format.ts'
import css from './TariffDock.module.css'

export type TariffDockProps =
  TariffDockInjected
  & PropsLocale<'deepTariff'>
  & {
    /** Session projection reader; `deepTariffSpend` is this session's priced usage. */
    useProjection: UseProjection
  }

/**
 * Composer-dock tariff chip.
 * @param props - directory store, load verb, and the locale seat.
 * @returns the strip, or null when the selected route is not DeepSeek.
 */
export function TariffDock({ directory, load, t, useProjection }: TariffDockProps) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getSnapshot)
  const spend = useProjection('deepTariffSpend')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const tick = (): void => {
      setNow(Date.now())
    }
    const id = window.setInterval(tick, 1000)
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const current = state.current
  const snapshot = current === null
    ? null
    : resolveTariff({
      now: new Date(now),
      timeZone: detectTimeZone(),
      provider: current.provider,
      model: current.model,
    })

  if (snapshot === null) return null
  const line = formatLine(snapshot, new Date(now), t, spend)
  const tip = formatTooltip(snapshot, t, spend)

  return (
    <Tooltip label={tip} side="top" delayMs={500}>
      <div
        className={css.root}
        data-deep-tariff
        data-window={snapshot.window}
        data-model={snapshot.model}
        aria-label={t('strip.aria', { summary: line })}
      >
        {line}
      </div>
    </Tooltip>
  )
}

/**
 * Compose the visible one-line readout.
 * @param snapshot - Resolved tariff.
 * @param now - Instant used for the countdown.
 * @param t - Locale seat.
 * @returns Window, countdown, model, and cache-miss / output rates.
 */
export function formatLine(
  snapshot: TariffSnapshot,
  now: Date,
  t: TariffDockProps['t'],
  spend?: DeepTariffSpendProjection,
): string {
  const parts = remainingOf(snapshot, now)
  const remaining = t(remainingKey(parts), {
    hours: parts.hours,
    minutes: parts.minutes,
    seconds: parts.seconds,
    next: t(nextKey(snapshot.nextWindow)),
  })
  const modelKey = modelLabelKey(snapshot.model)
  const model = modelKey === null ? snapshot.model : t(modelKey)
  const rates = t('rates', {
    input: formatUsd(snapshot.rates.cacheMiss),
    output: formatUsd(snapshot.rates.output),
  })
  const segments = [`${t(windowKey(snapshot.window))}`, remaining, `${model} ${rates}`]
  if (spend !== undefined && hasSpend(spend)) {
    segments.push(t('session.tokens', {
      input: formatTokens(spend.uncachedInputTokens + spend.cacheReadTokens),
      output: formatTokens(spend.outputTokens),
    }))
    segments.push(formatUsdSpend(spend.usd))
  }
  return segments.join(' · ')
}

/**
 * Compose the hover details: local peak hours, all three rates, next flip.
 * @param snapshot - Resolved tariff.
 * @param t - Locale seat.
 * @returns Multiline tooltip text.
 */
export function formatTooltip(
  snapshot: TariffSnapshot,
  t: TariffDockProps['t'],
  spend?: DeepTariffSpendProjection,
): string {
  const windows = snapshot.localPeakWindows
    .map(window => `${window.start}–${window.end}`)
    .join(t('windows.sep'))
  const hours = t('tooltip.hours', { zone: snapshot.timeZone, windows })
  const rates = t('tooltip.rates', {
    cacheHit: formatUsd(snapshot.rates.cacheHit),
    cacheMiss: formatUsd(snapshot.rates.cacheMiss),
    output: formatUsd(snapshot.rates.output),
  })
  const next = t('tooltip.next', {
    next: t(nextKey(snapshot.nextWindow)),
    time: formatHm(snapshot.nextTransitionAt, snapshot.timeZone),
  })
  const lines = [hours, rates, next]
  if (spend !== undefined && hasSpend(spend)) {
    lines.push(t('tooltip.session', {
      miss: formatTokens(spend.uncachedInputTokens),
      hit: formatTokens(spend.cacheReadTokens),
      output: formatTokens(spend.outputTokens),
      usd: formatUsdSpend(spend.usd),
    }))
  }
  return lines.join('\n')
}

function hasSpend(spend: DeepTariffSpendProjection): boolean {
  return spend.uncachedInputTokens > 0 || spend.cacheReadTokens > 0 || spend.outputTokens > 0
}
