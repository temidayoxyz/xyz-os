# @deepseek-ai/dsh-deep-tariff

English | [中文](README.zh.md)

DeepSeek official-API tariff resolver through the singleton `ctx.deepTariff` service. It classifies one instant as peak or off-peak against the published UTC windows, returns the matching USD rates for a DeepSeek model, and projects those windows into a caller-supplied IANA time zone. The schedule module (`./schedule`) is isomorphic — no Node, DOM, or Cordis — so the Web chip and a later desktop webview share one implementation.

Peak hours are **always UTC**: `01:00–04:00` and `06:00–10:00`. Off-peak is every other instant, at half the peak rates. The user's zone is a display conversion, never the authority.

## Configuration

```yaml
- id: deep-tariff
  name: '@deepseek-ai/dsh-deep-tariff'
  config:
    provider: deepseek-official
    peakWindows:
      - { start: '01:00', end: '04:00' }
      - { start: '06:00', end: '10:00' }
    models:
      deepseek-v4-flash:
        offPeak: { cacheHit: 0.007, cacheMiss: 0.22, output: 0.66 }
        peak: { cacheHit: 0.014, cacheMiss: 0.44, output: 1.32 }
      deepseek-v4-pro:
        offPeak: { cacheHit: 0.022, cacheMiss: 0.66, output: 1.98 }
        peak: { cacheHit: 0.044, cacheMiss: 1.32, output: 3.96 }
```

Every field is optional. Omission uses the official table published 2026-08-16. Invalid clocks, inverted or overlapping windows, an empty provider, or a negative rate fail plugin load.

`ctx.deepTariff.resolve({ now, timeZone, provider, model })` returns a snapshot or `null`. `null` means the selected route is not on this table — typically a non-DeepSeek provider or an unlisted model — and consumers hide themselves.

When `ctx.sessionProjections` is mounted, the plugin also registers `deepTariffSpend`: this session's DeepSeek billed tokens (cache miss, cache hit, output) and USD, each sample priced at the UTC window and model of that request — not the window currently on screen.

## Composition

The base bundle mounts this row so every profile, including the desktop engine, has the same resolver. The browser chip is [`@deepseek-ai/dsh-client-ui-deep-tariff`](../../client/ui-deep-tariff/README.md).

## Model Experience

None, as this resolver classifies billing windows for host and UI consumers and adds no prompt, message, schema, tool, or model call.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The official table is baked as defaults** — DeepSeek can change published prices; update `Config` (or this package's defaults) rather than the adapter.
- **Windows do not wrap UTC midnight in one entry** — a wrap needs two half-open windows. The official table does not wrap.
