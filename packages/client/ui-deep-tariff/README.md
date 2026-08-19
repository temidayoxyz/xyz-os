# @deepseek-ai/dsh-client-ui-deep-tariff

English | [中文](README.zh.md)

Browser half of DeepSeek tariff: a one-line readout on `conversation.composer.dock` (under the composer card, after the stats line) that shows the current official peak or off-peak window, a countdown to the next flip, and the selected model's cache-miss / output USD rates.

The chip hides unless the session's selected route is `deepseek-official` plus a model on the official table (`deepseek-v4-flash` or `deepseek-v4-pro`). After the first billed DeepSeek sample it also shows this session's input/output tokens and USD spend (`deepTariffSpend`), priced at each request's UTC window. The browser IANA zone (`Intl.DateTimeFormat`) converts the UTC windows; copy lives in this package's `deepTariff` locale namespace (`zh` / `en`).

The schedule is [`@deepseek-ai/dsh-deep-tariff/schedule`](../../llm/deep-tariff/README.md). The same module runs in the host service, so the desktop webview (same UI over the same engine) does not need a second clock.

## Model Experience

None, as this package renders a billing-window readout for a human and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The chip does not delay or queue sends** — it is a readout. Scheduling work into off-peak is a separate policy.
- **Rates follow the host table defaults** — a cordis.yml override of `ctx.deepTariff` is not streamed to this chip; both sides ship the official table unless a later Remote carries live config.
