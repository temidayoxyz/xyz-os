# @deepseek-ai/dsh-client-ui-deep-tariff

[English](README.md) | 中文

DeepSeek 计费条的浏览器半侧：挂在 `conversation.composer.dock`（输入框下方、统计行之后）的一行读数，显示当前官方高峰或非高峰窗口、到下一次切换的倒计时，以及所选模型的未命中输入 / 输出美元单价。

仅当会话所选路由是 `deepseek-official` 且模型在官方价表上（`deepseek-v4-flash` 或 `deepseek-v4-pro`）时才显示。出现第一笔 DeepSeek 计费样本后，还会显示本会话的输入/输出 token 与美元花费（`deepTariffSpend`），按每次请求当时的 UTC 窗口计价。浏览器 IANA 时区（`Intl.DateTimeFormat`）负责把 UTC 窗口换算到本地；文案走本包的 `deepTariff` 语言命名空间（`zh` / `en`）。

日程来自 [`@deepseek-ai/dsh-deep-tariff/schedule`](../../llm/deep-tariff/README.md)。同一模块也跑在宿主服务里，因此桌面 webview（同一套 UI 叠在同一引擎上）不需要第二套时钟。

## Model Experience

None, as this package renders a billing-window readout for a human and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **该条不推迟或排队发送** — 它只是读数。把工作排到非高峰是另一项策略。
- **费率跟随宿主价表默认值** — cordis.yml 对 `ctx.deepTariff` 的覆盖不会传到这条；除非日后有 Remote 携带实时配置，两侧都使用官方价表。
