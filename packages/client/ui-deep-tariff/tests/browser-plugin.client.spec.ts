/**
 * ui-deep-tariff plugin halves: dictionary and composer-dock registration
 * against the real SlotRegistry (fiber teardown proves removal), plus the
 * inert node entry and invariant companion.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as TariffInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

function dockEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots
    .entries('conversation.composer.dock')
    .map(entry => entry.options.id)
}

async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.composer.dock': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  ctx.provide('sessions', {})
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  ctx.provide('modelDirectories', {
    directoryFor: () => ({
      store: createSnapshotStore({ current: null }),
      load: () => Promise.resolve(),
    }),
  })
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

describe('ui-deep-tariff browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'modelDirectories'])
  })

  it('registers the dock chip, and fiber teardown removes it (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(dockEntryIds(ctx)).toContain('deep-tariff')
    await fiber.dispose()
    expect(dockEntryIds(ctx)).not.toContain('deep-tariff')
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('window.peak')).toBe(zh['window.peak'])
    ctx.locale.setLocale('en')
    expect(translate('window.peak')).toBe(en['window.peak'])
    await fiber.dispose()
    expect(translate('window.peak')).not.toBe(en['window.peak'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-deep-tariff node half', () => {
  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('ui-deep-tariff invariant companion', () => {
  it('registers its explained empty runtime invariant', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    const fiber = await ctx.plugin(TariffInvariant)
    expect(() => {
      ctx.invariants.register('@deepseek-ai/dsh-client-ui-deep-tariff', () => {})
    }).toThrow(/already registered/)
    await fiber.dispose()
    await ctx.fiber.dispose()
  })
})
