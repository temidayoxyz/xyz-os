# XYZ-OS

> **I am the XYZ. It is my OS.**

**XYZ-OS** is my personal AI operating system — one agent engine, three modes:

| Mode | What it does | Engine |
|------|--------------|--------|
| 💼 **Coworker** | Files, web research, schedules, background jobs, office tools | `standard` preset |
| 💻 **Coder** | Shell, editor, LSP, tests — multi-step coding composed as programs | `code` preset (PTC mode) |
| 🎨 **Designer** | Design loop: brief → direction → artifact → critique → deliver | `design` preset |

Built as a personal fork of [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — an MIT-licensed, plugin-based agent engine where *everything is a plugin*. The engine is theirs; the brand, the theme, and the point of view are mine.

## Why XYZ-OS

Because it is mine. Not another subscription. Not someone else's blue. **Red.**

## Getting started

Prerequisites: Node `^22.19 || >=24`, pnpm, and an API key from any supported provider (DeepSeek, Anthropic, OpenAI, or any OpenAI-compatible endpoint).

```sh
pnpm install
pnpm run build
pnpm dsh web          # serves the Web UI at http://127.0.0.1:3080
```

Then in the UI: **Settings → Models** to add your key, pick a workspace folder, and talk to the agent.

## The brand

- **Color:** `#ff0000` — the DeepSeek blue ramp is replaced with a red ramp built around it, in `packages/client/ui-theme/src/styles/design-platform.css`
- **Logo:** custom XYZ-OS logo — a red badge placeholder is in use until the final design lands. Swap `packages/client/ui-primitives/src/BrandWordmark.tsx` (in-app wordmark) and `apps/web/public/favicon.svg` (tab icon)

## The modes

Modes are picked from the **preset chip on the new-session screen** (next to the workspace picker) — the choice stages the agent preset for the session you are about to start. Running sessions keep the preset they began with.

The presets live in `apps/cli/config/agent-presets/`:

- **Coworker** is the `standard` preset — full agent with files, shell, web search, plans, goals, subagents, workflows
- **Coder** is the `code` preset — everything Coworker has plus the Code Mode SDK, where the model composes multi-step operations as a TypeScript program
- **Designer** is the `design` preset (XYZ-OS's own) — a design-studio persona with web fetch enabled, plus two skill packs that run the full loop: `design-principles` (how to think) and `design-qa` (render → critic subagent → fix → compare), and a persistent `.design/` memory convention so sessions compound instead of restarting from zero
- **Assistant** is the `minimal` preset — the two-tool agent (shell + text editor), the leanest helper
- **Creator** is the `cordis` preset — authors new presets with runtime inspection and plugin experiments

## Fork policy

This fork stays close to upstream on purpose:

- `upstream` → `deepseek-ai/deepseek-harness` · `origin` → this repo
- Pull upstream regularly — small merges are cheap, catch-ups are surgery. The full routine (install → build → test → boot) is in `CLAUDE.md`
- Rebrand changes are deliberately additive-first; known conflict touchpoints are listed in `CLAUDE.md`
- npm package names are **not** renamed — internal names are invisible to users, and renaming buys merge pain for zero value

## License

MIT. The engine is DeepSeek's ([LICENSE](LICENSE), © 2026 DeepSeek); third-party notices stay in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The XYZ-OS brand, theme, and this README are mine.
