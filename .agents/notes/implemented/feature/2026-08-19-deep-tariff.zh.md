# Agent Note: DeepSeek 官方计费条

Status: implemented

[English](2026-08-19-deep-tariff.md) | 中文

## Problem

DeepSeek 官方 API 对 `deepseek-v4-flash` 与 `deepseek-v4-pro` 按两个 UTC 窗口计费：高峰（UTC `01:00–04:00` 与 `06:00–10:00`）为全价，非高峰为半价。各语言、各时区的用户仍会从输入框发送，却看不到当前处于哪个窗口、何时切换、所选模型单价是多少。这是墙上时钟事实，不是会话事件，不属于 `token-meter`、`time-context` 或 DeepSeek 适配器。

## Decision

一套仅针对 DeepSeek 的能力，两个包共用一份同构日程：

- [`@deepseek-ai/dsh-deep-tariff`](../../../../packages/llm/deep-tariff/README.md) 拥有 `ctx.deepTariff` 与官方价表。UTC 是唯一判定依据。`resolve({ now, timeZone, provider, model })` 返回窗口、单价、下一次切换，以及高峰窗口的本地时钟副本；不在本表上则返回 `null`。
- [`@deepseek-ai/dsh-client-ui-deep-tariff`](../../../../packages/client/ui-deep-tariff/README.md) 读取会话模型目录，采样 `Intl.DateTimeFormat().resolvedOptions().timeZone`，并在 `conversation.composer.dock`（输入框下方、统计行之后）注册一条。它在本地对 `nextTransitionAt` 倒计时。出现第一笔 DeepSeek 计费样本后还会显示本会话的 token 与美元（`deepTariffSpend`），每一笔按该次请求当时的 UTC 窗口和模型计价。文案走 `deepTariff` 的 `{zh,en}` 命名空间。

浏览器打包只内联 `@deepseek-ai/dsh-deep-tariff/schedule`，不内联服务，因此条与宿主解析器不会分叉。日后的桌面端复用两半：引擎已通过 `dsh-base` 挂载宿主行，Tauri webview 就是同一套 Web UI。

费率和 UTC 窗口是带官方默认值的 `Config`，因此日后 DeepSeek 改价只需改配置。

## Alternatives considered

- **改 `dsh-llm-deepseek`** — 否决，因为适配器拥有的是线路格式，不是计费窗口。
- **改 `dsh-token-meter`** — 否决，因为计量器为所有提供方计 token，不讲美元或厂商窗口。
- **改 `dsh-time-context`** — 否决，因为该插件把时钟注入模型提示；计费是给人看的读数。
- **在 `api-remotes` 新增 Remote** — 否决，因为 1 秒倒计时不需要往返，独立安装方也不该去改 BFF。
- **侧栏页脚或会话标题** — 否决，那些座位是导航和身份。输入框下方的 dock 才是用户即将付费发送的环境读数。
- **自动把回合拖到非高峰** — 否决；那是策略，不是检测。

## Verification

单元测试钉住 UTC 半开窗口、跨午夜的下一次切换、Asia/Shanghai 与 America/New_York（EDT 与 EST）本地时钟、非法时区，以及配置覆盖。Loader 组合测试从仅用于测试的 `cordis.yml` 启动宿主插件。客户端测试钉住非 DeepSeek 时隐藏、英文行与 tooltip、倒计时跳动、可见性追赶、dock 条目的 HMR 卸载，以及 zh/en 键一致。客户端打包纯度闸门只允许 `/schedule` 子路径。

## Consequences

- Web 与桌面显示同一 DeepSeek 窗口，不需要第二套时钟。
- 非 DeepSeek 路由不渲染任何内容。
- cordis.yml 对宿主价表的覆盖目前不会传到这条；两侧都使用官方默认值，直到日后有 Remote 携带实时配置。
