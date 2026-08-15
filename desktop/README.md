# XYZ-OS Desktop

English | [中文](README.zh.md)

The XYZ-OS desktop app is a thin Rust/Tauri shell around the local agent
engine. The shell never reimplements product behavior: on first launch it
unpacks the bundled engine runtime, spawns the bundled Node engine to serve
the web UI on a free loopback port, and navigates the webview to the URL the
engine announces. Sessions, modes, models, and the UI stay in the engine, so
the desktop app and the web app always behave identically.

## Architecture

Everything the app needs at runtime ships as one resource:

- `runtime/runtime.tar.zst` — the self-contained engine tree (built packages,
  production dependencies, the web UI build, and the vendored framework),
  compressed with zstd. Tauri bundles it as a single file, so the build script
  copies one resource instead of walking tens of thousands of files.
- `binaries/xyz-engine-<target-triple>[.exe]` — Node, shipped as a Tauri
  external binary and placed beside the app executable.

On first launch the shell extracts the archive into the per-user app data dir
(`runtime/` under `com.xyz.os`), recreating pnpm's workspace links as
junctions on Windows and symlinks on Unix. A version marker makes later
launches skip extraction; a partial tree from an interrupted extraction is
cleared automatically.

The engine is started with `--port 0`, so the OS assigns a free port and the
desktop app never conflicts with a running `xyz web` dev server. The shell
watches the engine's stdout for the `xyz web: http://...` line and navigates
there. Closing the window kills the engine.

## Building

Prerequisites: Node 22.19+ or 24+, pnpm 11, Rust stable, and the Tauri 2
platform dependencies (WebView2 is built into modern Windows; Linux needs
`libwebkit2gtk-4.1-dev` and friends; macOS needs Xcode command-line tools).

```sh
pnpm install                       # from the repository root
pnpm run build                     # build the libraries and the web UI
cd desktop
pnpm install --ignore-workspace    # desktop-only tooling
pnpm run desktop:build             # build runtime + app for this platform
```

The build targets are chosen per platform: NSIS on Windows, app bundle + DMG
on macOS, DEB + AppImage on Linux. Override with
`node scripts/build.mjs --bundles <csv>`.

`scripts/build-runtime.mjs` assembles the runtime: it copies the workspace
(excluding dev-only trees), installs production dependencies from the pnpm
store, restores workspace peer links, drops dangling optional-dependency
links, verifies the packed engine boots and serves the UI, and archives the
tree. `--skip-copy` reuses the staged tree; `--skip-verify` skips the boot
check.

## Development

Run the web UI yourself and launch the shell in dev mode:

```sh
pnpm xyz web           # from the repository root (dev server on 127.0.0.1:3080)
cd desktop
pnpm run desktop:dev
```

Dev builds skip the bundled runtime and open `http://127.0.0.1:3080`.

## Verifying

`pnpm run desktop:build` already boots the bundled engine and confirms the web
UI answers before the installer is produced. The `XYZ_OS_PORT` environment
variable pins the engine port for automated smoke tests.

## Releases

Push a `desktop-v*` tag. The `Desktop` workflow builds all three platforms,
smoke-tests each package, and publishes the installers to a GitHub release
with the notes from `RELEASE_NOTES.md`. macOS and Linux builds are unsigned
unless signing credentials are configured.
