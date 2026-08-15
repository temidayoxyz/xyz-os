# XYZ-OS

English | [中文](README.zh.md)

**XYZ-OS** is a personal AI operating system: one local agent engine that runs
entirely on your machine and opens as a native desktop app or a web UI. It
combines five purpose-built modes — Coworker, Coder, Designer, Assistant, and
Creator — over a shared workspace, session history, and tool set.

XYZ-OS is a maintained fork of
[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), an
MIT-licensed, plugin-based agent engine where everything is a plugin. The
engine, agent loop, and tooling come from upstream; XYZ-OS adds the brand, the
theme, the Designer mode, and the desktop distribution.

## Features

- **Everything local.** The engine, sessions, and data stay on your machine;
  model traffic goes only to the provider you configure.
- **Five modes, one workspace.** Pick a mode when you start a session and it
  stages the right tools, skills, and instructions for the job.
- **Real tooling.** Files, shell, code search, LSP, terminals, subagents,
  workflows, plans, goals, and web search/fetch, composed per mode.
- **Durable sessions.** Sessions are event-sourced and stored locally, with
  titles, projections, and history that survive restarts.
- **Extensible by design.** New behavior is a plugin; the runtime mounts its
  own plugins, and presets are plain configuration.
- **Native desktop.** A Rust/Tauri shell ships the engine and opens the same
  UI as a desktop app on Windows, macOS, and Linux.
- **Bring your own key.** No API keys or model credentials are bundled; each
  user configures their own provider from the Models page.

## Modes

Modes are chosen from the preset chip on the new-session screen. Running
sessions keep the preset they began with. Presets live in
`apps/cli/config/agent-presets/`.

| Mode | Preset | What it does |
|------|--------|--------------|
| 💼 **Coworker** | `standard` | Files, web research, plans, goals, subagents, workflows, and office tools |
| 💻 **Coder** | `code` | Coworker plus the Code Mode SDK — multi-step coding operations composed as programs |
| 🎨 **Designer** | `design` | A design-studio loop: brief → direction → artifact → critique → deliver, with skill packs and a persistent `.design/` memory |
| ✨ **Assistant** | `minimal` | The leanest helper: shell and text editor only |
| 🧪 **Creator** | `cordis` | Authors new presets with runtime inspection and plugin experiments |

## Prerequisites

- Node.js `^22.19 || >=24`
- pnpm 11
- Rust stable (desktop builds only)
- An API key from a supported provider (DeepSeek, Anthropic, OpenAI, or any
  OpenAI-compatible endpoint)

## Getting started

```sh
pnpm install
pnpm run build
pnpm dsh web
```

The web UI opens at <http://127.0.0.1:3080>. Add your API key under
**Settings → Models**, pick a workspace folder, and start a session.

### Run

`pnpm dsh web` serves the Web UI on `http://127.0.0.1:3080`. The server binds
to the loopback interface only. For the terminal interface, run `pnpm dsh`
instead.

### Run from source

After `pnpm install`, the CLI runs from source through tsx:

```sh
pnpm dsh web
```

Use `pnpm run build` to emit the production `lib/` bundles, and
`pnpm run test` for the unit suite. Real-API tests require `DEEPSEEK_API_KEY`.

## Desktop app

The desktop app is a thin Rust/Tauri shell around this engine. It bundles the
engine runtime, boots it on a free loopback port, and opens the same web UI in
a native window — with no API keys or model credentials inside. Builds and
installers for Windows (NSIS), macOS (Apple Silicon, DMG), and Linux (DEB +
AppImage) are produced by CI on every `desktop-v*` tag.

See [desktop/README.md](desktop/README.md) for the architecture, build
instructions, and release process.

## Architecture

The engine is a plugin graph: every capability is a plugin that contributes
through typed service, event, and extension points. The source tree is split
into `packages/` (the product API and providers), `vendor/` (the vendored
Cordis framework, rescoped to `@deepseek-ai`), `apps/` (the CLI and web
frontend), `native/` (the Landlock sandbox binding), and `python/` (the Python
SDK and bundled runtime). See [docs/architecture.md](docs/architecture.md).

## Brand

- **Color:** `#ff0000` — the theme replaces the upstream blue ramp with a red
  ramp in `packages/client/ui-theme/src/styles/design-platform.css`.
- **Wordmark and icons:** `packages/client/ui-primitives/src/BrandWordmark.tsx`
  (in-app wordmark) and `apps/web/public/` (favicon and manifest).

## Fork policy

This fork stays close to upstream on purpose. `origin` points at this
repository and `upstream` at `deepseek-ai/deepseek-harness`; pull upstream
regularly so merges stay small. Rebrand changes are additive-first, npm package
names are never renamed, and the known conflict touchpoints and the full sync
routine live in [AGENTS.md](AGENTS.md).

## License

MIT. The engine is DeepSeek's ([LICENSE](LICENSE)); third-party notices stay in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The XYZ-OS brand, theme, and
this README are original to this fork.
