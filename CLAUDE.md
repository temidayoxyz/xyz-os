AGENTS.md

# XYZ-OS fork notes

This repo is **XYZ-OS** — a private, personal fork of `deepseek-ai/deepseek-harness` (upstream). One engine, three planned modes (Work / Code / Design), red brand (`#ff0000`). Everything else follows upstream's `AGENTS.md`.

## Remotes

- `origin` → `github.com/temidayoxyz/xyz-os` (this private fork)
- `upstream` → `github.com/deepseek-ai/deepseek-harness` (track `master`)

## Upstream sync routine (do this every week or two, not once a year)

```sh
git fetch upstream
git merge upstream/master          # resolve conflicts; see touchpoints below
pnpm install                       # required whenever pnpm-lock.yaml changed
pnpm run build                     # required every time
pnpm test                          # or at least the two rebrand specs (below)
pnpm dsh web                       # boot smoke check — must serve HTTP 200 at http://127.0.0.1:3080
```

A merge is not done until the app boots. If upstream bumped `SCHEMA_VERSION` (see AGENTS.md) or renamed a package our rebrand references, that is a semantic conflict — resolve deliberately, do not guess.

## Rebrand touchpoints (expect conflicts here on every upstream pull)

| File | What we changed |
|------|-----------------|
| `packages/client/ui-theme/src/styles/design-platform.css` | DeepSeek blue ramp → XYZ red ramp (`#ff0000` at 500); one hardcoded alias (`brand-primary-new-colorprimary-new-color`) → red |
| `packages/client/ui-primitives/src/BrandWordmark.tsx` | Whale wordmark → XYZ badge + `· OS` placeholder (user's light/dark logos pending — they drop in `apps/web/public/`) |
| `apps/web/index.html` | `<title>` → `XYZ-OS`; `lang` → `en` (English-only UI) |
| `apps/web/public/manifest.webmanifest` | name → `XYZ-OS`, short_name → `XYZ` |
| `apps/web/public/favicon.svg` | Whale icon → red XYZ badge placeholder |
| `packages/client/ui-settings-models/src/onboarding-copy.ts` | Welcome notice → personal XYZ-OS copy (English in both locale tables) |
| `packages/client/ui-settings-models/tests/welcome-notice.client.spec.tsx` | Test expects the new copy |
| `packages/client/web/tests/document-title.client.spec.tsx` | Test expects `XYZ-OS` title |
| `apps/cli/config/agent-presets/*/preset.yml` | All preset names/descriptions → English (Standard, Code, Minimal, Creator) |
| `README.md` | Fully replaced — keep ours on conflict |

## XYZ-OS mode tabs (the Work/Code/Design switch)

The mode switch is a first-party plugin, **`packages/client/ui-mode-tabs`** — a whole new package, so upstream merges never touch it. It rides the shared agent-preset seat (published by `ui-agent-preset` on `Symbol.for('dsh.client.agent-preset.seat')`) and registers into the `sidebar.modes` hole.

Files of THEIRS the tabs feature edits (re-apply on conflict):

| File | What we changed |
|------|-----------------|
| `packages/client/ui-agent-preset/src/client/index.ts` | `scope.provide(Symbol.for('dsh.client.agent-preset.seat'), seat)` after the seat is created |
| `packages/client/ui-sidebar/src/client/index.ts` | `'sidebar.modes': { kind: 'single', scope: 'root' }` added to the registration's `children` |
| `packages/client/ui-sidebar/src/client/contract/slots.ts` | `'sidebar.modes'` added to `PropsRenderSlots` + type-only import of ui-mode-tabs |
| `packages/client/ui-sidebar/src/client/SidebarRoot.tsx` | `renderSlot('sidebar.modes', { wide })` between New Session and the workspace browser; rail fish → red X badge svg |
| `packages/client/ui-sidebar/tsconfig.json` | reference to `../ui-mode-tabs` |
| `packages/client/ui-sidebar/tests/*.client.spec.tsx` | test mocks got `SessionProvider={() => null}` (upstream may fix these — prefer theirs) |
| `packages/bundle/web-app/cordis.patch.yml` | `ui-mode-tabs` plugin entry after `ui-agent-preset` |
| `packages/bundle/web-app/package.json` | dependency on `@deepseek-ai/dsh-client-ui-mode-tabs` |
| `tsconfig.client.json` | reference to `./packages/client/ui-mode-tabs` |
| `apps/cli/config/agent-presets/design/` | the Design preset (new files, no conflicts) |

Tabs map to presets: Work → `standard`, Code → `code`, Design → `design` (see `ModeTabs.tsx` MODES).

When upstream changes one of these files, re-apply the XYZ-OS edit on top of their new version — don't blindly take theirs (loses the brand) or ours (loses their fixes).

## Rules that keep upstream pulls cheap

1. **Never rename the npm packages** (`@deepseek-ai/*`). Invisible to users; rename = merge hell.
2. **Never blanket-replace `deepseek`** — model provider names (e.g. `deepseek-chat`) must stay intact. Only user-facing brand strings change.
3. **Add files, don't edit theirs**, wherever possible — new presets go in `apps/cli/config/agent-presets/` as new YAML, new plugins as new packages, new themes as new token layers.
4. **Keep `LICENSE` and `THIRD_PARTY_NOTICES.md` intact** — MIT attribution is the legal contract.
5. The `--dsw-static-blue-*` ramp is semantic (info/links) and was deliberately left blue. If the red theme needs it gone, that's a follow-up decision, not part of the first rebrand pass.
