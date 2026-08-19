# Agent Note: DeepSeek official tariff chip

Status: implemented

English | [中文](2026-08-19-deep-tariff.zh.md)

## Problem

DeepSeek's official API bills `deepseek-v4-flash` and `deepseek-v4-pro` at two UTC windows: peak (`01:00–04:00` and `06:00–10:00` UTC) at full price, and off-peak at half. Users in every locale and time zone still send from the composer without seeing which window they are in, when it flips, or what the selected model costs. A wall-clock fact that is not a session event does not belong on `token-meter`, `time-context`, or the DeepSeek adapter.

## Decision

A DeepSeek-only capability with two packages shares one isomorphic schedule:

- [`@deepseek-ai/dsh-deep-tariff`](../../../../packages/llm/deep-tariff/README.md) owns `ctx.deepTariff` and the official table. UTC is the only authority. `resolve({ now, timeZone, provider, model })` returns the window, rates, next flip, and local-clock copies of the peak windows, or `null` off this table.
- [`@deepseek-ai/dsh-client-ui-deep-tariff`](../../../../packages/client/ui-deep-tariff/README.md) reads the session model directory, samples `Intl.DateTimeFormat().resolvedOptions().timeZone`, and registers a chip on `conversation.composer.dock` (under the composer, after stats). It counts down locally to `nextTransitionAt`. After the first billed DeepSeek sample it also shows this session's tokens and USD (`deepTariffSpend`), each sample priced at that request's UTC window and model. Copy is the `deepTariff` `{zh,en}` namespace.

The browser bundle inlines `@deepseek-ai/dsh-deep-tariff/schedule` only — not the service — so the chip and the host resolver cannot drift. Desktop later reuses both halves: the engine already mounts the host row via `dsh-base`, and the Tauri webview is the same Web UI.

Rates and UTC windows are `Config` with official defaults so a later DeepSeek price change is a config bump.

## Alternatives considered

- **Patch `dsh-llm-deepseek`** — rejected because the adapter owns the wire format, not billing windows.
- **Patch `dsh-token-meter`** — rejected because the meter counts tokens for every provider and does not speak USD or vendor windows.
- **Patch `dsh-time-context`** — rejected because that plugin injects a clock into the model prompt; billing is a human readout.
- **A new Remote in `api-remotes`** — rejected because a 1s countdown does not need a round trip, and a standalone installer should not have to patch the BFF.
- **Sidebar footer or session header** — rejected because those seats are navigation and identity. The composer dock is the ambient readout for the send the user is about to pay for.
- **Auto-delaying turns until off-peak** — rejected; that is policy, not detection.

## Verification

Unit tests pin UTC half-open windows, next-transition across midnight, Asia/Shanghai and America/New_York (EDT and EST) local clocks, invalid zones, and config overrides. A Loader composition boots the host plugin from a test-only `cordis.yml`. Client tests pin hide-on-non-DeepSeek, English line and tooltip, countdown ticks, visibility catch-up, HMR disposal of the dock entry, and zh/en key parity. The client-bundle purity gate allows only the `/schedule` subpath.

## Consequences

- Web and desktop show the same DeepSeek window without a second clock.
- Non-DeepSeek routes render nothing.
- A cordis.yml override of the host table does not currently stream to the chip; both sides ship the official defaults until a later Remote carries live config.
