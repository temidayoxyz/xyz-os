# XYZ-OS

[English](README.md) | 中文

**XYZ-OS** 是一款个人 AI 操作系统：一个完全在你机器上运行的本地代理引擎，既能以原生桌面应用打开，也能以 Web UI 打开。它把五种专用模式——Coworker、Coder、Designer、Assistant 与 Creator——组合在同一个工作区、会话历史与工具集之上。

XYZ-OS 是 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的持续维护分支；后者是一个 MIT 许可、以插件为基础的代理引擎，一切都以插件形式存在。引擎、代理循环与工具链来自上游；XYZ-OS 增加了品牌、主题、Designer 模式与桌面发行版。

## 特性

- **一切本地运行。** 引擎、会话与数据都留在你的机器上；模型流量只发往你配置的服务商。
- **五种模式，一个工作区。** 开始会话时选择模式，它会为该任务装配合适的工具、技能与指令。
- **真实工具链。** 文件、shell、代码搜索、LSP、终端、子代理、工作流、计划、目标，以及按模式组合的网页搜索与抓取。
- **持久会话。** 会话采用事件溯源并保存在本地，标题、投影与历史在重启后仍然保留。
- **天生可扩展。** 新行为就是一个插件；运行时会挂载自己的插件，预设只是普通配置。
- **原生桌面。** 一个 Rust/Tauri 外壳携带引擎，在 Windows、macOS 与 Linux 上以桌面应用打开同一个 UI。
- **自带密钥。** 不捆绑任何 API 密钥或模型凭据；每个用户在 Models 页面配置自己的服务商。

## 模式

模式通过新会话屏幕上的预设芯片选择。正在运行的会话保留开始时的预设。预设位于 `apps/cli/config/agent-presets/`。

| 模式 | 预设 | 用途 |
|------|------|------|
| 💼 **Coworker** | `standard` | 文件、网页研究、计划、目标、子代理、工作流与办公工具 |
| 💻 **Coder** | `code` | Coworker 加上 Code Mode SDK——把多步编码操作组合为程序 |
| 🎨 **Designer** | `design` | 设计工作室循环：brief → 方向 → 产物 → 评审 → 交付，附技能包与持久的 `.design/` 记忆 |
| ✨ **Assistant** | `minimal` | 最轻量的助手：仅 shell 与文本编辑器 |
| 🧪 **Creator** | `cordis` | 借助运行时检查与插件实验编写新预设 |

## 环境要求

- Node.js `^22.19 || >=24`
- pnpm 11
- Rust stable（仅桌面构建需要）
- 任一受支持服务商的 API 密钥（DeepSeek、Anthropic、OpenAI 或任何 OpenAI 兼容端点）

## 快速开始

```sh
pnpm install
pnpm run build
pnpm dsh web
```

Web UI 会在 <http://127.0.0.1:3080> 打开。在 **Settings → Models** 中添加你的 API 密钥，选择一个工作区文件夹，然后开始会话。

### Run

`pnpm dsh web` 在 `http://127.0.0.1:3080` 提供 Web UI。服务器只绑定到 loopback 接口。如需终端界面，请改为运行 `pnpm dsh`。

### Run from source

执行 `pnpm install` 后，CLI 通过 tsx 从源码运行：

```sh
pnpm dsh web
```

使用 `pnpm run build` 产出生产 `lib/` 构建，使用 `pnpm run test` 运行单元测试。真实 API 测试需要 `DEEPSEEK_API_KEY`。

## 桌面应用

桌面应用是包裹本引擎的一层轻量 Rust/Tauri 外壳。它打包引擎运行时，在空闲的 loopback 端口上启动，并在原生窗口中打开同一个 Web UI——内部不包含任何 API 密钥或模型凭据。每次推送 `desktop-v*` 标签，CI 都会产出 Windows（NSIS）、macOS（Apple Silicon，DMG）与 Linux（DEB + AppImage）的安装包。

架构、构建方法与发布流程见 [desktop/README.md](desktop/README.md)。

## 架构

引擎是一张插件图：每个能力都是一个插件，通过类型化服务、事件与扩展点参与组合。源码树分为 `packages/`（产品 API 与提供方）、`vendor/`（vendor 的 Cordis 框架，重新作用域为 `@deepseek-ai`）、`apps/`（CLI 与 Web 前端）、`native/`（Landlock 沙箱绑定）与 `python/`（Python SDK 与捆绑运行时）。详见 [docs/architecture.md](docs/architecture.md)。

## 品牌

- **颜色：** `#ff0000`——主题把上游蓝色色阶替换为 `packages/client/ui-theme/src/styles/design-platform.css` 中的红色色阶。
- **字标与图标：** `packages/client/ui-primitives/src/BrandWordmark.tsx`（应用内字标）与 `apps/web/public/`（favicon 与 manifest）。

## 分支策略

本分支有意贴近上游。`origin` 指向本仓库，`upstream` 指向 `deepseek-ai/deepseek-harness`；请定期拉取上游，让合并保持轻量。品牌改动以加法优先，npm 包名永不重命名，已知冲突点与完整同步流程见 [AGENTS.md](AGENTS.md)。

## 许可证

MIT。引擎属于 DeepSeek（[LICENSE](LICENSE)）；第三方声明保留在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。XYZ-OS 的品牌、主题与本 README 为本分支原创。
