# @deepseek-ai/dsh-deep-tariff

[English](README.md) | 中文

通过单例 `ctx.deepTariff` 服务解析 DeepSeek 官方 API 的计费时段。它按已公布的 UTC 窗口将某一时刻判定为高峰或非高峰，返回对应 DeepSeek 模型的美元单价，并把这些窗口投影到调用方提供的 IANA 时区。日程模块（`./schedule`）是同构的——不依赖 Node、DOM 或 Cordis——因此 Web 条与日后的桌面 webview 共用一份实现。

高峰时段**始终以 UTC 为准**：`01:00–04:00` 与 `06:00–10:00`。其余时刻均为非高峰，价格为高峰的一半。用户时区只用于显示换算，不是判定依据。

## 配置

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

所有字段均可省略。省略时使用 2026-08-16 公布的官方价表。非法时钟、起止颠倒或重叠的窗口、空的 provider、或负数费率都会在插件加载时失败。

`ctx.deepTariff.resolve({ now, timeZone, provider, model })` 返回快照或 `null`。`null` 表示当前路由不在本表上——通常是非 DeepSeek 提供方或未列出的模型——消费方应自行隐藏。

当组合中挂载了 `ctx.sessionProjections` 时，本插件还会注册 `deepTariffSpend`：本会话的 DeepSeek 计费 token（未命中、命中、输出）与美元金额，每一笔都按该次请求当时的 UTC 窗口和模型计价，而不是按屏幕上当前窗口。

## 组合

base bundle 挂载此行，使每个 profile（包括桌面引擎）共用同一解析器。浏览器条是 [`@deepseek-ai/dsh-client-ui-deep-tariff`](../../client/ui-deep-tariff/README.zh.md)。

## Model Experience

None, as this resolver classifies billing windows for host and UI consumers and adds no prompt, message, schema, tool, or model call.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **官方价表作为默认值内置** — DeepSeek 可能调整公布价格；应更新 `Config`（或本包默认值），而不是改适配器。
- **单个窗口不能跨越 UTC 午夜** — 跨日需要两个半开窗口。官方价表不跨日。
