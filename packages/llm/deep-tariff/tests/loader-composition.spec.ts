import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import DeepTariff, { DEEPSEEK_OFFICIAL_PROVIDER, DEEPSEEK_V4_PRO } from '../src/index.ts'
import * as plugin from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('deep-tariff loader composition', () => {
  it('is a default-exported service plugin (not a mixed function plugin)', () => {
    expect(plugin.default).toBe(DeepTariff)
    expect('apply' in plugin).toBe(false)
  })

  it('boots from a test-only cordis.yml and resolves a Pro off-peak snapshot', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-deep-tariff-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- id: deep-tariff',
      "  name: '@deepseek-ai/dsh-deep-tariff'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-deep-tariff', plugin],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    const snapshot = context.deepTariff.resolve({
      now: new Date('2026-08-19T12:00:00.000Z'),
      timeZone: 'Europe/London',
      provider: DEEPSEEK_OFFICIAL_PROVIDER,
      model: DEEPSEEK_V4_PRO,
    })
    expect(snapshot?.window).toBe('off-peak')
    expect(snapshot?.rates.output).toBe(1.98)
  })
})
